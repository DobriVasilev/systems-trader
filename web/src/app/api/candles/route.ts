import { NextRequest, NextResponse } from "next/server";

const HYPERLIQUID_API = "https://api.hyperliquid.xyz/info";

interface HyperliquidCandle {
  t: number; // timestamp in ms
  o: string; // open
  h: string; // high
  l: string; // low
  c: string; // close
  v: string; // volume
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol") || "BTC";
  const interval = searchParams.get("interval") || "4h";
  const days = parseInt(searchParams.get("days") || "30");

  try {
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;

    const response = await fetch(HYPERLIQUID_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "candleSnapshot",
        req: {
          coin: symbol,
          interval: interval,
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
    const candles = data.map((candle) => ({
      time: Math.floor(candle.t / 1000), // Convert ms to seconds
      open: parseFloat(candle.o),
      high: parseFloat(candle.h),
      low: parseFloat(candle.l),
      close: parseFloat(candle.c),
      volume: parseFloat(candle.v),
    }));

    // Sort by time
    candles.sort((a, b) => a.time - b.time);

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        interval,
        candles,
        count: candles.length,
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
