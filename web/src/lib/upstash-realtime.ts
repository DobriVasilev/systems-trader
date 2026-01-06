/**
 * Upstash Redis-based Real-time System
 *
 * Replaces Pusher with Upstash Redis pub/sub + Server-Sent Events (SSE).
 * This is FREE with Upstash's free tier (10k messages/day).
 */

import { Redis } from "@upstash/redis";

// Redis client for pub/sub
const redis = process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    })
  : null;

// Channel naming conventions
export function getSessionChannel(sessionId: string): string {
  return `session:${sessionId}`;
}

export function getPresenceChannel(sessionId: string): string {
  return `presence:${sessionId}`;
}

// Event types
export const REALTIME_EVENTS = {
  // Detection events
  DETECTION_CREATED: "detection:created",
  DETECTION_UPDATED: "detection:updated",
  DETECTION_DELETED: "detection:deleted",
  DETECTIONS_BATCH: "detections:batch",

  // Correction events
  CORRECTION_CREATED: "correction:created",
  CORRECTION_UPDATED: "correction:updated",

  // Comment events
  COMMENT_CREATED: "comment:created",
  COMMENT_UPDATED: "comment:updated",
  COMMENT_DELETED: "comment:deleted",

  // Vote events
  VOTE_CHANGED: "vote:changed",

  // Feed events
  FEED_ITEM_CREATED: "feed:item:created",

  // Session events
  SESSION_UPDATED: "session:updated",

  // Presence events
  USER_JOINED: "user:joined",
  USER_LEFT: "user:left",

  // Cursor tracking
  CURSOR_MOVE: "cursor:move",
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

// Payload types
export interface CursorPosition {
  x: number;
  y: number;
  userId: string;
  userName: string;
  userImage?: string;
}

export interface PresenceMember {
  id: string;
  name: string;
  email: string;
  image?: string;
  joinedAt: number;
}

export interface RealtimeMessage {
  event: RealtimeEvent;
  data: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
}

/**
 * Publish a message to a session channel
 * Uses Redis LPUSH to store messages in a list (for SSE polling)
 */
export async function publishToSession(
  sessionId: string,
  event: RealtimeEvent,
  data: Record<string, unknown> = {}
): Promise<boolean> {
  if (!redis) {
    console.warn("[realtime] Redis not configured, skipping publish");
    return false;
  }

  try {
    const channel = getSessionChannel(sessionId);
    const message: RealtimeMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId,
    };

    // Store message in a list (TTL of 60 seconds)
    await redis.lpush(channel, JSON.stringify(message));
    await redis.ltrim(channel, 0, 99); // Keep last 100 messages
    await redis.expire(channel, 60); // Expire after 60 seconds

    return true;
  } catch (error) {
    console.error("[realtime] Failed to publish:", error);
    return false;
  }
}

/**
 * Get recent messages for a session (for SSE)
 */
export async function getRecentMessages(
  sessionId: string,
  since?: number
): Promise<RealtimeMessage[]> {
  if (!redis) {
    return [];
  }

  try {
    const channel = getSessionChannel(sessionId);
    const messages = await redis.lrange(channel, 0, 49);

    return messages
      .map((msg) => {
        try {
          return typeof msg === "string" ? JSON.parse(msg) : msg;
        } catch {
          return null;
        }
      })
      .filter((msg): msg is RealtimeMessage => {
        if (!msg) return false;
        if (since && msg.timestamp <= since) return false;
        return true;
      })
      .reverse(); // Oldest first
  } catch (error) {
    console.error("[realtime] Failed to get messages:", error);
    return [];
  }
}

/**
 * Presence tracking - add user to session
 */
export async function joinSession(
  sessionId: string,
  user: { id: string; name: string; email: string; image?: string }
): Promise<void> {
  if (!redis) return;

  try {
    const channel = getPresenceChannel(sessionId);
    const member: PresenceMember = {
      ...user,
      joinedAt: Date.now(),
    };

    // Add to presence set
    await redis.hset(channel, { [user.id]: JSON.stringify(member) });
    await redis.expire(channel, 300); // 5 minute TTL (refresh on heartbeat)

    // Broadcast join event
    await publishToSession(sessionId, REALTIME_EVENTS.USER_JOINED, {
      userId: user.id,
      userName: user.name,
      userImage: user.image,
    });
  } catch (error) {
    console.error("[realtime] Failed to join session:", error);
  }
}

/**
 * Presence tracking - remove user from session
 */
export async function leaveSession(
  sessionId: string,
  userId: string
): Promise<void> {
  if (!redis) return;

  try {
    const channel = getPresenceChannel(sessionId);
    await redis.hdel(channel, userId);

    // Broadcast leave event
    await publishToSession(sessionId, REALTIME_EVENTS.USER_LEFT, {
      userId,
    });
  } catch (error) {
    console.error("[realtime] Failed to leave session:", error);
  }
}

/**
 * Get all users in a session
 */
export async function getSessionMembers(
  sessionId: string
): Promise<PresenceMember[]> {
  if (!redis) return [];

  try {
    const channel = getPresenceChannel(sessionId);
    const members = await redis.hgetall(channel);

    if (!members) return [];

    return Object.values(members)
      .map((m) => {
        try {
          return typeof m === "string" ? JSON.parse(m) : m;
        } catch {
          return null;
        }
      })
      .filter((m): m is PresenceMember => m !== null);
  } catch (error) {
    console.error("[realtime] Failed to get members:", error);
    return [];
  }
}

/**
 * Heartbeat to keep user in session
 */
export async function heartbeat(
  sessionId: string,
  userId: string
): Promise<void> {
  if (!redis) return;

  try {
    const channel = getPresenceChannel(sessionId);
    await redis.expire(channel, 300); // Refresh TTL
  } catch (error) {
    console.error("[realtime] Heartbeat failed:", error);
  }
}

/**
 * Check if Redis is configured
 */
export function isRealtimeConfigured(): boolean {
  return redis !== null;
}
