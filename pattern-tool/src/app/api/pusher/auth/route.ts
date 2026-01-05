import { NextResponse } from "next/server";

/**
 * DEPRECATED: Pusher has been replaced with Upstash Redis + SSE
 *
 * Real-time connections now use:
 * - GET /api/sessions/[id]/realtime (SSE endpoint)
 * - POST /api/sessions/[id]/cursor (cursor broadcast)
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Pusher is no longer used. Real-time is now handled via SSE at /api/sessions/[id]/realtime",
    },
    { status: 410 } // Gone
  );
}
