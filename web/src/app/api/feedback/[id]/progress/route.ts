import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * SSE endpoint for real-time feedback implementation progress
 * Streams updates every 2 seconds while implementation is in progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: feedbackId } = await params;

  // Verify feedback exists and user has access
  const feedback = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    select: {
      userId: true,
      user: {
        select: {
          role: true,
        },
      },
    },
  });

  if (!feedback) {
    return new Response("Feedback not found", { status: 404 });
  }

  // Access control: Users can only view their own feedback, admins can view any
  const userRole = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const isAdmin = userRole?.role === "admin";

  if (!isAdmin && feedback.userId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  // Set up SSE
  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data immediately
      await sendUpdate(controller);

      // Send updates every 2 seconds
      intervalId = setInterval(async () => {
        try {
          await sendUpdate(controller);
        } catch (error) {
          console.error("Error sending SSE update:", error);
          clearInterval(intervalId);
          controller.close();
        }
      }, 2000);
    },
    cancel() {
      // Clean up when client disconnects
      clearInterval(intervalId);
    },
  });

  async function sendUpdate(controller: ReadableStreamDefaultController) {
    try {
      // Fetch latest feedback data
      const latestFeedback = await prisma.feedback.findUnique({
        where: { id: feedbackId },
        select: {
          id: true,
          title: true,
          textContent: true,
          implementationStatus: true,
          currentTask: true,
          implementationLog: true,
          errorMessage: true,
          processedAt: true,
          completedAt: true,
          implementationPlan: true,
        },
      });

      if (!latestFeedback) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "Feedback not found" })}\n\n`)
        );
        return;
      }

      // Parse implementation log into tasks
      let tasks: any[] = [];
      if (latestFeedback.implementationLog) {
        try {
          const log = latestFeedback.implementationLog as any;
          if (Array.isArray(log)) {
            tasks = log.map((entry: any, index: number) => ({
              id: `task-${index}`,
              title: entry.message || entry.task || entry.action,
              status: entry.status || (entry.completed ? "completed" : "in-progress"),
              timestamp: entry.timestamp,
            }));
          }
        } catch (error) {
          console.error("Error parsing implementation log:", error);
        }
      }

      // Build progress payload
      const progress = {
        feedbackId: latestFeedback.id,
        feedbackTitle: latestFeedback.title || latestFeedback.textContent?.substring(0, 100),
        implementationStatus: latestFeedback.implementationStatus,
        currentTask: latestFeedback.currentTask,
        tasks,
        errorMessage: latestFeedback.errorMessage,
        startedAt: latestFeedback.processedAt?.toISOString(),
        completedAt: latestFeedback.completedAt?.toISOString(),
        plan: latestFeedback.implementationPlan,
      };

      // Send SSE message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));

      // Close stream if implementation is complete or failed
      if (
        latestFeedback.implementationStatus === "COMPLETED" ||
        latestFeedback.implementationStatus === "FAILED"
      ) {
        // Send final message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...progress, final: true })}\n\n`));

        // Close after a short delay to ensure message is received
        setTimeout(() => {
          clearInterval(intervalId);
          controller.close();
        }, 1000);
      }
    } catch (error) {
      console.error("Error in sendUpdate:", error);
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ error: "Internal server error" })}\n\n`)
      );
    }
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable buffering in nginx
    },
  });
}
