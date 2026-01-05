"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { REALTIME_EVENTS } from "@/lib/realtime";

interface PresenceMember {
  id: string;
  name: string;
  email: string;
  image?: string;
  joinedAt: number;
}

interface CursorPosition {
  x: number;
  y: number;
  userId: string;
  userName: string;
  userImage?: string;
}

interface RealtimeMessage {
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
}

interface UseRealtimeOptions {
  sessionId: string;
  onDetectionChange?: () => void;
  onCorrectionChange?: () => void;
  onCommentChange?: () => void;
  onSessionChange?: () => void;
  enabled?: boolean;
}

interface UseRealtimeResult {
  isConnected: boolean;
  onlineUsers: PresenceMember[];
  cursors: Map<string, CursorPosition>;
  broadcastCursor: (x: number, y: number, userName: string, userImage?: string) => void;
}

export function useRealtime({
  sessionId,
  onDetectionChange,
  onCorrectionChange,
  onCommentChange,
  onSessionChange,
  enabled = true,
}: UseRealtimeOptions): UseRealtimeResult {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<PresenceMember[]>([]);
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());

  const eventSourceRef = useRef<EventSource | null>(null);
  const cursorTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Broadcast cursor position to other users via API
  const broadcastCursor = useCallback(
    async (x: number, y: number, userName: string, userImage?: string) => {
      if (!sessionId) return;

      try {
        await fetch(`/api/sessions/${sessionId}/cursor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x, y, userName, userImage }),
        });
      } catch (error) {
        console.error("[useRealtime] Failed to broadcast cursor:", error);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    if (!enabled || !sessionId) return;

    // Connect to SSE endpoint
    const eventSource = new EventSource(`/api/sessions/${sessionId}/realtime`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const message: RealtimeMessage | { type: string; sessionId?: string } = JSON.parse(event.data);

        // Handle connection message
        if ("type" in message && message.type === "connected") {
          setIsConnected(true);
          return;
        }

        // Handle realtime events
        if ("event" in message) {
          const { event: eventType, data } = message;

          switch (eventType) {
            // Detection events
            case REALTIME_EVENTS.DETECTION_CREATED:
            case REALTIME_EVENTS.DETECTION_UPDATED:
            case REALTIME_EVENTS.DETECTION_DELETED:
            case REALTIME_EVENTS.DETECTIONS_BATCH:
              onDetectionChange?.();
              break;

            // Correction events
            case REALTIME_EVENTS.CORRECTION_CREATED:
            case REALTIME_EVENTS.CORRECTION_UPDATED:
              onCorrectionChange?.();
              break;

            // Comment events
            case REALTIME_EVENTS.COMMENT_CREATED:
            case REALTIME_EVENTS.COMMENT_UPDATED:
            case REALTIME_EVENTS.COMMENT_DELETED:
              onCommentChange?.();
              break;

            // Session events
            case REALTIME_EVENTS.SESSION_UPDATED:
              onSessionChange?.();
              break;

            // Presence events
            case REALTIME_EVENTS.USER_JOINED:
              if (data.userId) {
                const newUser: PresenceMember = {
                  id: data.userId as string,
                  name: (data.userName as string) || "Anonymous",
                  email: "",
                  image: data.userImage as string | undefined,
                  joinedAt: Date.now(),
                };
                setOnlineUsers((prev) => {
                  if (prev.some((u) => u.id === newUser.id)) return prev;
                  return [...prev, newUser];
                });
              }
              break;

            case REALTIME_EVENTS.USER_LEFT:
              if (data.userId) {
                setOnlineUsers((prev) => prev.filter((u) => u.id !== data.userId));
                setCursors((prev) => {
                  const next = new Map(prev);
                  next.delete(data.userId as string);
                  return next;
                });
              }
              break;

            // Cursor events
            case REALTIME_EVENTS.CURSOR_MOVE:
              if (data.userId) {
                const cursorData: CursorPosition = {
                  x: data.x as number,
                  y: data.y as number,
                  userId: data.userId as string,
                  userName: (data.userName as string) || "Anonymous",
                  userImage: data.userImage as string | undefined,
                };

                setCursors((prev) => {
                  const next = new Map(prev);
                  next.set(cursorData.userId, cursorData);
                  return next;
                });

                // Clear cursor after 3 seconds of inactivity
                const existingTimeout = cursorTimeoutRef.current.get(cursorData.userId);
                if (existingTimeout) {
                  clearTimeout(existingTimeout);
                }
                const timeout = setTimeout(() => {
                  setCursors((prev) => {
                    const next = new Map(prev);
                    next.delete(cursorData.userId);
                    return next;
                  });
                }, 3000);
                cursorTimeoutRef.current.set(cursorData.userId, timeout);
              }
              break;
          }
        }
      } catch (error) {
        console.error("[useRealtime] Failed to parse message:", error);
      }
    };

    // Cleanup
    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);

      // Clear all cursor timeouts
      cursorTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
      cursorTimeoutRef.current.clear();
    };
  }, [sessionId, enabled, onDetectionChange, onCorrectionChange, onCommentChange, onSessionChange]);

  return {
    isConnected,
    onlineUsers,
    cursors,
    broadcastCursor,
  };
}
