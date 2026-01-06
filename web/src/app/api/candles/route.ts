import { NextRequest, NextResponse } from "next/server";

const HYPERLIQUID_API = "https://api.hyperliquid.xyz/info";

// Intervals that Hyperliquid natively supports
const NATIVE_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1M"];

// Mapping for custom intervals: [baseInterval, aggregationFactor]
const CUSTOM_INTERVAL_MAP: Record<string, [string, number]> = {
  // Second-based (aggregate from 1m)
  "1s": ["1m", 1],   // Can't do sub-minute, fallback to 1m
  "5s": ["1m", 1],
  "15s": ["1m", 1],
  "30s": ["1m", 1],
  // Minute-based
  "3m": ["1m", 3],
  "45m": ["15m", 3],
  // Hour-based
  "2h": ["1h", 2],
  "3h": ["1h", 3],
  "6h": ["1h", 6],
  "8h": ["4h", 2],
  "12h": ["4h", 3],
  // Day-based
  "3d": ["1d", 3],
};

interface HyperliquidCandle {
  t: number; // timestamp in ms
  o: string; // open
  h: string; // high
  l: string; // low
  c: string; // close
  v: string; // volume
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Get interval duration in milliseconds
function getIntervalMs(interval: string): number {
  const match = interval.match(/^(\d+)([smhdwM])$/);
  if (!match) return 0;

  const [, num, unit] = match;
  const n = parseInt(num);

  switch (unit) {
    case "s": return n * 1000;
    case "m": return n * 60 * 1000;
    case "h": return n * 60 * 60 * 1000;
    case "d": return n * 24 * 60 * 60 * 1000;
    case "w": return n * 7 * 24 * 60 * 60 * 1000;
    case "M": return n * 30 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol") || "BTC";
  const requestedInterval = searchParams.get("interval") || "4h";
  const days = parseInt(searchParams.get("days") || "30");
  const startTimeParam = searchParams.get("startTime");
  const endTimeParam = searchParams.get("endTime");

  try {
    // Determine if we need to aggregate
    let fetchInterval = requestedInterval;
    let aggregationFactor = 1;

    if (!NATIVE_INTERVALS.includes(requestedInterval)) {
      const mapping = CUSTOM_INTERVAL_MAP[requestedInterval];
      if (mapping) {
        [fetchInterval, aggregationFactor] = mapping;
      } else {
        // Unknown interval - try to use it directly (might fail)
        console.warn(`Unknown interval ${requestedInterval}, trying direct fetch`);
      }
    }

    // Use provided startTime/endTime if available, otherwise calculate from days
    const endTime = endTimeParam ? parseInt(endTimeParam) : Date.now();
    // If aggregating, we need more data to account for the aggregation
    const adjustedDays = days * aggregationFactor;
    const startTime = startTimeParam ? parseInt(startTimeParam) : endTime - adjustedDays * 24 * 60 * 60 * 1000;

    const response = await fetch(HYPERLIQUID_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "candleSnapshot",
        req: {
          coin: symbol,
          interval: fetchInterval,
          startTime: startTime,
          endTime: endTime,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Hyperliquid API error: ${response.status}`);
    }

    const data: HyperliquidCandle[] = await response.json();

    // Transform to our format (time in seconds for lightweight-charts)
    let candles: Candle[] = data.map((candle) => ({
      time: Math.floor(candle.t / 1000), // Convert ms to seconds
      open: parseFloat(candle.o),
      high: parseFloat(candle.h),
      low: parseFloat(candle.l),
      close: parseFloat(candle.c),
      volume: parseFloat(candle.v),
    }));

    // Sort by time
    candles.sort((a, b) => a.time - b.time);

    // Aggregate if needed
    if (aggregationFactor > 1) {
      // Align candles to the aggregated interval boundary
      const targetIntervalMs = getIntervalMs(requestedInterval);
      const targetIntervalSec = targetIntervalMs / 1000;

      if (targetIntervalSec > 0 && candles.length > 0) {
        // Group candles by target interval
        const grouped = new Map<number, Candle[]>();

        for (const candle of candles) {
          // Find which aggregated candle this belongs to
          const bucket = Math.floor(candle.time / targetIntervalSec) * targetIntervalSec;
          if (!grouped.has(bucket)) {
            grouped.set(bucket, []);
          }
          grouped.get(bucket)!.push(candle);
        }

        // Aggregate each group
        candles = Array.from(grouped.entries())
          .sort(([a], [b]) => a - b)
          .map(([time, group]) => ({
            time,
            open: group[0].open,
            high: Math.max(...group.map(c => c.high)),
            low: Math.min(...group.map(c => c.low)),
            close: group[group.length - 1].close,
            volume: group.reduce((sum, c) => sum + c.volume, 0),
          }));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        interval: requestedInterval,
        candles,
        count: candles.length,
        aggregated: aggregationFactor > 1,
        baseInterval: aggregationFactor > 1 ? fetchInterval : undefined,
      },
    });
  } catch (error) {
    console.error("Error fetching candles:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch candles",
      },
      { status: 500 }
    );
  }
}
