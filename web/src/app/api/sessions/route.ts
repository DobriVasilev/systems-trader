import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateUlid } from "@/lib/ulid";
import { validate, createSessionSchema } from "@/lib/validation";

// GET /api/sessions - List all sessions for current user
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const sessions = await prisma.patternSession.findMany({
      where: {
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
        _count: {
          select: {
            detections: true,
            corrections: true,
            comments: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create a new session
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

    // Validate input with Zod
    const validation = validate(createSessionSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { name, symbol, timeframe, patternType, patternSettings, candleData } = validation.data;

    const patternSession = await prisma.patternSession.create({
      data: {
        id: generateUlid(),
        name: name || `${symbol} ${timeframe} - ${patternType}`,
        symbol,
        timeframe,
        patternType,
        patternSettings: patternSettings ? JSON.parse(JSON.stringify(patternSettings)) : null,
        candleData: candleData ? JSON.parse(JSON.stringify(candleData)) : {},
        createdById: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: patternSession,
    });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create session" },
      { status: 500 }
    );
  }
}
