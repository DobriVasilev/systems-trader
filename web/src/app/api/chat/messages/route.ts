import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { broadcastMessage } from "../stream/route";

// GET /api/chat/messages - Get chat messages with pagination
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
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const messages = await prisma.chatMessage.findMany({
      where: {
        deleted: false,
      },
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { createdAt: "desc" },
      include: {
        replyTo: {
          select: {
            id: true,
            userName: true,
            content: true,
          },
        },
      },
    });

    // Reverse to show oldest first
    const orderedMessages = messages.reverse();

    return NextResponse.json({
      success: true,
      data: orderedMessages,
      nextCursor: messages.length === limit ? messages[0]?.id : null,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/chat/messages - Send a new message
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { content, imageUrl, replyToId } = body;

    if (!content?.trim() && !imageUrl) {
      return NextResponse.json(
        { success: false, error: "Message content or image is required" },
        { status: 400 }
      );
    }

    // Check if user is VIP (could be based on subscription, role, etc.)
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

    const message = await prisma.chatMessage.create({
      data: {
        userId: session.user.id,
        userName: user.name || "Anonymous",
        userAvatar: user.image,
        content: content?.trim() || "",
        imageUrl,
        replyToId,
        isVip: false, // TODO: Implement VIP logic
      },
      include: {
        replyTo: {
          select: {
            id: true,
            userName: true,
            content: true,
          },
        },
      },
    });

    // Broadcast to all connected clients
    broadcastMessage({
      type: "new_message",
      message,
    }, session.user.id);

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/messages - Delete a message (soft delete)
export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("id");

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "Message ID is required" },
        { status: 400 }
      );
    }

    // Check ownership
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    if (message.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own messages" },
        { status: 403 }
      );
    }

    await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        deleted: true,
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: messageId },
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete message" },
      { status: 500 }
    );
  }
}

// PATCH /api/chat/messages - Add/remove reaction
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { messageId, emoji, action } = body;

    if (!messageId || !emoji) {
      return NextResponse.json(
        { success: false, error: "Message ID and emoji are required" },
        { status: 400 }
      );
    }

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    const reactions = (message.reactions as Record<string, string[]>) || {};
    const emojiReactions = reactions[emoji] || [];

    if (action === "add") {
      if (!emojiReactions.includes(session.user.id)) {
        reactions[emoji] = [...emojiReactions, session.user.id];
      }
    } else if (action === "remove") {
      reactions[emoji] = emojiReactions.filter((id) => id !== session.user.id);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { reactions },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error updating reaction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update reaction" },
      { status: 500 }
    );
  }
}
