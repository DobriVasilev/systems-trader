import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Admin Controls for Feedback Implementation
 *
 * Actions:
 * - retry: Retry a failed implementation
 * - cancel: Cancel in-progress implementation
 * - reset: Reset feedback to PENDING status
 * - override: Manually set implementation status
 *
 * Admin only
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

  // Only admins can use admin controls
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, reason, newStatus } = body;

    // Validate action
    const validActions = ["retry", "cancel", "reset", "override"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    // Fetch feedback
    const feedback = await prisma.feedback.findUnique({
      where: { id },
      select: {
        id: true,
        implementationStatus: true,
        retryCount: true,
        maxRetries: true,
      },
    });

    if (!feedback) {
      return NextResponse.json(
        { success: false, error: "Feedback not found" },
        { status: 404 }
      );
    }

    let updateData: any = {};
    let actionDescription = "";

    switch (action) {
      case "retry":
        // Retry failed implementation
        if (feedback.implementationStatus !== "FAILED") {
          return NextResponse.json(
            {
              success: false,
              error: "Can only retry failed implementations",
            },
            { status: 400 }
          );
        }

        updateData = {
          implementationStatus: "PENDING",
          status: "PENDING",
          errorMessage: null,
          retryCount: 0, // Reset retry count for admin retry
          processedAt: null,
          completedAt: null,
        };
        actionDescription = "Retried failed implementation";
        break;

      case "cancel":
        // Cancel in-progress implementation
        const inProgressStatuses = [
          "PROCESSING",
          "ANALYZING",
          "IMPLEMENTING",
          "TESTING",
          "DEPLOYING",
        ];

        if (!inProgressStatuses.includes(feedback.implementationStatus)) {
          return NextResponse.json(
            {
              success: false,
              error: "Can only cancel in-progress implementations",
            },
            { status: 400 }
          );
        }

        updateData = {
          implementationStatus: "FAILED",
          status: "CLOSED",
          errorMessage: `Cancelled by admin: ${reason || "No reason provided"}`,
          completedAt: new Date(),
        };
        actionDescription = "Cancelled implementation";
        break;

      case "reset":
        // Reset to PENDING
        updateData = {
          implementationStatus: "PENDING",
          status: "PENDING",
          errorMessage: null,
          retryCount: 0,
          processedAt: null,
          completedAt: null,
          currentTask: null,
          implementationLog: null,
          claudeSessionId: null,
        };
        actionDescription = "Reset to pending status";
        break;

      case "override":
        // Manually override status
        if (!newStatus) {
          return NextResponse.json(
            { success: false, error: "newStatus required for override action" },
            { status: 400 }
          );
        }

        const validStatuses = [
          "PENDING",
          "PROCESSING",
          "ANALYZING",
          "IMPLEMENTING",
          "TESTING",
          "DEPLOYING",
          "COMPLETED",
          "FAILED",
        ];

        if (!validStatuses.includes(newStatus)) {
          return NextResponse.json(
            { success: false, error: "Invalid status" },
            { status: 400 }
          );
        }

        updateData = {
          implementationStatus: newStatus,
          status:
            newStatus === "COMPLETED"
              ? "IMPLEMENTED"
              : newStatus === "FAILED"
              ? "CLOSED"
              : "IN_PROGRESS",
        };

        if (newStatus === "COMPLETED") {
          updateData.completedAt = new Date();
          updateData.implementedAt = new Date();
          updateData.implementedById = session.user.id;
        }

        if (newStatus === "FAILED" && reason) {
          updateData.errorMessage = `Admin override: ${reason}`;
        }

        actionDescription = `Status overridden to ${newStatus}`;
        break;
    }

    // Update feedback
    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    console.log(
      `[ADMIN ACTION] User ${session.user.id} performed "${action}" on feedback ${id}. Reason: ${reason || "None"}`
    );

    return NextResponse.json({
      success: true,
      data: updatedFeedback,
      action: actionDescription,
    });
  } catch (error) {
    console.error("Error in admin control:", error);
    return NextResponse.json(
      { success: false, error: "Failed to execute admin action" },
      { status: 500 }
    );
  }
}
