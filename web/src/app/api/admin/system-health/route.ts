import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

const HEARTBEAT_FILE = "/tmp/feedback-watcher-heartbeat.json";

/**
 * GET /api/admin/system-health - Get system health metrics
 * Admin only
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    // Read watcher heartbeat
    let watcherStatus = {
      status: "unknown",
      lastHeartbeat: null as string | null,
      timeSinceHeartbeat: null as number | null,
    };

    try {
      if (fs.existsSync(HEARTBEAT_FILE)) {
        const heartbeatData = JSON.parse(fs.readFileSync(HEARTBEAT_FILE, "utf-8"));
        const lastHeartbeat = new Date(heartbeatData.timestamp);
        const now = new Date();
        const timeSinceMs = now.getTime() - lastHeartbeat.getTime();
        const timeSinceMinutes = Math.floor(timeSinceMs / 1000 / 60);

        watcherStatus = {
          status:
            timeSinceMinutes < 2
              ? "healthy"
              : timeSinceMinutes < 5
              ? "warning"
              : "error",
          lastHeartbeat: lastHeartbeat.toISOString(),
          timeSinceHeartbeat: timeSinceMinutes,
        };
      }
    } catch (error) {
      console.error("Error reading heartbeat:", error);
    }

    // Get feedback statistics
    const [total, pending, processing, analyzing, implementing, completed, failed] =
      await Promise.all([
        prisma.feedback.count(),
        prisma.feedback.count({ where: { implementationStatus: "PENDING" } }),
        prisma.feedback.count({ where: { implementationStatus: "PROCESSING" } }),
        prisma.feedback.count({ where: { implementationStatus: "ANALYZING" } }),
        prisma.feedback.count({ where: { implementationStatus: "IMPLEMENTING" } }),
        prisma.feedback.count({ where: { implementationStatus: "COMPLETED" } }),
        prisma.feedback.count({ where: { implementationStatus: "FAILED" } }),
      ]);

    const successRate =
      total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

    // Get activity metrics
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [last24h, last7d] = await Promise.all([
      prisma.feedback.count({
        where: {
          createdAt: { gte: yesterday },
        },
      }),
      prisma.feedback.count({
        where: {
          createdAt: { gte: weekAgo },
        },
      }),
    ]);

    // Calculate average processing time
    const completedFeedback = await prisma.feedback.findMany({
      where: {
        implementationStatus: "COMPLETED",
        processedAt: { not: null },
      },
      select: {
        createdAt: true,
        processedAt: true,
      },
      take: 50,
    });

    let avgProcessingTimeMinutes = 0;
    if (completedFeedback.length > 0) {
      const totalTime = completedFeedback.reduce((sum, fb) => {
        const diff = fb.processedAt!.getTime() - fb.createdAt.getTime();
        return sum + diff;
      }, 0);
      avgProcessingTimeMinutes = Math.round(
        totalTime / completedFeedback.length / 1000 / 60
      );
    }

    // Get recent failures
    const recentFailures = await prisma.feedback.findMany({
      where: {
        implementationStatus: "FAILED",
      },
      select: {
        id: true,
        title: true,
        errorMessage: true,
        retryCount: true,
        createdAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 5,
    });

    // Count dev team members
    const devTeamCount = await prisma.user.count({
      where: {
        role: "dev_team",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        watcher: watcherStatus,
        feedback: {
          total,
          pending,
          processing: processing + analyzing + implementing,
          completed,
          failed,
          successRate,
        },
        activity: {
          last24h,
          last7d,
          avgProcessingTimeMinutes,
        },
        users: {
          devTeam: devTeamCount,
        },
        recentFailures: recentFailures.map((fb) => ({
          id: fb.id,
          title: fb.title || "Untitled",
          errorMessage: fb.errorMessage,
          retryCount: fb.retryCount,
          createdAt: fb.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching system health:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch system health" },
      { status: 500 }
    );
  }
}
