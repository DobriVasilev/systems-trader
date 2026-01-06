"use client";

import { useState, useEffect, useCallback } from "react";
import { Timeframe, PatternType } from "@/types/patterns";
import { ChartCandle } from "@/components/chart/CandlestickChart";

export interface PatternDetection {
  id: string;
  sessionId: string;
  candleIndex: number;
  candleTime: string;
  price: number;
  detectionType: string;
  structure: string | null;
  confidence: number | null;
  metadata: Record<string, unknown> | null;
  status: string;
  createdAt: string;
}

export interface PatternCorrection {
  id: string;
  detectionId: string | null;
  correctionType: "move" | "delete" | "add" | "modify" | "confirm" | "unconfirm";
  // Original state (for moves)
  originalIndex: number | null;
  originalTime: string | null;
  originalPrice: number | null;
  originalType: string | null;
  // Corrected state (for moves/adds)
  correctedIndex: number | null;
  correctedTime: string | null;
  correctedPrice: number | null;
  correctedType: string | null;
  correctedStructure: string | null;
  // Reason for change
  reason: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  createdAt: string;
}

export interface PatternComment {
  id: string;
  sessionId: string;
  content: string;
  detectionId: string | null;
  correctionId: string | null;
  parentId: string | null;
  candleTime: string | null;
  canvasX: number | null;
  canvasY: number | null;
  resolved: boolean;
  resolvedAt: string | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SessionShare {
  id: string;
  permission: "view" | "comment" | "edit" | "admin";
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export interface PatternSessionDetail {
  id: string;
  name: string;
  symbol: string;
  timeframe: Timeframe;
  patternType: PatternType;
  patternSettings: {
    detection_mode?: "wicks" | "closes";
    [key: string]: unknown;
  } | null;
  status: "draft" | "active" | "completed" | "archived";
  isPublic: boolean;
  candleData: {
    candles?: ChartCandle[];
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  detections: PatternDetection[];
  corrections: PatternCorrection[];
  comments: PatternComment[];
  shares: SessionShare[];
  _count: {
    detections: number;
    corrections: number;
    comments: number;
  };
}

interface UseSessionResult {
  session: PatternSessionDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateSession: (data: Partial<PatternSessionDetail>) => Promise<boolean>;
}

export function useSession(sessionId: string): UseSessionResult {
  const [session, setSession] = useState<PatternSessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async (isInitialLoad = false) => {
    if (!sessionId) return;

    // Only show loading spinner on initial load, not on refetch
    // This prevents the chart from unmounting and losing position
    if (isInitialLoad) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch session");
      }

      setSession(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const updateSession = useCallback(
    async (updateData: Partial<PatternSessionDetail>): Promise<boolean> => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to update session");
        }

        // Refetch to get updated data
        await fetchSession();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update session");
        return false;
      }
    },
    [sessionId, fetchSession]
  );

  useEffect(() => {
    fetchSession(true); // Initial load - show loading spinner
  }, [fetchSession]);

  return {
    session,
    isLoading,
    error,
    refetch: fetchSession,
    updateSession,
  };
}
