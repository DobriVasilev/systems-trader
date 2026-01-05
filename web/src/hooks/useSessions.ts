"use client";

import { useState, useEffect, useCallback } from "react";
import { Timeframe, PatternType } from "@/types/patterns";

export interface PatternSession {
  id: string;
  name: string;
  symbol: string;
  timeframe: Timeframe;
  patternType: PatternType;
  status: "draft" | "active" | "completed" | "archived";
  candleData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  _count: {
    detections: number;
    corrections: number;
    comments: number;
  };
}

interface UseSessionsResult {
  sessions: PatternSession[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createSession: (data: CreateSessionData) => Promise<PatternSession | null>;
  deleteSession: (id: string) => Promise<boolean>;
}

interface CreateSessionData {
  name?: string;
  symbol: string;
  timeframe: Timeframe;
  patternType: PatternType;
  candleData?: Record<string, unknown>;
}

export function useSessions(): UseSessionsResult {
  const [sessions, setSessions] = useState<PatternSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sessions");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch sessions");
      }

      setSessions(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createSession = useCallback(
    async (sessionData: CreateSessionData): Promise<PatternSession | null> => {
      try {
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionData),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to create session");
        }

        // Refetch to get updated list
        await fetchSessions();
        return data.data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create session");
        return null;
      }
    },
    [fetchSessions]
  );

  const deleteSession = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/sessions/${id}`, {
          method: "DELETE",
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to delete session");
        }

        // Update local state
        setSessions((prev) => prev.filter((s) => s.id !== id));
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete session");
        return false;
      }
    },
    []
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    isLoading,
    error,
    refetch: fetchSessions,
    createSession,
    deleteSession,
  };
}
