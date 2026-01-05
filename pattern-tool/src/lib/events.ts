import { prisma } from "./db";
import { generateUlid } from "./ulid";

/**
 * Event Types for the audit trail
 */
export const EVENT_TYPES = {
  // Session events
  SESSION_CREATED: "session.created",
  SESSION_UPDATED: "session.updated",
  SESSION_DELETED: "session.deleted",
  SESSION_SHARED: "session.shared",
  SESSION_UNSHARED: "session.unshared",
  SESSION_STATUS_CHANGED: "session.status_changed",

  // Detection events
  DETECTION_BATCH_CREATED: "detection.batch_created",
  DETECTION_CREATED: "detection.created",
  DETECTION_UPDATED: "detection.updated",
  DETECTION_DELETED: "detection.deleted",
  DETECTION_CONFIRMED: "detection.confirmed",
  DETECTION_REJECTED: "detection.rejected",

  // Correction events
  CORRECTION_CREATED: "correction.created",
  CORRECTION_UPDATED: "correction.updated",
  CORRECTION_APPLIED: "correction.applied",
  CORRECTION_DISPUTED: "correction.disputed",

  // Comment events
  COMMENT_CREATED: "comment.created",
  COMMENT_UPDATED: "comment.updated",
  COMMENT_DELETED: "comment.deleted",
  COMMENT_RESOLVED: "comment.resolved",
  COMMENT_REOPENED: "comment.reopened",

  // Collaboration events
  USER_JOINED: "collaboration.user_joined",
  USER_LEFT: "collaboration.user_left",
  CURSOR_ACTIVITY: "collaboration.cursor_activity",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

/**
 * Entity types that can be referenced in events
 */
export const ENTITY_TYPES = {
  SESSION: "session",
  DETECTION: "detection",
  CORRECTION: "correction",
  COMMENT: "comment",
  USER: "user",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

/**
 * Event payload structure
 */
export interface EventPayload {
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Options for creating an event
 */
export interface CreateEventOptions {
  sessionId: string;
  userId: string;
  eventType: EventType;
  entityType?: EntityType;
  entityId?: string;
  payload: EventPayload;
  canvasSnapshot?: Record<string, unknown>;
}

/**
 * Create an event in the audit trail
 */
export async function createEvent(options: CreateEventOptions): Promise<string> {
  const {
    sessionId,
    userId,
    eventType,
    entityType,
    entityId,
    payload,
    canvasSnapshot,
  } = options;

  try {
    const event = await prisma.patternEvent.create({
      data: {
        id: generateUlid(),
        sessionId,
        userId,
        eventType,
        entityType: entityType || null,
        entityId: entityId || null,
        payload: JSON.parse(JSON.stringify(payload)),
        canvasSnapshot: canvasSnapshot ? JSON.parse(JSON.stringify(canvasSnapshot)) : null,
      },
    });

    return event.id;
  } catch (error) {
    // Log but don't throw - event logging should not block main operations
    console.error("Failed to create event:", error);
    return "";
  }
}

/**
 * Create multiple events in a batch
 */
export async function createEventsBatch(
  events: CreateEventOptions[]
): Promise<number> {
  try {
    const result = await prisma.patternEvent.createMany({
      data: events.map((e) => ({
        id: generateUlid(),
        sessionId: e.sessionId,
        userId: e.userId,
        eventType: e.eventType,
        entityType: e.entityType || null,
        entityId: e.entityId || null,
        payload: JSON.parse(JSON.stringify(e.payload)),
        canvasSnapshot: e.canvasSnapshot ? JSON.parse(JSON.stringify(e.canvasSnapshot)) : null,
      })),
    });

    return result.count;
  } catch (error) {
    console.error("Failed to create events batch:", error);
    return 0;
  }
}

/**
 * Helper functions for common event types
 */

export async function logSessionCreated(
  sessionId: string,
  userId: string,
  sessionData: Record<string, unknown>
): Promise<string> {
  return createEvent({
    sessionId,
    userId,
    eventType: EVENT_TYPES.SESSION_CREATED,
    entityType: ENTITY_TYPES.SESSION,
    entityId: sessionId,
    payload: {
      action: "create",
      after: sessionData,
    },
  });
}

export async function logSessionUpdated(
  sessionId: string,
  userId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Promise<string> {
  return createEvent({
    sessionId,
    userId,
    eventType: EVENT_TYPES.SESSION_UPDATED,
    entityType: ENTITY_TYPES.SESSION,
    entityId: sessionId,
    payload: {
      action: "update",
      before,
      after,
    },
  });
}

export async function logDetectionBatchCreated(
  sessionId: string,
  userId: string,
  count: number,
  patternType: string
): Promise<string> {
  return createEvent({
    sessionId,
    userId,
    eventType: EVENT_TYPES.DETECTION_BATCH_CREATED,
    entityType: ENTITY_TYPES.DETECTION,
    payload: {
      action: "batch_create",
      metadata: {
        count,
        patternType,
        timestamp: new Date().toISOString(),
      },
    },
  });
}

export async function logDetectionCreated(
  sessionId: string,
  userId: string,
  detectionId: string,
  detectionData: Record<string, unknown>
): Promise<string> {
  return createEvent({
    sessionId,
    userId,
    eventType: EVENT_TYPES.DETECTION_CREATED,
    entityType: ENTITY_TYPES.DETECTION,
    entityId: detectionId,
    payload: {
      action: "create",
      after: detectionData,
    },
  });
}

export async function logDetectionStatusChanged(
  sessionId: string,
  userId: string,
  detectionId: string,
  oldStatus: string,
  newStatus: string
): Promise<string> {
  const eventType =
    newStatus === "confirmed"
      ? EVENT_TYPES.DETECTION_CONFIRMED
      : newStatus === "rejected"
      ? EVENT_TYPES.DETECTION_REJECTED
      : EVENT_TYPES.DETECTION_UPDATED;

  return createEvent({
    sessionId,
    userId,
    eventType,
    entityType: ENTITY_TYPES.DETECTION,
    entityId: detectionId,
    payload: {
      action: "status_change",
      before: { status: oldStatus },
      after: { status: newStatus },
    },
  });
}

export async function logCorrectionCreated(
  sessionId: string,
  userId: string,
  correctionId: string,
  correctionData: Record<string, unknown>
): Promise<string> {
  return createEvent({
    sessionId,
    userId,
    eventType: EVENT_TYPES.CORRECTION_CREATED,
    entityType: ENTITY_TYPES.CORRECTION,
    entityId: correctionId,
    payload: {
      action: "create",
      after: correctionData,
      metadata: {
        correctionType: correctionData.correctionType,
        detectionId: correctionData.detectionId,
      },
    },
  });
}

export async function logCommentCreated(
  sessionId: string,
  userId: string,
  commentId: string,
  commentData: Record<string, unknown>
): Promise<string> {
  return createEvent({
    sessionId,
    userId,
    eventType: EVENT_TYPES.COMMENT_CREATED,
    entityType: ENTITY_TYPES.COMMENT,
    entityId: commentId,
    payload: {
      action: "create",
      after: {
        content: commentData.content,
        detectionId: commentData.detectionId,
        correctionId: commentData.correctionId,
        parentId: commentData.parentId,
      },
    },
  });
}

export async function logCommentUpdated(
  sessionId: string,
  userId: string,
  commentId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Promise<string> {
  return createEvent({
    sessionId,
    userId,
    eventType: EVENT_TYPES.COMMENT_UPDATED,
    entityType: ENTITY_TYPES.COMMENT,
    entityId: commentId,
    payload: {
      action: "update",
      before,
      after,
    },
  });
}

export async function logCommentResolved(
  sessionId: string,
  userId: string,
  commentId: string,
  resolved: boolean
): Promise<string> {
  return createEvent({
    sessionId,
    userId,
    eventType: resolved ? EVENT_TYPES.COMMENT_RESOLVED : EVENT_TYPES.COMMENT_REOPENED,
    entityType: ENTITY_TYPES.COMMENT,
    entityId: commentId,
    payload: {
      action: resolved ? "resolve" : "reopen",
      after: { resolved },
    },
  });
}

export async function logCommentDeleted(
  sessionId: string,
  userId: string,
  commentId: string,
  commentContent: string
): Promise<string> {
  return createEvent({
    sessionId,
    userId,
    eventType: EVENT_TYPES.COMMENT_DELETED,
    entityType: ENTITY_TYPES.COMMENT,
    entityId: commentId,
    payload: {
      action: "delete",
      before: { content: commentContent },
    },
  });
}

export async function logSessionShared(
  sessionId: string,
  userId: string,
  sharedWithUserId: string,
  permission: string
): Promise<string> {
  return createEvent({
    sessionId,
    userId,
    eventType: EVENT_TYPES.SESSION_SHARED,
    entityType: ENTITY_TYPES.SESSION,
    entityId: sessionId,
    payload: {
      action: "share",
      after: {
        sharedWithUserId,
        permission,
      },
    },
  });
}

/**
 * Get events for a session with pagination
 */
export async function getSessionEvents(
  sessionId: string,
  options: {
    limit?: number;
    offset?: number;
    eventTypes?: EventType[];
    entityTypes?: EntityType[];
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
) {
  const {
    limit = 50,
    offset = 0,
    eventTypes,
    entityTypes,
    userId,
    startDate,
    endDate,
  } = options;

  const where: Record<string, unknown> = { sessionId };

  if (eventTypes && eventTypes.length > 0) {
    where.eventType = { in: eventTypes };
  }

  if (entityTypes && entityTypes.length > 0) {
    where.entityType = { in: entityTypes };
  }

  if (userId) {
    where.userId = userId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      (where.createdAt as Record<string, unknown>).gte = startDate;
    }
    if (endDate) {
      (where.createdAt as Record<string, unknown>).lte = endDate;
    }
  }

  const [events, total] = await Promise.all([
    prisma.patternEvent.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.patternEvent.count({ where }),
  ]);

  return {
    events,
    total,
    hasMore: offset + events.length < total,
  };
}

/**
 * Get event statistics for a session
 */
export async function getEventStats(sessionId: string) {
  const [byType, byUser, byDay] = await Promise.all([
    // Group by event type
    prisma.patternEvent.groupBy({
      by: ["eventType"],
      where: { sessionId },
      _count: true,
    }),

    // Group by user
    prisma.patternEvent.groupBy({
      by: ["userId"],
      where: { sessionId },
      _count: true,
    }),

    // Activity timeline (last 30 days)
    prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM "PatternEvent"
      WHERE session_id = ${sessionId}
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `,
  ]);

  return {
    byType: byType.map((t) => ({ type: t.eventType, count: t._count })),
    byUser: byUser.map((u) => ({ userId: u.userId, count: u._count })),
    timeline: byDay,
  };
}
