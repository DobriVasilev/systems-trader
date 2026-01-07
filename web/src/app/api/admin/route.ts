import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Helper to verify admin access
async function verifyAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "admin";
}

// GET /api/admin - Get all users and sessions for admin dashboard
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Verify admin access
  const isAdmin = await verifyAdmin(session.user.id);
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "overview";

    if (type === "users") {
      // Get all users with their session counts
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              createdSessions: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        success: true,
        data: users,
      });
    }

    if (type === "sessions") {
      // Get all sessions with feedback counts
      const sessions = await prisma.patternSession.findMany({
        select: {
          id: true,
          name: true,
          symbol: true,
          timeframe: true,
          patternType: true,
          status: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
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
        orderBy: { updatedAt: "desc" },
      });

      // Calculate total feedback (corrections have reasons, which are like comments)
      const sessionsWithFeedback = sessions.map((s) => ({
        ...s,
        feedbackCount: s._count.corrections + s._count.comments,
        hasFeedback: s._count.corrections > 0 || s._count.comments > 0,
      }));

      return NextResponse.json({
        success: true,
        data: sessionsWithFeedback,
      });
    }

    // Default: overview stats
    const [userCount, sessionCount, detectionCount, correctionCount, commentCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.patternSession.count(),
        prisma.patternDetection.count(),
        prisma.patternCorrection.count(),
        prisma.patternComment.count(),
      ]);

    // Sessions with feedback
    const sessionsWithFeedback = await prisma.patternSession.count({
      where: {
        OR: [
          { corrections: { some: {} } },
          { comments: { some: {} } },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        users: userCount,
        sessions: sessionCount,
        sessionsWithFeedback,
        detections: detectionCount,
        corrections: correctionCount,
        comments: commentCount,
        totalFeedback: correctionCount + commentCount,
      },
    });
  } catch (error) {
    console.error("Admin API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch admin data" },
      { status: 500 }
    );
  }
}
