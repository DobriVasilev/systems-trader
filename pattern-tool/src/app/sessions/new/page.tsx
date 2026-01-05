"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CandlestickChart, ChartCandle, ChartMarker } from "@/components/chart/CandlestickChart";
import { TimeframeSelector } from "@/components/chart/TimeframeSelector";
import { SymbolSelector } from "@/components/chart/SymbolSelector";
import { useCandles } from "@/hooks/useCandles";
import { Timeframe, PatternType } from "@/types/patterns";

const PATTERN_TYPES: { value: PatternType; label: string }[] = [
  { value: "swings", label: "Swings" },
  { value: "bos", label: "BOS" },
  { value: "msb", label: "MSB" },
  { value: "range", label: "Range" },
  { value: "false_breakout", label: "False Breakout" },
];

export default function NewSessionPage() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("BTC");
  const [timeframe, setTimeframe] = useState<Timeframe>("4h");
  const [patternType, setPatternType] = useState<PatternType>("swings");
  const [markers, setMarkers] = useState<ChartMarker[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionName, setSessionName] = useState("");

  const { candles, isLoading, error } = useCandles({
    symbol,
    timeframe,
    days: 30,
  });

  const handleCandleClick = (candle: ChartCandle, index: number) => {
    console.log("Candle clicked:", candle, "at index:", index);
  };

  const handleMarkerClick = (marker: ChartMarker) => {
    console.log("Marker clicked:", marker);
  };

  const handleChartClick = (time: number, price: number) => {
    console.log("Chart clicked at time:", time, "price:", price);
  };

  // Create session and redirect
  const createSession = async () => {
    if (candles.length === 0) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sessionName || `${symbol} ${timeframe} - ${patternType}`,
          symbol,
          timeframe,
          patternType,
          candleData: { candles },
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create session");
      }

      // Redirect to the new session
      router.push(`/sessions/${data.data.id}`);
    } catch (err) {
      console.error("Error creating session:", err);
      alert(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setIsSaving(false);
    }
  };

  // TODO: This will be replaced with actual pattern detection API call
  const runDetection = async () => {
    console.log("Running pattern detection...");
    // Placeholder for now
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              Systems Trader
            </Link>
            <span className="text-gray-500">/</span>
            <Link href="/sessions" className="text-gray-400 hover:text-white transition-colors">
              Sessions
            </Link>
            <span className="text-gray-500">/</span>
            <span className="text-gray-400">New Session</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Session name (optional)"
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm
                       placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={createSession}
              disabled={isLoading || candles.length === 0 || isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium
                       hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create Session
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="border-b border-gray-800 bg-gray-900/30">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <SymbolSelector
            value={symbol}
            onChange={setSymbol}
            disabled={isLoading}
          />

          <TimeframeSelector
            value={timeframe}
            onChange={setTimeframe}
            disabled={isLoading}
          />

          <div className="h-8 w-px bg-gray-700" />

          <div className="flex gap-2">
            {PATTERN_TYPES.map((pt) => (
              <button
                key={pt.value}
                onClick={() => setPatternType(pt.value)}
                className={`
                  px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                  ${
                    patternType === pt.value
                      ? "bg-purple-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }
                `}
              >
                {pt.label}
              </button>
            ))}
          </div>

          <div className="ml-auto text-sm text-gray-500">
            {isLoading ? (
              "Loading..."
            ) : (
              <>
                {candles.length} candles | {markers.length} detections
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {error ? (
          <div className="flex items-center justify-center h-[500px] bg-gray-900 rounded-lg">
            <div className="text-center">
              <div className="text-red-400 mb-2">Error loading chart</div>
              <div className="text-gray-500 text-sm">{error}</div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-[500px] bg-gray-900 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400">Loading chart data...</span>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <CandlestickChart
              candles={candles}
              markers={markers}
              onCandleClick={handleCandleClick}
              onMarkerClick={handleMarkerClick}
              onChartClick={handleChartClick}
              height={600}
            />
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="container mx-auto px-4 pb-8">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Symbol</div>
            <div className="text-xl font-bold">{symbol}/USD</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Timeframe</div>
            <div className="text-xl font-bold">{timeframe.toUpperCase()}</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Pattern Type</div>
            <div className="text-xl font-bold capitalize">{patternType}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
