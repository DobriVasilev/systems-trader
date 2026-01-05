import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/sessions/[id]/export - Export session data
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
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const includeCandles = searchParams.get("includeCandles") !== "false";
    const includeEvents = searchParams.get("includeEvents") === "true";

    // Check access
    const patternSession = await prisma.patternSession.findFirst({
      where: {
        id,
        OR: [
          { createdById: session.user.id },
          { shares: { some: { userId: session.user.id } } },
        ],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
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
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        comments: {
          where: { parentId: null },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            replies: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
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
              },
            },
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

    // Optionally include events
    let events = null;
    if (includeEvents) {
      events = await prisma.patternEvent.findMany({
        where: { sessionId: id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }

    // Build export data structure
    const exportData = {
      // Metadata
      exportVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: session.user.id,
        name: session.user.name,
      },

      // Session info
      session: {
        id: patternSession.id,
        name: patternSession.name,
        symbol: patternSession.symbol,
        timeframe: patternSession.timeframe,
        patternType: patternSession.patternType,
        patternVersion: patternSession.patternVersion,
        startTime: patternSession.startTime,
        endTime: patternSession.endTime,
        status: patternSession.status,
        description: patternSession.description,
        isPublic: patternSession.isPublic,
        createdAt: patternSession.createdAt,
        updatedAt: patternSession.updatedAt,
        createdBy: patternSession.createdBy,
      },

      // Candle data
      candleData: includeCandles ? patternSession.candleData : null,
      candleCount: Array.isArray((patternSession.candleData as { candles?: unknown[] })?.candles)
        ? (patternSession.candleData as { candles: unknown[] }).candles.length
        : 0,

      // Detections with analysis
      detections: {
        total: patternSession.detections.length,
        byStatus: {
          pending: patternSession.detections.filter((d) => d.status === "pending").length,
          confirmed: patternSession.detections.filter((d) => d.status === "confirmed").length,
          rejected: patternSession.detections.filter((d) => d.status === "rejected").length,
          moved: patternSession.detections.filter((d) => d.status === "moved").length,
        },
        byType: patternSession.detections.reduce((acc, d) => {
          acc[d.detectionType] = (acc[d.detectionType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        items: patternSession.detections.map((d) => ({
          id: d.id,
          candleIndex: d.candleIndex,
          candleTime: d.candleTime,
          price: d.price,
          detectionType: d.detectionType,
          structure: d.structure,
          confidence: d.confidence,
          status: d.status,
          metadata: d.metadata,
        })),
      },

      // Corrections with analysis
      corrections: {
        total: patternSession.corrections.length,
        byType: patternSession.corrections.reduce((acc, c) => {
          acc[c.correctionType] = (acc[c.correctionType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        items: patternSession.corrections.map((c) => ({
          id: c.id,
          correctionType: c.correctionType,
          detectionId: c.detectionId,
          reason: c.reason,
          originalPrice: c.originalPrice,
          correctedPrice: c.correctedPrice,
          status: c.status,
          user: c.user,
          createdAt: c.createdAt,
        })),
      },

      // Comments with analysis
      comments: {
        total: patternSession.comments.length + patternSession.comments.reduce((acc, c) => acc + c.replies.length, 0),
        resolved: patternSession.comments.filter((c) => c.resolved).length,
        threads: patternSession.comments.map((c) => ({
          id: c.id,
          content: c.content,
          detectionId: c.detectionId,
          resolved: c.resolved,
          user: c.user,
          createdAt: c.createdAt,
          replies: c.replies.map((r) => ({
            id: r.id,
            content: r.content,
            user: r.user,
            createdAt: r.createdAt,
          })),
        })),
      },

      // Collaborators
      collaborators: patternSession.shares.map((s) => ({
        user: s.user,
        permission: s.permission,
        sharedAt: s.createdAt,
      })),

      // Events (if requested)
      events: events
        ? {
            total: events.length,
            items: events.map((e) => ({
              id: e.id,
              eventType: e.eventType,
              entityType: e.entityType,
              entityId: e.entityId,
              payload: e.payload,
              user: e.user,
              createdAt: e.createdAt,
            })),
          }
        : null,

      // Summary statistics for Claude analysis
      summary: {
        detectionAccuracy: (() => {
          const total = patternSession.detections.length;
          if (total === 0) return null;
          const confirmed = patternSession.detections.filter((d) => d.status === "confirmed").length;
          const rejected = patternSession.detections.filter((d) => d.status === "rejected").length;
          const reviewed = confirmed + rejected;
          if (reviewed === 0) return null;
          return {
            reviewed: reviewed,
            confirmed: confirmed,
            rejected: rejected,
            accuracyRate: (confirmed / reviewed) * 100,
          };
        })(),
        correctionPatterns: (() => {
          const corrections = patternSession.corrections;
          if (corrections.length === 0) return null;
          return {
            mostCommonType: Object.entries(
              corrections.reduce((acc, c) => {
                acc[c.correctionType] = (acc[c.correctionType] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).sort((a, b) => b[1] - a[1])[0]?.[0],
            totalCorrections: corrections.length,
            reasons: corrections.map((c) => c.reason),
          };
        })(),
        collaborationMetrics: {
          totalCollaborators: patternSession.shares.length,
          totalComments: patternSession.comments.length,
          resolvedDiscussions: patternSession.comments.filter((c) => c.resolved).length,
        },
      },
    };

    if (format === "json") {
      return NextResponse.json({
        success: true,
        data: exportData,
      });
    }

    // Download as file
    const filename = `pattern-session-${patternSession.id}-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export session" },
      { status: 500 }
    );
  }
}
