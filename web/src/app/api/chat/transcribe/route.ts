import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from "openai";

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

// POST /api/chat/transcribe - Transcribe audio file using Whisper
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!r2Client) {
    return NextResponse.json(
      { success: false, error: "File storage not configured" },
      { status: 503 }
    );
  }

  if (!openai) {
    return NextResponse.json(
      { success: false, error: "OpenAI API not configured. Please add OPENAI_API_KEY to .env" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { attachmentId } = body;

    if (!attachmentId) {
      return NextResponse.json(
        { success: false, error: "Attachment ID required" },
        { status: 400 }
      );
    }

    // Fetch attachment from database
    const attachment = await prisma.chatAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return NextResponse.json(
        { success: false, error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Verify ownership or permission
    if (attachment.userId !== session.user.id) {
      // TODO: Check if user has permission to view this attachment via channel membership
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Check if it's an audio file
    if (attachment.category !== "audio") {
      return NextResponse.json(
        { success: false, error: "Attachment is not an audio file" },
        { status: 400 }
      );
    }

    // Check if already transcribed
    if (attachment.transcription && attachment.transcriptionStatus === "completed") {
      return NextResponse.json({
        success: true,
        data: {
          transcription: attachment.transcription,
          status: "completed",
          cached: true,
        },
      });
    }

    // Update status to processing
    await prisma.chatAttachment.update({
      where: { id: attachmentId },
      data: {
        transcriptionStatus: "processing",
      },
    });

    // Download audio file from R2
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: attachment.key,
    });

    const s3Response = await r2Client.send(getCommand);

    if (!s3Response.Body) {
      throw new Error("Failed to download audio file from R2");
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = s3Response.Body as ReadableStream;
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const audioBuffer = Buffer.concat(chunks);

    // Create a File object for OpenAI API
    const audioFile = new File(
      [audioBuffer],
      attachment.filename,
      { type: attachment.contentType }
    );

    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en", // Auto-detect if not specified
      response_format: "verbose_json", // Get timestamps and additional metadata
    });

    // Update attachment with transcription
    const updatedAttachment = await prisma.chatAttachment.update({
      where: { id: attachmentId },
      data: {
        transcription: transcription.text,
        transcriptionStatus: "completed",
        duration: transcription.duration ? Math.round(transcription.duration) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        transcription: transcription.text,
        duration: transcription.duration,
        language: transcription.language,
        status: "completed",
        cached: false,
      },
    });
  } catch (error) {
    console.error("Error transcribing audio:", error);

    // Update status to failed
    try {
      const body = await request.json();
      const { attachmentId } = body;

      if (attachmentId) {
        await prisma.chatAttachment.update({
          where: { id: attachmentId },
          data: {
            transcriptionStatus: "failed",
          },
        });
      }
    } catch (updateError) {
      console.error("Error updating failed status:", updateError);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to transcribe audio"
      },
      { status: 500 }
    );
  }
}

// GET /api/chat/transcribe?attachmentId=xxx - Get transcription status/result
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
    const attachmentId = searchParams.get("attachmentId");

    if (!attachmentId) {
      return NextResponse.json(
        { success: false, error: "Attachment ID required" },
        { status: 400 }
      );
    }

    // Fetch attachment
    const attachment = await prisma.chatAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        transcription: true,
        transcriptionStatus: true,
        duration: true,
        userId: true,
      },
    });

    if (!attachment) {
      return NextResponse.json(
        { success: false, error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Verify ownership or permission
    if (attachment.userId !== session.user.id) {
      // TODO: Check channel membership
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        transcription: attachment.transcription,
        status: attachment.transcriptionStatus || "pending",
        duration: attachment.duration,
      },
    });
  } catch (error) {
    console.error("Error fetching transcription:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transcription" },
      { status: 500 }
    );
  }
}
