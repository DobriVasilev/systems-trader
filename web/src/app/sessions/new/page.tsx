"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CandlestickChart, ChartCandle, ChartMarker } from "@/components/chart/CandlestickChart";
import { TimeframeSelector } from "@/components/chart/TimeframeSelector";
import { SymbolSelector } from "@/components/chart/SymbolSelector";
import { PatternSelector } from "@/components/chart/PatternSelector";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { useCandles } from "@/hooks/useCandles";
import { Timeframe, PatternType, PATTERN_CONFIGS } from "@/types/patterns";

export default function NewSessionPage() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("BTC");
  const [timeframe, setTimeframe] = useState<Timeframe>("4h");
  const [patternType, setPatternType] = useState<PatternType>("swings");
  const [patternSettings, setPatternSettings] = useState<Record<string, unknown>>({});
  const [markers] = useState<ChartMarker[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionName, setSessionName] = useState("");

  // Date range state
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date(),
  });

  // Calculate days from date range
  const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000));

  const { candles, isLoading, error } = useCandles({
    symbol,
    timeframe,
    days,
    startTime: dateRange.start.getTime(),
    endTime: dateRange.end.getTime(),
  });

  // Initialize pattern settings when pattern type changes
  useEffect(() => {
    const config = PATTERN_CONFIGS[patternType];
    if (config?.settings) {
      const defaults: Record<string, unknown> = {};
      config.settings.forEach(setting => {
        defaults[setting.key] = setting.default;
      });
      setPatternSettings(defaults);
    } else {
      setPatternSettings({});
    }
  }, [patternType]);

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
          patternSettings,
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
          },
          candleData: { candles },
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create session");
      }

      // Run detection on the new session
      await fetch(`/api/sessions/${data.data.id}/detections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patternType,
          patternSettings,
          candleData: { candles },
        }),
      });

      // Redirect to the new session
      router.push(`/sessions/${data.data.id}`);
    } catch (err) {
      console.error("Error creating session:", err);
      alert(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setIsSaving(false);
    }
  };

  const currentPatternConfig = PATTERN_CONFIGS[patternType];

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between relative">
          <nav className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold hover:text-blue-400 transition-colors cursor-pointer">
              Systems Trader
            </Link>
            <span className="text-gray-500">/</span>
            <Link href="/sessions" className="text-gray-400 hover:text-white transition-colors cursor-pointer">
              Sessions
            </Link>
            <span className="text-gray-500">/</span>
            <span className="text-gray-400">New Session</span>
          </nav>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Session name (optional)"
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm
                       placeholder-gray-500 focus:outline-none focus:border-blue-500 w-64"
            />
            <button
              onClick={createSession}
              disabled={isLoading || candles.length === 0 || isSaving}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium
                       hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
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

      {/* Controls Row 1: Symbol, Timeframe, Date Range */}
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

          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onChange={(start, end) => setDateRange({ start, end })}
            disabled={isLoading}
          />

          <div className="ml-auto text-sm text-gray-500">
            {isLoading ? (
              "Loading..."
            ) : (
              <>
                {candles.length} candles | {days} days
              </>
            )}
          </div>
        </div>
      </div>

      {/* Controls Row 2: Pattern Selection & Settings */}
      <div className="border-b border-gray-800 bg-gray-900/20">
        <div className="container mx-auto px-4 py-3">
          <PatternSelector
            value={patternType}
            onChange={setPatternType}
            settings={patternSettings}
            onSettingsChange={setPatternSettings}
            disabled={isLoading}
          />
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
        <div className="grid grid-cols-4 gap-4">
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
            <div className="text-xl font-bold">{currentPatternConfig?.label || patternType}</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Date Range</div>
            <div className="text-lg font-bold">
              {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Pattern Settings Summary */}
        {currentPatternConfig?.settings && Object.keys(patternSettings).length > 0 && (
          <div className="mt-4 bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-2">Pattern Settings</div>
            <div className="flex flex-wrap gap-2">
              {currentPatternConfig.settings.map(setting => (
                <div key={setting.key} className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm">
                  <span className="text-gray-400">{setting.label}:</span>{" "}
                  <span className="text-white font-medium">
                    {setting.type === "select" && setting.options
                      ? setting.options.find(o => o.value === patternSettings[setting.key])?.label || String(patternSettings[setting.key])
                      : String(patternSettings[setting.key])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
