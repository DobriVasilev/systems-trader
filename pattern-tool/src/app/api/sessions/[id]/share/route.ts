import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logSessionShared } from "@/lib/events";
import { broadcastSessionUpdated } from "@/lib/realtime";

// GET /api/sessions/[id]/share - Get all shares for a session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Only owner can see shares
    const patternSession = await prisma.patternSession.findFirst({
      where: {
        id,
        createdById: session.user.id,
      },
    });

    if (!patternSession) {
      return NextResponse.json(
        { success: false, error: "Session not found or not owner" },
        { status: 404 }
      );
    }

    const shares = await prisma.sessionShare.findMany({
      where: { sessionId: id },
      include: {
        user: {
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
      data: shares,
    });
  } catch (error) {
    console.error("Error fetching shares:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch shares" },
      { status: 500 }
    );
  }
}

// POST /api/sessions/[id]/share - Share session with a user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { email, permission = "view" } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate permission
    if (!["view", "comment", "edit", "admin"].includes(permission)) {
      return NextResponse.json(
        { success: false, error: "Invalid permission" },
        { status: 400 }
      );
    }

    // Only owner or admin can share
    const patternSession = await prisma.patternSession.findFirst({
      where: {
        id,
        OR: [
          { createdById: session.user.id },
          { shares: { some: { userId: session.user.id, permission: "admin" } } },
        ],
      },
    });

    if (!patternSession) {
      return NextResponse.json(
        { success: false, error: "Session not found or no permission" },
        { status: 404 }
      );
    }

    // Find user by email
    const userToShare = await prisma.user.findUnique({
      where: { email },
    });

    if (!userToShare) {
      return NextResponse.json(
        { success: false, error: "User not found. They must have an account first." },
        { status: 404 }
      );
    }

    // Can't share with yourself
    if (userToShare.id === session.user.id) {
      return NextResponse.json(
        { success: false, error: "Cannot share with yourself" },
        { status: 400 }
      );
    }

    // Can't share with owner
    if (userToShare.id === patternSession.createdById) {
      return NextResponse.json(
        { success: false, error: "Cannot share with the owner" },
        { status: 400 }
      );
    }

    // Check if already shared
    const existingShare = await prisma.sessionShare.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId: userToShare.id,
        },
      },
    });

    if (existingShare) {
      // Update permission
      const updated = await prisma.sessionShare.update({
        where: { id: existingShare.id },
        data: { permission },
        include: {
          user: {
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
        data: updated,
        message: "Permission updated",
      });
    }

    // Create share
    const share = await prisma.sessionShare.create({
      data: {
        sessionId: id,
        userId: userToShare.id,
        permission,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Broadcast and log
    await broadcastSessionUpdated(id);
    await logSessionShared(id, session.user.id, userToShare.id, permission);

    return NextResponse.json({
      success: true,
      data: share,
    });
  } catch (error) {
    console.error("Error sharing session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to share session" },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions/[id]/share - Remove share
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Only owner or admin can remove shares
    const patternSession = await prisma.patternSession.findFirst({
      where: {
        id,
        OR: [
          { createdById: session.user.id },
          { shares: { some: { userId: session.user.id, permission: "admin" } } },
        ],
      },
    });

    if (!patternSession) {
      return NextResponse.json(
        { success: false, error: "Session not found or no permission" },
        { status: 404 }
      );
    }

    // Delete the share
    await prisma.sessionShare.deleteMany({
      where: {
        sessionId: id,
        userId,
      },
    });

    await broadcastSessionUpdated(id);

    return NextResponse.json({
      success: true,
      message: "Share removed",
    });
  } catch (error) {
    console.error("Error removing share:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove share" },
      { status: 500 }
    );
  }
}

// PATCH /api/sessions/[id]/share - Update session public status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { isPublic } = body;

    if (typeof isPublic !== "boolean") {
      return NextResponse.json(
        { success: false, error: "isPublic must be a boolean" },
        { status: 400 }
      );
    }

    // Only owner can change public status
    const patternSession = await prisma.patternSession.findFirst({
      where: {
        id,
        createdById: session.user.id,
      },
    });

    if (!patternSession) {
      return NextResponse.json(
        { success: false, error: "Session not found or not owner" },
        { status: 404 }
      );
    }

    const updated = await prisma.patternSession.update({
      where: { id },
      data: { isPublic },
    });

    await broadcastSessionUpdated(id);

    return NextResponse.json({
      success: true,
      data: { isPublic: updated.isPublic },
    });
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update session" },
      { status: 500 }
    );
  }
}
