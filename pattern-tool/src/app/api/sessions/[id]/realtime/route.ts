import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRecentMessages, joinSession, leaveSession, heartbeat } from "@/lib/realtime";

/**
 * Server-Sent Events (SSE) endpoint for real-time updates
 *
 * GET /api/sessions/[id]/realtime
 *
 * This replaces Pusher with a free alternative using Upstash Redis.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id: sessionId } = await params;

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check access to session
  const patternSession = await prisma.patternSession.findFirst({
    where: {
      id: sessionId,
      OR: [
        { createdById: session.user.id },
        { shares: { some: { userId: session.user.id } } },
        { isPublic: true },
      ],
    },
  });

  if (!patternSession) {
    return new Response("Session not found", { status: 404 });
  }

  // Join presence
  await joinSession(sessionId, {
    id: session.user.id,
    name: session.user.name || "Anonymous",
    email: session.user.email,
    image: session.user.image || undefined,
  });

  // Create SSE stream
  const encoder = new TextEncoder();
  let lastTimestamp = Date.now();
  let isConnected = true;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`)
      );

      // Poll for new messages
      const pollInterval = setInterval(async () => {
        if (!isConnected) {
          clearInterval(pollInterval);
          return;
        }

        try {
          // Heartbeat to maintain presence
          await heartbeat(sessionId, session.user.id);

          // Get new messages since last check
          const messages = await getRecentMessages(sessionId, lastTimestamp);

          for (const msg of messages) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(msg)}\n\n`)
            );
            lastTimestamp = Math.max(lastTimestamp, msg.timestamp);
          }
        } catch (error) {
          console.error("[SSE] Error polling messages:", error);
        }
      }, 1000); // Poll every second

      // Cleanup on close
      request.signal.addEventListener("abort", async () => {
        isConnected = false;
        clearInterval(pollInterval);
        await leaveSession(sessionId, session.user.id);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
