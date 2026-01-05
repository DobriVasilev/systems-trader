"use client";

import { useState, useEffect, useCallback } from "react";
import { EVENT_TYPES } from "@/lib/events";

interface EventUser {
  id: string;
  name: string | null;
  image: string | null;
}

interface AuditEvent {
  id: string;
  sessionId: string;
  userId: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  payload: {
    action?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  createdAt: string;
  user: EventUser;
}

interface AuditTrailProps {
  sessionId: string;
  className?: string;
}

// Event type to human-readable label
const EVENT_LABELS: Record<string, string> = {
  [EVENT_TYPES.SESSION_CREATED]: "Session created",
  [EVENT_TYPES.SESSION_UPDATED]: "Session updated",
  [EVENT_TYPES.SESSION_SHARED]: "Session shared",
  [EVENT_TYPES.DETECTION_BATCH_CREATED]: "Detections generated",
  [EVENT_TYPES.DETECTION_CREATED]: "Detection added",
  [EVENT_TYPES.DETECTION_CONFIRMED]: "Detection confirmed",
  [EVENT_TYPES.DETECTION_REJECTED]: "Detection rejected",
  [EVENT_TYPES.CORRECTION_CREATED]: "Correction made",
  [EVENT_TYPES.COMMENT_CREATED]: "Comment added",
  [EVENT_TYPES.COMMENT_UPDATED]: "Comment edited",
  [EVENT_TYPES.COMMENT_RESOLVED]: "Comment resolved",
  [EVENT_TYPES.COMMENT_REOPENED]: "Comment reopened",
  [EVENT_TYPES.COMMENT_DELETED]: "Comment deleted",
};

// Event type to icon
const EVENT_ICONS: Record<string, React.ReactNode> = {
  [EVENT_TYPES.SESSION_CREATED]: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  [EVENT_TYPES.DETECTION_BATCH_CREATED]: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  [EVENT_TYPES.DETECTION_CREATED]: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  [EVENT_TYPES.DETECTION_CONFIRMED]: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  [EVENT_TYPES.DETECTION_REJECTED]: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  [EVENT_TYPES.CORRECTION_CREATED]: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  [EVENT_TYPES.COMMENT_CREATED]: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  [EVENT_TYPES.COMMENT_RESOLVED]: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
};

// Event type to color
const EVENT_COLORS: Record<string, string> = {
  [EVENT_TYPES.SESSION_CREATED]: "text-blue-400 bg-blue-900/30",
  [EVENT_TYPES.SESSION_UPDATED]: "text-blue-400 bg-blue-900/30",
  [EVENT_TYPES.SESSION_SHARED]: "text-purple-400 bg-purple-900/30",
  [EVENT_TYPES.DETECTION_BATCH_CREATED]: "text-yellow-400 bg-yellow-900/30",
  [EVENT_TYPES.DETECTION_CREATED]: "text-green-400 bg-green-900/30",
  [EVENT_TYPES.DETECTION_CONFIRMED]: "text-green-400 bg-green-900/30",
  [EVENT_TYPES.DETECTION_REJECTED]: "text-red-400 bg-red-900/30",
  [EVENT_TYPES.CORRECTION_CREATED]: "text-orange-400 bg-orange-900/30",
  [EVENT_TYPES.COMMENT_CREATED]: "text-cyan-400 bg-cyan-900/30",
  [EVENT_TYPES.COMMENT_UPDATED]: "text-cyan-400 bg-cyan-900/30",
  [EVENT_TYPES.COMMENT_RESOLVED]: "text-green-400 bg-green-900/30",
  [EVENT_TYPES.COMMENT_REOPENED]: "text-yellow-400 bg-yellow-900/30",
  [EVENT_TYPES.COMMENT_DELETED]: "text-red-400 bg-red-900/30",
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function getEventDetails(event: AuditEvent): string | null {
  const { eventType, payload } = event;

  switch (eventType) {
    case EVENT_TYPES.DETECTION_BATCH_CREATED:
      return `${payload.metadata?.count || 0} detections for ${payload.metadata?.patternType || "pattern"}`;
    case EVENT_TYPES.CORRECTION_CREATED:
      return payload.metadata?.correctionType as string || null;
    case EVENT_TYPES.COMMENT_CREATED:
      const content = payload.after?.content as string;
      if (content) {
        return content.length > 50 ? content.substring(0, 50) + "..." : content;
      }
      return null;
    default:
      return null;
  }
}

export function AuditTrail({ sessionId, className = "" }: AuditTrailProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchEvents = useCallback(async (currentOffset: number) => {
    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/events?limit=${limit}&offset=${currentOffset}`
      );
      const data = await response.json();

      if (data.success) {
        if (currentOffset === 0) {
          setEvents(data.data);
        } else {
          setEvents((prev) => [...prev, ...data.data]);
        }
        setHasMore(data.pagination.hasMore);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchEvents(0);
  }, [fetchEvents]);

  const loadMore = () => {
    const newOffset = offset + limit;
    setOffset(newOffset);
    fetchEvents(newOffset);
  };

  if (isLoading && events.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading activity...</span>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={`p-4 text-center text-gray-500 ${className}`}>
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-0">
        {events.map((event, index) => {
          const defaultColor = "text-gray-400 bg-gray-800/30";
          const color = EVENT_COLORS[event.eventType] || defaultColor;
          const icon = EVENT_ICONS[event.eventType] || (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          );
          const label = EVENT_LABELS[event.eventType] || event.eventType;
          const details = getEventDetails(event);
          const isLast = index === events.length - 1;

          return (
            <div key={event.id} className="relative flex gap-3 pb-4">
              {/* Timeline line */}
              {!isLast && (
                <div className="absolute left-[15px] top-8 bottom-0 w-px bg-gray-800" />
              )}

              {/* Icon */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${color}`}>
                {icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {event.user.image ? (
                    <img
                      src={event.user.image}
                      alt={event.user.name || ""}
                      className="w-5 h-5 rounded-full"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                      {(event.user.name || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-gray-300 font-medium">
                    {event.user.name || "Unknown"}
                  </span>
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-xs text-gray-600 ml-auto">
                    {formatTimeAgo(event.createdAt)}
                  </span>
                </div>

                {details && (
                  <p className="text-xs text-gray-500 mt-1 ml-7 truncate">
                    {details}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={loadMore}
          className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Load more activity
        </button>
      )}
    </div>
  );
}
