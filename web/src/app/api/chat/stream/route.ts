import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Store connected clients (in production, use Redis pub/sub)
const clients = new Map<string, { controller: ReadableStreamDefaultController; userId: string }>();

// Broadcast a message to all connected clients
export function broadcastMessage(message: object, excludeUserId?: string) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  clients.forEach((client, id) => {
    if (client.userId !== excludeUserId) {
      try {
        client.controller.enqueue(new TextEncoder().encode(data));
      } catch {
        clients.delete(id);
      }
    }
  });
}

// Broadcast to a specific user (for DMs)
export function broadcastToUser(userId: string, message: object) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  clients.forEach((client) => {
    if (client.userId === userId) {
      try {
        client.controller.enqueue(new TextEncoder().encode(data));
      } catch {
        // Ignore errors
      }
    }
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const clientId = `${session.user.id}-${Date.now()}`;

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      clients.set(clientId, {
        controller,
        userId: session.user!.id!,
      });

      // Send initial connection message
      const connectedData = `data: ${JSON.stringify({ type: "connected", clientId })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectedData));

      // Fetch initial online users and send
      prisma.chatPresence.findMany({
        where: {
          lastSeen: { gte: new Date(Date.now() - 2 * 60 * 1000) },
        },
      }).then((users) => {
        const usersData = `data: ${JSON.stringify({ type: "presence_list", users })}\n\n`;
        try {
          controller.enqueue(new TextEncoder().encode(usersData));
        } catch {
          // Stream may be closed
        }
      }).catch(() => {});

      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          const pingData = `data: ${JSON.stringify({ type: "ping" })}\n\n`;
          controller.enqueue(new TextEncoder().encode(pingData));
        } catch {
          clearInterval(pingInterval);
          clients.delete(clientId);
        }
      }, 30000);

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        clients.delete(clientId);
        // Broadcast user offline
        broadcastMessage({
          type: "presence_update",
          userId: session.user!.id,
          status: "offline",
        });
      });
    },
    cancel() {
      clients.delete(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
