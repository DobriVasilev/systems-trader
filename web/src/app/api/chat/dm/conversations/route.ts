import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/chat/dm/conversations - Get all DM conversations
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Get all messages where user is sender or receiver
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: session.user.id, deletedBySender: false },
          { receiverId: session.user.id, deletedByReceiver: false },
        ],
      },
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

    // Group by conversation partner
    const conversationsMap = new Map<
      string,
      {
        partner: { id: string; name: string | null; image: string | null };
        lastMessage: (typeof messages)[0];
        unreadCount: number;
      }
    >();

    for (const message of messages) {
      const partnerId =
        message.senderId === session.user.id
          ? message.receiverId
          : message.senderId;
      const partner =
        message.senderId === session.user.id
          ? message.receiver
          : message.sender;

      if (!conversationsMap.has(partnerId)) {
        conversationsMap.set(partnerId, {
          partner,
          lastMessage: message,
          unreadCount: 0,
        });
      }

      // Count unread messages
      if (
        message.receiverId === session.user.id &&
        !message.read
      ) {
        const conv = conversationsMap.get(partnerId)!;
        conv.unreadCount++;
      }
    }

    const conversations = Array.from(conversationsMap.values()).map(
      (conv) => ({
        partnerId: conv.partner.id,
        partnerName: conv.partner.name || "Anonymous",
        partnerAvatar: conv.partner.image,
        lastMessage: {
          id: conv.lastMessage.id,
          content: conv.lastMessage.content,
          createdAt: conv.lastMessage.createdAt,
          isFromMe: conv.lastMessage.senderId === session.user.id,
        },
        unreadCount: conv.unreadCount,
      })
    );

    return NextResponse.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
