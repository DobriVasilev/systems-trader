import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/sessions/[id] - Get a specific session
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
    const patternSession = await prisma.patternSession.findFirst({
      where: {
        id,
        OR: [
          { createdById: session.user.id },
          {
            shares: {
              some: {
                userId: session.user.id,
              },
            },
          },
        ],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        detections: {
          orderBy: { candleTime: "asc" },
        },
        corrections: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        shares: {
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
        },
        _count: {
          select: {
            detections: true,
            corrections: true,
            comments: true,
          },
        },
      },
    });

    if (!patternSession) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: patternSession,
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

// PATCH /api/sessions/[id] - Update a session
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
    // Check ownership or edit permission
    const existingSession = await prisma.patternSession.findFirst({
      where: {
        id,
        OR: [
          { createdById: session.user.id },
          {
            shares: {
              some: {
                userId: session.user.id,
                permission: { in: ["edit", "admin"] },
              },
            },
          },
        ],
      },
    });

    if (!existingSession) {
      return NextResponse.json(
        { success: false, error: "Session not found or no permission" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, candleData, status } = body;

    const updatedSession = await prisma.patternSession.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(candleData && { candleData }),
        ...(status && { status }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedSession,
    });
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update session" },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions/[id] - Delete a session
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
    // Only owner can delete
    const existingSession = await prisma.patternSession.findFirst({
      where: {
        id,
        createdById: session.user.id,
      },
    });

    if (!existingSession) {
      return NextResponse.json(
        { success: false, error: "Session not found or no permission" },
        { status: 404 }
      );
    }

    await prisma.patternSession.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Session deleted",
    });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
