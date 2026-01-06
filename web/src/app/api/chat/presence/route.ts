import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { broadcastMessage } from "../stream/route";

// Presence timeout - consider user offline after 2 minutes of inactivity
const PRESENCE_TIMEOUT_MS = 2 * 60 * 1000;

// GET /api/chat/presence - Get online users
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const cutoffTime = new Date(Date.now() - PRESENCE_TIMEOUT_MS);

    // Get all users who were active recently
    const onlineUsers = await prisma.chatPresence.findMany({
      where: {
        lastSeen: { gte: cutoffTime },
      },
      orderBy: { lastSeen: "desc" },
    });

    // Clean up stale presence records (older than 1 hour)
    const staleTime = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.chatPresence.deleteMany({
      where: {
        lastSeen: { lt: staleTime },
      },
    });

    return NextResponse.json({
      success: true,
      data: onlineUsers,
    });
  } catch (error) {
    console.error("Error fetching presence:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch presence" },
      { status: 500 }
    );
  }
}

// POST /api/chat/presence - Update user presence (heartbeat)
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const status = body.status || "online";

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, image: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Check if this is a new presence (user just came online)
    const existingPresence = await prisma.chatPresence.findUnique({
      where: { userId: session.user.id },
    });
    const wasOffline = !existingPresence ||
      new Date(existingPresence.lastSeen).getTime() < Date.now() - PRESENCE_TIMEOUT_MS;

    // Upsert presence
    const presence = await prisma.chatPresence.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        userName: user.name || "Anonymous",
        userAvatar: user.image,
        status,
        lastSeen: new Date(),
        isVip: false, // TODO: Implement VIP logic
      },
      update: {
        userName: user.name || "Anonymous",
        userAvatar: user.image,
        status,
        lastSeen: new Date(),
      },
    });

    // Broadcast presence update if user just came online
    if (wasOffline) {
      broadcastMessage({
        type: "presence_update",
        userId: session.user.id,
        user: presence,
        status: "online",
      }, session.user.id);
    }

    return NextResponse.json({
      success: true,
      data: presence,
    });
  } catch (error) {
    console.error("Error updating presence:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update presence" },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/presence - Remove user presence (going offline)
export async function DELETE() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await prisma.chatPresence.delete({
      where: { userId: session.user.id },
    }).catch(() => {
      // Ignore if doesn't exist
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error removing presence:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove presence" },
      { status: 500 }
    );
  }
}
