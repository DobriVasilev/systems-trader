import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import { feedbackRateLimit, checkRateLimit } from "@/lib/rate-limit";

// R2 Client
const r2Client =
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY
    ? new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      })
    : null;

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "pattern-tool-uploads";

// OpenAI Client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// POST /api/feedback - Submit new feedback
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit(
    feedbackRateLimit,
    session.user.id
  );

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Rate limit exceeded",
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        reset: rateLimitResult.reset,
      },
      { status: 429 }
    );
  }

  // Fetch user role to determine workflow and bypass settings
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const isDev = user?.role === "dev_team";
  const isAdmin = user?.role === "admin";

  try {
    const body = await request.json();
    const {
      type,
      title,
      textContent,
      voiceAttachmentId,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      pageUrl,
      pagePath,
      selectedElement,
      attachmentIds,
      userAgent,
      screenResolution,
      viewport,
    } = body;

    // Validate required fields
    if (!textContent && !voiceAttachmentId) {
      return NextResponse.json(
        { success: false, error: "Either text content or voice message is required" },
        { status: 400 }
      );
    }

    // Validate text content length
    if (textContent && textContent.length > 10000) {
      return NextResponse.json(
        { success: false, error: "Text content too long (max 10,000 characters)" },
        { status: 400 }
      );
    }

    // Validate title length
    if (title && title.length > 200) {
      return NextResponse.json(
        { success: false, error: "Title too long (max 200 characters)" },
        { status: 400 }
      );
    }

    // Validate feedback type
    const validTypes = [
      "BUG_REPORT",
      "FEATURE_REQUEST",
      "UI_UX_ISSUE",
      "PERFORMANCE_ISSUE",
      "QUESTION",
      "OTHER",
    ];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: "Invalid feedback type" },
        { status: 400 }
      );
    }

    // Validate attachments count
    if (attachmentIds && attachmentIds.length > 10) {
      return NextResponse.json(
        { success: false, error: "Too many attachments (max 10)" },
        { status: 400 }
      );
    }

    let voiceTranscription: string | undefined;

    // If voice message, transcribe it
    if (voiceAttachmentId && openai && r2Client) {
      try {
        // Extract the key from the attachmentId (for now it's the key)
        // In production, you'd look this up from a temporary attachments table
        const voiceKey = `feedback/${session.user.id}/${voiceAttachmentId}`;

        // Download from R2
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: voiceKey,
        });

        const s3Response = await r2Client.send(getCommand);

        if (s3Response.Body) {
          const chunks: Uint8Array[] = [];
          const stream = s3Response.Body as ReadableStream;
          const reader = stream.getReader();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }

          const audioBuffer = Buffer.concat(chunks);
          const audioFile = new File(
            [audioBuffer],
            `feedback-voice.webm`,
            { type: "audio/webm" }
          );

          // Transcribe
          const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
            language: "en",
          });

          voiceTranscription = transcription.text;
        }
      } catch (error) {
        console.error("Error transcribing voice feedback:", error);
        // Continue without transcription
      }
    }

    // Create feedback
    // All feedback starts as PENDING, but the watcher will only pick up:
    // - dev_team and admin: Autonomous workflow (watcher processes automatically)
    // - Others: Manual workflow (they export prompt and share manually)
    const feedback = await prisma.feedback.create({
      data: {
        userId: session.user.id,
        type: type || "OTHER",
        title: title || undefined,
        textContent: textContent || undefined,
        voiceAttachmentId: voiceAttachmentId || undefined,
        voiceTranscription: voiceTranscription || undefined,
        stepsToReproduce: stepsToReproduce || undefined,
        expectedBehavior: expectedBehavior || undefined,
        actualBehavior: actualBehavior || undefined,
        pageUrl: pageUrl || undefined,
        pagePath: pagePath || undefined,
        userAgent: userAgent || undefined,
        screenResolution: screenResolution || undefined,
        viewport: viewport || undefined,
        status: "PENDING",
        implementationStatus: "PENDING", // Watcher will check user role
      },
    });

    // Create attachment records if any
    if (attachmentIds && attachmentIds.length > 0) {
      // For now, we'll skip creating FeedbackAttachment records
      // In production, you'd map the temporary IDs to actual files and create records
    }

    return NextResponse.json({
      success: true,
      data: feedback,
      workflow: isDev || isAdmin ? "autonomous" : "manual",
      message:
        isDev || isAdmin
          ? "Feedback submitted! Claude Code will process it automatically."
          : "Feedback submitted! An admin will review and process it.",
    });
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

// GET /api/feedback - List feedback items
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Check if user is admin
    const isAdmin = session.user.role === "admin";

    // Build where clause
    const where: any = {};

    // Non-admins can only see their own feedback
    if (!isAdmin) {
      where.userId = session.user.id;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const feedback = await prisma.feedback.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        attachments: true,
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        implementedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
      skip: offset,
    });

    const total = await prisma.feedback.count({ where });

    return NextResponse.json({
      success: true,
      data: {
        feedback,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error listing feedback:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list feedback" },
      { status: 500 }
    );
  }
}
