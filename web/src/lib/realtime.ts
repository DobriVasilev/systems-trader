/**
 * Real-time broadcasting functions
 *
 * Uses Upstash Redis for message passing.
 * Clients connect via Server-Sent Events (SSE).
 */

import {
  publishToSession,
  REALTIME_EVENTS,
  type RealtimeEvent,
} from "./upstash-realtime";

// Re-export for convenience
export { REALTIME_EVENTS, type RealtimeEvent } from "./upstash-realtime";
export {
  getSessionChannel,
  getPresenceChannel,
  getRecentMessages,
  joinSession,
  leaveSession,
  getSessionMembers,
  heartbeat,
  isRealtimeConfigured,
  type CursorPosition,
  type PresenceMember,
  type RealtimeMessage,
} from "./upstash-realtime";

/**
 * Broadcast a real-time event to all subscribers of a session
 */
export async function broadcastSessionEvent(
  sessionId: string,
  event: RealtimeEvent,
  data: Record<string, unknown> = {}
): Promise<void> {
  await publishToSession(sessionId, event, data);
}

/**
 * Broadcast detection changes
 */
export async function broadcastDetectionCreated(
  sessionId: string,
  detectionId: string
): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.DETECTION_CREATED, {
    detectionId,
  });
}

export async function broadcastDetectionUpdated(
  sessionId: string,
  detectionId: string
): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.DETECTION_UPDATED, {
    detectionId,
  });
}

export async function broadcastDetectionDeleted(
  sessionId: string,
  detectionId: string
): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.DETECTION_DELETED, {
    detectionId,
  });
}

export async function broadcastDetectionsBatch(
  sessionId: string,
  count: number
): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.DETECTIONS_BATCH, {
    count,
  });
}

/**
 * Broadcast correction changes
 */
export async function broadcastCorrectionCreated(
  sessionId: string,
  correctionId: string,
  userId: string
): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.CORRECTION_CREATED, {
    correctionId,
    userId,
  });
}

export async function broadcastCorrectionUpdated(
  sessionId: string,
  correctionId: string
): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.CORRECTION_UPDATED, {
    correctionId,
  });
}

/**
 * Broadcast comment changes
 */
export async function broadcastCommentCreated(
  sessionId: string,
  commentId: string,
  userId: string
): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.COMMENT_CREATED, {
    commentId,
    userId,
  });
}

export async function broadcastCommentUpdated(
  sessionId: string,
  commentId: string
): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.COMMENT_UPDATED, {
    commentId,
  });
}

export async function broadcastCommentDeleted(
  sessionId: string,
  commentId: string
): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.COMMENT_DELETED, {
    commentId,
  });
}

/**
 * Broadcast session changes
 */
export async function broadcastSessionUpdated(sessionId: string): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.SESSION_UPDATED, {});
}

/**
 * Broadcast vote changes
 */
export async function broadcastVoteChanged(
  sessionId: string,
  targetType: "comment" | "correction",
  targetId: string,
  upvotes: number,
  downvotes: number,
  score: number
): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.VOTE_CHANGED, {
    targetType,
    targetId,
    upvotes,
    downvotes,
    score,
  });
}

/**
 * Broadcast feed item created (for "new items" banner)
 */
export async function broadcastFeedItemCreated(
  sessionId: string,
  itemType: "correction" | "comment",
  itemId: string,
  parentId?: string
): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.FEED_ITEM_CREATED, {
    itemType,
    itemId,
    parentId,
  });
}

/**
 * Broadcast cursor movement
 */
export async function broadcastCursorMove(
  sessionId: string,
  userId: string,
  x: number,
  y: number,
  userName: string,
  userImage?: string
): Promise<void> {
  await publishToSession(sessionId, REALTIME_EVENTS.CURSOR_MOVE, {
    userId,
    x,
    y,
    userName,
    userImage,
  });
}
