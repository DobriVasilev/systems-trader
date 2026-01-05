"use client";

import { useState, useEffect, useCallback } from "react";
import { Timeframe } from "@/types/patterns";
import { ChartCandle } from "@/components/chart/CandlestickChart";

interface UseCandlesOptions {
  symbol: string;
  timeframe: Timeframe;
  days?: number;
  startTime?: number; // Unix timestamp in ms
  endTime?: number;   // Unix timestamp in ms
}

interface UseCandlesResult {
  candles: ChartCandle[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCandles({
  symbol,
  timeframe,
  days = 30,
  startTime,
  endTime,
}: UseCandlesOptions): UseCandlesResult {
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCandles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        symbol,
        interval: timeframe,
      });

      // If startTime and endTime are provided, use them; otherwise fall back to days
      if (startTime && endTime) {
        params.set("startTime", startTime.toString());
        params.set("endTime", endTime.toString());
      } else {
        params.set("days", days.toString());
      }

      const response = await fetch(`/api/candles?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch candles");
      }

      setCandles(data.data.candles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setCandles([]);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, timeframe, days, startTime, endTime]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  return {
    candles,
    isLoading,
    error,
    refetch: fetchCandles,
  };
}
