import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/chat/friends - Get friend requests and friends list
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
    const type = searchParams.get("type") || "pending"; // pending, friends, sent

    if (type === "pending") {
      // Get pending friend requests received
      const requests = await prisma.friendRequest.findMany({
        where: {
          receiverId: session.user.id,
          status: "pending",
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        success: true,
        data: requests,
      });
    }

    if (type === "sent") {
      // Get friend requests sent
      const requests = await prisma.friendRequest.findMany({
        where: {
          senderId: session.user.id,
          status: "pending",
        },
        include: {
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        success: true,
        data: requests,
      });
    }

    if (type === "friends") {
      // Get friends (accepted relationships)
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { user1Id: session.user.id },
            { user2Id: session.user.id },
          ],
          // Neither user has blocked the other
          blockedByUser1: false,
          blockedByUser2: false,
        },
        include: {
          user1: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          user2: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      // Map to just the friend user
      const friends = friendships.map((f) => {
        return f.user1Id === session.user.id ? f.user2 : f.user1;
      });

      return NextResponse.json({
        success: true,
        data: friends,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid type parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching friend data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch friend data" },
      { status: 500 }
    );
  }
}

// POST /api/chat/friends - Send friend request
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
    const { receiverId, message } = body;

    if (!receiverId) {
      return NextResponse.json(
        { success: false, error: "Receiver ID is required" },
        { status: 400 }
      );
    }

    // Can't send request to yourself
    if (receiverId === session.user.id) {
      return NextResponse.json(
        { success: false, error: "Cannot send request to yourself" },
        { status: 400 }
      );
    }

    // Check if receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Check if already friends
    const sortedIds = [session.user.id, receiverId].sort();
    const existingFriendship = await prisma.friendship.findUnique({
      where: {
        user1Id_user2Id: {
          user1Id: sortedIds[0],
          user2Id: sortedIds[1],
        },
      },
    });

    if (existingFriendship) {
      return NextResponse.json(
        { success: false, error: "Already friends with this user" },
        { status: 400 }
      );
    }

    // Check if request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: session.user.id, receiverId },
          { senderId: receiverId, receiverId: session.user.id },
        ],
        status: "pending",
      },
    });

    if (existingRequest) {
      // If they sent us a request, auto-accept it
      if (existingRequest.senderId === receiverId) {
        await acceptFriendRequest(existingRequest.id, session.user.id);
        return NextResponse.json({
          success: true,
          data: { action: "auto_accepted" },
          message: "Friend request accepted!",
        });
      }

      return NextResponse.json(
        { success: false, error: "Friend request already sent" },
        { status: 400 }
      );
    }

    // Create friend request
    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId: session.user.id,
        receiverId,
        message,
      },
      include: {
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: friendRequest,
    });
  } catch (error) {
    console.error("Error sending friend request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send friend request" },
      { status: 500 }
    );
  }
}

// PATCH /api/chat/friends - Accept/decline friend request
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
    const { requestId, action } = body; // action: accept, decline, block

    if (!requestId || !action) {
      return NextResponse.json(
        { success: false, error: "Request ID and action are required" },
        { status: 400 }
      );
    }

    // Get the request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!friendRequest || friendRequest.receiverId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Friend request not found" },
        { status: 404 }
      );
    }

    if (friendRequest.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Request already processed" },
        { status: 400 }
      );
    }

    if (action === "accept") {
      await acceptFriendRequest(requestId, session.user.id);
      return NextResponse.json({
        success: true,
        message: "Friend request accepted",
      });
    }

    if (action === "decline") {
      await prisma.friendRequest.update({
        where: { id: requestId },
        data: {
          status: "declined",
          respondedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Friend request declined",
      });
    }

    if (action === "block") {
      await prisma.friendRequest.update({
        where: { id: requestId },
        data: {
          status: "blocked",
          respondedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "User blocked",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error processing friend request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process friend request" },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/friends - Remove friend or cancel request
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
    const friendId = searchParams.get("friendId");
    const requestId = searchParams.get("requestId");

    if (requestId) {
      // Cancel sent request
      await prisma.friendRequest.deleteMany({
        where: {
          id: requestId,
          senderId: session.user.id,
          status: "pending",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Request cancelled",
      });
    }

    if (friendId) {
      // Remove friend
      const sortedIds = [session.user.id, friendId].sort();

      await prisma.friendship.delete({
        where: {
          user1Id_user2Id: {
            user1Id: sortedIds[0],
            user2Id: sortedIds[1],
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Friend removed",
      });
    }

    return NextResponse.json(
      { success: false, error: "Friend ID or request ID required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error removing friend:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove friend" },
      { status: 500 }
    );
  }
}

// Helper function to accept a friend request
async function acceptFriendRequest(requestId: string, userId: string) {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) return;

  // Sort IDs for consistent storage
  const sortedIds = [request.senderId, request.receiverId].sort();

  // Create friendship and update request in a transaction
  await prisma.$transaction([
    prisma.friendRequest.update({
      where: { id: requestId },
      data: {
        status: "accepted",
        respondedAt: new Date(),
      },
    }),
    prisma.friendship.create({
      data: {
        user1Id: sortedIds[0],
        user2Id: sortedIds[1],
      },
    }),
  ]);
}
