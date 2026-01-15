import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/pattern-corrections - Get all pattern corrections
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
    const corrections = await prisma.patternCorrection.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: corrections,
    });
  } catch (error) {
    console.error("Error fetching pattern corrections:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch pattern corrections" },
      { status: 500 }
    );
  }
}
