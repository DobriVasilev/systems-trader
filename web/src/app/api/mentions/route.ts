import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/mentions - Get all mentions for the current user
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
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const mentions = await prisma.patternCommentMention.findMany({
      where: {
        userId: session.user.id,
        ...(unreadOnly ? { notified: false } : {}),
      },
      include: {
        comment: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                image: true,
              },
            },
            session: {
              select: {
                id: true,
                name: true,
                symbol: true,
                timeframe: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const totalCount = await prisma.patternCommentMention.count({
      where: {
        userId: session.user.id,
        ...(unreadOnly ? { notified: false } : {}),
      },
    });

    // Get unread count
    const unreadCount = await prisma.patternCommentMention.count({
      where: {
        userId: session.user.id,
        notified: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        mentions,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + mentions.length < totalCount,
        },
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Error fetching mentions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch mentions" },
      { status: 500 }
    );
  }
}

// PATCH /api/mentions - Mark mentions as read
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
    const { mentionIds, markAllRead } = body;

    if (markAllRead) {
      // Mark all unread mentions as read
      await prisma.patternCommentMention.updateMany({
        where: {
          userId: session.user.id,
          notified: false,
        },
        data: {
          notified: true,
          notifiedAt: new Date(),
        },
      });
    } else if (mentionIds && Array.isArray(mentionIds)) {
      // Mark specific mentions as read
      await prisma.patternCommentMention.updateMany({
        where: {
          id: { in: mentionIds },
          userId: session.user.id,
        },
        data: {
          notified: true,
          notifiedAt: new Date(),
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Either mentionIds or markAllRead is required" },
        { status: 400 }
      );
    }

    // Get updated unread count
    const unreadCount = await prisma.patternCommentMention.count({
      where: {
        userId: session.user.id,
        notified: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    console.error("Error marking mentions as read:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update mentions" },
      { status: 500 }
    );
  }
}
