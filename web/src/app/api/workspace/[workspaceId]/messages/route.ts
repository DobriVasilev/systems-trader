import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/workspace/[workspaceId]/messages - Get workspace messages
 *
 * Query params:
 * - executionId (optional): Filter by execution
 * - limit (optional): Number of messages to return (default: 50)
 * - type (optional): Filter by message type
 */
export async function GET(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const { workspaceId } = params;
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get("executionId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const type = searchParams.get("type");

    // Check workspace access
    const workspace = await prisma.patternWorkspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, createdById: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Build where clause
    const where: any = {
      workspaceId,
    };

    if (executionId) {
      where.executionId = executionId;
    }

    if (type) {
      where.type = type;
    }

    // Fetch messages
    const messages = await prisma.workspaceMessage.findMany({
      where,
      orderBy: {
        createdAt: "asc",
      },
      take: limit,
      select: {
        id: true,
        type: true,
        authorType: true,
        title: true,
        content: true,
        createdAt: true,
        data: true,
        status: true,
        progress: true,
      },
    });

    return NextResponse.json({
      success: true,
      messages: messages.map((msg) => ({
        ...msg,
        createdAt: msg.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching workspace messages:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
