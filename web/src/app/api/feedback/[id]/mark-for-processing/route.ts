import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markForProcessingRateLimit, checkRateLimit } from "@/lib/rate-limit";

/**
 * Mark feedback for autonomous processing by Claude Code
 * Only dev_team and admin users can trigger autonomous processing
 */
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
    markForProcessingRateLimit,
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

  // Fetch user to check role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const isDev = user?.role === "dev_team";
  const isAdmin = user?.role === "admin";

  // Only dev_team and admin can trigger autonomous processing
  if (!isDev && !isAdmin) {
    return NextResponse.json(
      {
        success: false,
        error: "Only dev_team members can trigger autonomous processing",
        hint: "Use the manual prompt export instead",
      },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // Fetch feedback to verify it exists and belongs to user (or user is admin)
    const feedback = await prisma.feedback.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        implementationStatus: true,
      },
    });

    if (!feedback) {
      return NextResponse.json(
        { success: false, error: "Feedback not found" },
        { status: 404 }
      );
    }

    // Users can only mark their own feedback, admins can mark any
    if (!isAdmin && feedback.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "You can only mark your own feedback" },
        { status: 403 }
      );
    }

    // Check if already being processed
    if (
      feedback.implementationStatus === "PROCESSING" ||
      feedback.implementationStatus === "ANALYZING" ||
      feedback.implementationStatus === "IMPLEMENTING"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Feedback is already being processed",
          status: feedback.implementationStatus,
        },
        { status: 409 }
      );
    }

    // Update feedback to mark for processing
    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: {
        implementationStatus: "PENDING",
        status: "IN_PROGRESS",
        processedAt: null, // Will be set when Claude picks it up
        errorMessage: null,
        retryCount: 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedFeedback.id,
        implementationStatus: updatedFeedback.implementationStatus,
        message:
          "Feedback marked for autonomous processing. Claude Code will pick it up shortly.",
      },
    });
  } catch (error) {
    console.error("Error marking feedback for processing:", error);
    return NextResponse.json(
      { success: false, error: "Failed to mark feedback for processing" },
      { status: 500 }
    );
  }
}
