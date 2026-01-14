import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as fs from "fs";

/**
 * System Health Monitoring API
 * Returns health metrics for the autonomous feedback system
 * Admin only
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Only admins can view system health
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    // Check watcher heartbeat
    let watcherStatus = "unknown";
    let lastHeartbeat: Date | null = null;
    const heartbeatPath = "/tmp/feedback-watcher-heartbeat.txt";

    try {
      if (fs.existsSync(heartbeatPath)) {
        const heartbeatTime = parseInt(fs.readFileSync(heartbeatPath, "utf8"));
        lastHeartbeat = new Date(heartbeatTime);
        const timeSinceHeartbeat = Date.now() - heartbeatTime;

        if (timeSinceHeartbeat < 30000) {
          // Less than 30s - healthy
          watcherStatus = "healthy";
        } else if (timeSinceHeartbeat < 60000) {
          // 30-60s - warning
          watcherStatus = "warning";
        } else {
          // More than 60s - unhealthy
          watcherStatus = "unhealthy";
        }
      } else {
        watcherStatus = "not_running";
      }
    } catch (error) {
      watcherStatus = "error";
    }

    // Get feedback statistics
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalFeedback,
      pendingFeedback,
      processingFeedback,
      completedFeedback,
      failedFeedback,
      feedbackLast24h,
      feedbackLast7d,
      avgProcessingTime,
    ] = await Promise.all([
      // Total feedback count
      prisma.feedback.count(),

      // Pending count
      prisma.feedback.count({
        where: { implementationStatus: "PENDING" },
      }),

      // Processing count (any in-progress status)
      prisma.feedback.count({
        where: {
          implementationStatus: {
            in: ["PROCESSING", "ANALYZING", "IMPLEMENTING", "TESTING", "DEPLOYING"],
          },
        },
      }),

      // Completed count
      prisma.feedback.count({
        where: { implementationStatus: "COMPLETED" },
      }),

      // Failed count
      prisma.feedback.count({
        where: { implementationStatus: "FAILED" },
      }),

      // Last 24h submissions
      prisma.feedback.count({
        where: {
          createdAt: { gte: last24h },
        },
      }),

      // Last 7d submissions
      prisma.feedback.count({
        where: {
          createdAt: { gte: last7d },
        },
      }),

      // Average processing time (completed in last 7 days)
      prisma.feedback.aggregate({
        where: {
          implementationStatus: "COMPLETED",
          processedAt: { not: null },
          AND: [
            { completedAt: { not: null } },
            { completedAt: { gte: last7d } },
          ],
        },
        _avg: {
          // This won't work directly, need to calculate in application
        },
      }),
    ]);

    // Calculate average processing time properly
    const completedRecent = await prisma.feedback.findMany({
      where: {
        implementationStatus: "COMPLETED",
        processedAt: { not: null },
        completedAt: { not: null },
        completedAt: { gte: last7d },
      },
      select: {
        processedAt: true,
        completedAt: true,
      },
    });

    const avgProcessingTimeMs =
      completedRecent.length > 0
        ? completedRecent.reduce((sum, f) => {
            const duration = f.completedAt!.getTime() - f.processedAt!.getTime();
            return sum + duration;
          }, 0) / completedRecent.length
        : 0;

    const avgProcessingTimeMinutes = Math.round(avgProcessingTimeMs / 1000 / 60);

    // Get recent failures
    const recentFailures = await prisma.feedback.findMany({
      where: {
        implementationStatus: "FAILED",
        processedAt: { gte: last24h },
      },
      select: {
        id: true,
        title: true,
        textContent: true,
        errorMessage: true,
        processedAt: true,
        retryCount: true,
      },
      orderBy: {
        processedAt: "desc",
      },
      take: 10,
    });

    // Get dev_team user count
    const devTeamCount = await prisma.user.count({
      where: { role: "dev_team" },
    });

    // Build health report
    const health = {
      timestamp: new Date().toISOString(),
      watcher: {
        status: watcherStatus,
        lastHeartbeat: lastHeartbeat?.toISOString() || null,
        timeSinceHeartbeat: lastHeartbeat
          ? Math.round((Date.now() - lastHeartbeat.getTime()) / 1000)
          : null,
      },
      feedback: {
        total: totalFeedback,
        pending: pendingFeedback,
        processing: processingFeedback,
        completed: completedFeedback,
        failed: failedFeedback,
        successRate:
          completedFeedback + failedFeedback > 0
            ? Math.round(
                (completedFeedback / (completedFeedback + failedFeedback)) * 100
              )
            : 0,
      },
      activity: {
        last24h: feedbackLast24h,
        last7d: feedbackLast7d,
        avgProcessingTimeMinutes,
      },
      users: {
        devTeam: devTeamCount,
      },
      recentFailures: recentFailures.map((f) => ({
        id: f.id,
        title: f.title || f.textContent?.substring(0, 100),
        error: f.errorMessage,
        retryCount: f.retryCount,
        failedAt: f.processedAt?.toISOString(),
      })),
    };

    return NextResponse.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error("Error fetching system health:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch system health" },
      { status: 500 }
    );
  }
}
