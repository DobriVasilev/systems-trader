import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { broadcastCursorMove } from "@/lib/realtime";

/**
 * POST /api/sessions/[id]/cursor
 * Broadcast cursor position to other users
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id: sessionId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { x, y, userName, userImage } = body;

    if (typeof x !== "number" || typeof y !== "number") {
      return NextResponse.json({ error: "Invalid cursor position" }, { status: 400 });
    }

    await broadcastCursorMove(
      sessionId,
      session.user.id,
      x,
      y,
      userName || session.user.name || "Anonymous",
      userImage || session.user.image
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[cursor] Error broadcasting:", error);
    return NextResponse.json({ error: "Failed to broadcast cursor" }, { status: 500 });
  }
}
