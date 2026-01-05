import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSessionEvents, getEventStats, EventType, EntityType } from "@/lib/events";

// GET /api/sessions/[id]/events - Get events for a session
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
    // Check access
    const patternSession = await prisma.patternSession.findFirst({
      where: {
        id,
        OR: [
          { createdById: session.user.id },
          { shares: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!patternSession) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const eventTypesParam = searchParams.get("eventTypes");
    const entityTypesParam = searchParams.get("entityTypes");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const statsOnly = searchParams.get("stats") === "true";

    // If stats only requested
    if (statsOnly) {
      const stats = await getEventStats(id);
      return NextResponse.json({
        success: true,
        data: stats,
      });
    }

    const eventTypes = eventTypesParam
      ? (eventTypesParam.split(",") as EventType[])
      : undefined;
    const entityTypes = entityTypesParam
      ? (entityTypesParam.split(",") as EntityType[])
      : undefined;

    const result = await getSessionEvents(id, {
      limit,
      offset,
      eventTypes,
      entityTypes,
      userId: userId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return NextResponse.json({
      success: true,
      data: result.events,
      pagination: {
        total: result.total,
        hasMore: result.hasMore,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
