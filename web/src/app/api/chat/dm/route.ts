import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { broadcastToUser } from "../stream/route";

// GET /api/chat/dm?userId=xxx - Get DM conversation with a user
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
    const userId = searchParams.get("userId");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          {
            senderId: session.user.id,
            receiverId: userId,
            deletedBySender: false,
          },
          {
            senderId: userId,
            receiverId: session.user.id,
            deletedByReceiver: false,
          },
        ],
      },
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Mark messages as read
    await prisma.directMessage.updateMany({
      where: {
        senderId: userId,
        receiverId: session.user.id,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
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
    console.error("Error fetching DMs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/chat/dm - Send a DM
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
    const { receiverId, content, imageUrl } = body;

    if (!receiverId) {
      return NextResponse.json(
        { success: false, error: "Receiver ID is required" },
        { status: 400 }
      );
    }

    if (!content?.trim() && !imageUrl) {
      return NextResponse.json(
        { success: false, error: "Message content or image is required" },
        { status: 400 }
      );
    }

    // Verify receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return NextResponse.json(
        { success: false, error: "Receiver not found" },
        { status: 404 }
      );
    }

    const message = await prisma.directMessage.create({
      data: {
        senderId: session.user.id,
        receiverId,
        content: content?.trim() || "",
        imageUrl,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Broadcast to receiver for real-time notification
    broadcastToUser(receiverId, {
      type: "new_dm",
      message,
    });

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("Error sending DM:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/dm?id=xxx - Delete a DM (per-user)
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

    const message = await prisma.directMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 }
      );
    }

    // Check if user is sender or receiver
    if (message.senderId === session.user.id) {
      await prisma.directMessage.update({
        where: { id: messageId },
        data: { deletedBySender: true },
      });
    } else if (message.receiverId === session.user.id) {
      await prisma.directMessage.update({
        where: { id: messageId },
        data: { deletedByReceiver: true },
      });
    } else {
      return NextResponse.json(
        { success: false, error: "You don't have access to this message" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: messageId },
    });
  } catch (error) {
    console.error("Error deleting DM:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
