import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateFeedbackPrompt, generateQuickPrompt, generateEmailFormat } from "@/lib/feedback-prompt-generator";
import { promptGenerationRateLimit, checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Rate limiting
  const rateLimitResult = await checkRateLimit(
    promptGenerationRateLimit,
    session.user.id
  );

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Rate limit exceeded. Please try again later.",
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        reset: rateLimitResult.reset,
      },
      { status: 429 }
    );
  }

  // Fetch user to check role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const isDev = user?.role === "dev_team";
  const isAdmin = user?.role === "admin";

  try {
    const { id } = await params;
    const body = await request.json();
    const { format = "full" } = body; // "full", "quick", or "email"

    // Fetch feedback with all related data
    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        attachments: {
          select: {
            url: true,
            filename: true,
            category: true,
          },
        },
      },
    });

    if (!feedback) {
      return NextResponse.json(
        { success: false, error: "Feedback not found" },
        { status: 404 }
      );
    }

    // Access control: Users can export their own feedback, admins can export any
    if (!isAdmin && feedback.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "You can only export your own feedback" },
        { status: 403 }
      );
    }

    // Transform feedback data to match expected format (convert Date to string)
    const feedbackData = {
      ...feedback,
      createdAt: feedback.createdAt.toISOString(),
    };

    let result;

    switch (format) {
      case "quick":
        result = {
          prompt: generateQuickPrompt(feedbackData),
        };
        break;

      case "email":
        result = generateEmailFormat(feedbackData);
        break;

      case "full":
      default:
        result = {
          prompt: generateFeedbackPrompt(feedbackData),
        };
        break;
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error generating prompt:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate prompt" },
      { status: 500 }
    );
  }
}
