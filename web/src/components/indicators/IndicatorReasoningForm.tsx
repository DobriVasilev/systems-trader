"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  X,
  Image as ImageIcon,
  Video,
  Mic,
  AlertCircle,
  Check,
  Loader2
} from "lucide-react";

interface IndicatorReasoningFormProps {
  userId: string;
  prefilledType?: string;
}

const INDICATOR_TYPES = [
  // Price Action (9)
  { value: "SWINGS", label: "Swings", description: "Swing highs and lows in price action", category: "Price Action" },
  { value: "BREAK_OF_STRUCTURE", label: "Break of Structure (BOS)", description: "Price breaks through market structure", category: "Price Action" },
  { value: "MARKET_STRUCTURE_BREAK", label: "Market Structure Break (MSB)", description: "Significant market structure break", category: "Price Action" },
  { value: "CHANGE_OF_CHARACTER", label: "Change of Character (CHoCH)", description: "Market changes from bullish to bearish or vice versa", category: "Price Action" },
  { value: "TRADING_RANGE", label: "Trading Range", description: "Sideways price movement between support and resistance", category: "Price Action" },
  { value: "FALSE_BREAKOUT", label: "False Breakout", description: "Price breaks a level but quickly reverses", category: "Price Action" },
  { value: "LIQUIDITY_SWEEP", label: "Liquidity Sweep", description: "Stop hunt before real price movement", category: "Price Action" },
  { value: "LIQUIDITY_GRAB", label: "Liquidity Grab", description: "Market grabs liquidity before moving", category: "Price Action" },
  { value: "STOP_HUNT", label: "Stop Hunt", description: "Market deliberately triggers stops before reversal", category: "Price Action" },

  // Support & Resistance (3)
  { value: "SUPPORT_RESISTANCE", label: "Support & Resistance", description: "Key price levels where reversals occur", category: "Support & Resistance" },
  { value: "PIVOT_POINTS", label: "Pivot Points", description: "Calculated support/resistance levels", category: "Support & Resistance" },
  { value: "PSYCHOLOGICAL_LEVELS", label: "Psychological Levels", description: "Round number price levels (e.g., $50,000)", category: "Support & Resistance" },

  // Order Blocks / ICT (4)
  { value: "ORDER_BLOCK", label: "Order Block (OB)", description: "Institutional buying/selling zones", category: "Order Blocks" },
  { value: "BREAKER_BLOCK", label: "Breaker Block", description: "Failed order block that becomes opposite", category: "Order Blocks" },
  { value: "MITIGATION_BLOCK", label: "Mitigation Block", description: "Area where imbalance gets mitigated", category: "Order Blocks" },
  { value: "REJECTION_BLOCK", label: "Rejection Block", description: "Zone where price was rejected", category: "Order Blocks" },

  // Fair Value Gaps (3)
  { value: "FAIR_VALUE_GAP", label: "Fair Value Gap (FVG)", description: "Imbalance in price that tends to get filled", category: "Fair Value Gaps" },
  { value: "BISI", label: "BISI", description: "Buyside Imbalance Sellside Inefficiency", category: "Fair Value Gaps" },
  { value: "SIBI", label: "SIBI", description: "Sellside Imbalance Buyside Inefficiency", category: "Fair Value Gaps" },

  // Supply & Demand (3)
  { value: "SUPPLY_ZONE", label: "Supply Zone", description: "Area of strong selling pressure", category: "Supply & Demand" },
  { value: "DEMAND_ZONE", label: "Demand Zone", description: "Area of strong buying pressure", category: "Supply & Demand" },
  { value: "IMBALANCE", label: "Imbalance", description: "Price inefficiency or gap in the market", category: "Supply & Demand" },

  // Fibonacci (3)
  { value: "FIBONACCI_RETRACEMENT", label: "Fibonacci Retracement", description: "Fib levels for retracement targets", category: "Fibonacci" },
  { value: "FIBONACCI_EXTENSION", label: "Fibonacci Extension", description: "Fib levels for extension targets", category: "Fibonacci" },
  { value: "FIBONACCI_TIME", label: "Fibonacci Time Zones", description: "Time-based Fibonacci analysis", category: "Fibonacci" },

  // Trend Analysis (4)
  { value: "TREND_LINES", label: "Trend Lines", description: "Lines connecting highs or lows", category: "Trend Analysis" },
  { value: "CHANNELS", label: "Channels", description: "Parallel trend lines forming channel", category: "Trend Analysis" },
  { value: "WEDGES", label: "Wedges", description: "Converging trend lines (rising/falling wedge)", category: "Trend Analysis" },
  { value: "TRIANGLES", label: "Triangles", description: "Symmetrical, ascending, or descending triangles", category: "Trend Analysis" },

  // Classic Patterns (8)
  { value: "HEAD_SHOULDERS", label: "Head & Shoulders", description: "Reversal pattern with three peaks", category: "Classic Patterns" },
  { value: "DOUBLE_TOP", label: "Double Top", description: "Bearish reversal with two peaks", category: "Classic Patterns" },
  { value: "DOUBLE_BOTTOM", label: "Double Bottom", description: "Bullish reversal with two troughs", category: "Classic Patterns" },
  { value: "TRIPLE_TOP", label: "Triple Top", description: "Bearish reversal with three peaks", category: "Classic Patterns" },
  { value: "TRIPLE_BOTTOM", label: "Triple Bottom", description: "Bullish reversal with three troughs", category: "Classic Patterns" },
  { value: "CUP_HANDLE", label: "Cup & Handle", description: "Bullish continuation pattern", category: "Classic Patterns" },
  { value: "FLAGS", label: "Flags", description: "Short-term continuation pattern", category: "Classic Patterns" },
  { value: "PENNANTS", label: "Pennants", description: "Small symmetrical triangle continuation", category: "Classic Patterns" },

  // Candlestick Patterns (11)
  { value: "ENGULFING", label: "Engulfing", description: "Bullish or bearish engulfing candle", category: "Candlestick Patterns" },
  { value: "DOJI", label: "Doji", description: "Indecision candle with small body", category: "Candlestick Patterns" },
  { value: "HAMMER", label: "Hammer", description: "Bullish reversal with long lower wick", category: "Candlestick Patterns" },
  { value: "SHOOTING_STAR", label: "Shooting Star", description: "Bearish reversal with long upper wick", category: "Candlestick Patterns" },
  { value: "MORNING_STAR", label: "Morning Star", description: "Three-candle bullish reversal", category: "Candlestick Patterns" },
  { value: "EVENING_STAR", label: "Evening Star", description: "Three-candle bearish reversal", category: "Candlestick Patterns" },
  { value: "THREE_WHITE_SOLDIERS", label: "Three White Soldiers", description: "Three consecutive bullish candles", category: "Candlestick Patterns" },
  { value: "THREE_BLACK_CROWS", label: "Three Black Crows", description: "Three consecutive bearish candles", category: "Candlestick Patterns" },
  { value: "HARAMI", label: "Harami", description: "Small candle inside previous candle", category: "Candlestick Patterns" },
  { value: "PIERCING_LINE", label: "Piercing Line", description: "Bullish reversal piercing prior candle", category: "Candlestick Patterns" },
  { value: "DARK_CLOUD_COVER", label: "Dark Cloud Cover", description: "Bearish reversal covering prior candle", category: "Candlestick Patterns" },

  // Volume Analysis (3)
  { value: "VOLUME_PROFILE", label: "Volume Profile", description: "Volume distribution at price levels", category: "Volume Analysis" },
  { value: "VOLUME_DIVERGENCE", label: "Volume Divergence", description: "Price and volume moving in opposite directions", category: "Volume Analysis" },
  { value: "VOLUME_CLIMAX", label: "Volume Climax", description: "Extreme volume spike indicating exhaustion", category: "Volume Analysis" },

  // Indicators (5)
  { value: "MA_CROSSOVER", label: "Moving Average Crossover", description: "MA lines crossing signals", category: "Technical Indicators" },
  { value: "RSI_DIVERGENCE", label: "RSI Divergence", description: "RSI and price divergence", category: "Technical Indicators" },
  { value: "MACD_SIGNAL", label: "MACD Signal", description: "MACD line crosses signal line", category: "Technical Indicators" },
  { value: "BOLLINGER_BANDS", label: "Bollinger Bands", description: "Volatility bands around price", category: "Technical Indicators" },
  { value: "VWAP", label: "VWAP", description: "Volume Weighted Average Price", category: "Technical Indicators" },

  // Other
  { value: "OTHER", label: "Other", description: "Another pattern type not listed", category: "Other" },
];

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "12h", "1d", "1w"];
const SYMBOLS = ["BTC", "ETH", "SOL", "DOGE", "XRP", "HYPE", "AVAX", "LINK", "ARB", "OP"];

export function IndicatorReasoningForm({ userId, prefilledType }: IndicatorReasoningFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form state
  const [indicatorType, setIndicatorType] = useState("");
  const [customName, setCustomName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [algorithmIdea, setAlgorithmIdea] = useState("");
  const [pseudocode, setPseudocode] = useState("");

  // File uploads
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);

  // Set pre-filled type on mount
  useEffect(() => {
    if (prefilledType) {
      // Validate that the type exists in our INDICATOR_TYPES array
      const typeExists = INDICATOR_TYPES.some(t => t.value === prefilledType);
      if (typeExists) {
        setIndicatorType(prefilledType);
      }
    }
  }, [prefilledType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate
      if (!indicatorType) {
        throw new Error("Please select an indicator type");
      }
      if (!title.trim()) {
        throw new Error("Please provide a title");
      }
      if (!description.trim()) {
        throw new Error("Please provide a description");
      }

      // Upload files first (if any)
      const uploadedScreenshots = await uploadFiles(screenshots, "screenshot");
      const uploadedVideos = await uploadFiles(videos, "video");

      // Submit reasoning
      const res = await fetch("/api/indicators/reasoning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indicatorType,
          customName: indicatorType === "OTHER" ? customName : undefined,
          title,
          description,
          symbol: symbol || undefined,
          timeframe: timeframe || undefined,
          algorithmIdea: algorithmIdea || undefined,
          pseudocode: pseudocode || undefined,
          screenshots: uploadedScreenshots,
          videos: uploadedVideos,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to submit");
      }

      setSuccess(true);
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/indicators/reasoning/${data.data.id}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles(files: File[], category: string) {
    if (files.length === 0) return undefined;

    const uploaded = [];
    for (const file of files) {
      // TODO: Implement R2 upload
      // For now, just store file metadata
      uploaded.push({
        id: Math.random().toString(36),
        url: URL.createObjectURL(file),
        caption: file.name,
        size: file.size,
      });
    }
    return uploaded;
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: "screenshot" | "video") {
    const files = Array.from(e.target.files || []);
    if (type === "screenshot") {
      setScreenshots([...screenshots, ...files]);
    } else {
      setVideos([...videos, ...files]);
    }
  }

  function removeFile(index: number, type: "screenshot" | "video") {
    if (type === "screenshot") {
      setScreenshots(screenshots.filter((_, i) => i !== index));
    } else {
      setVideos(videos.filter((_, i) => i !== index));
    }
  }

  if (success) {
    return (
      <div className="bg-green-900/20 border border-green-800 rounded-lg p-8 text-center">
        <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Submitted Successfully!</h3>
        <p className="text-gray-400">Your indicator reasoning has been submitted for review. Redirecting...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-red-400">{error}</div>
        </div>
      )}

      {/* Indicator Type */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <label className="block text-sm font-medium text-white mb-3">
          What pattern do you want to explain? *
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {INDICATOR_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setIndicatorType(type.value)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                indicatorType === type.value
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
              }`}
            >
              <div className="font-medium text-white mb-1">{type.label}</div>
              <div className="text-sm text-gray-400">{type.description}</div>
            </button>
          ))}
        </div>

        {indicatorType === "OTHER" && (
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Enter custom pattern name"
            className="mt-4 w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            required
          />
        )}
      </div>

      {/* Title & Description */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., My approach to identifying CHoCH on 1h timeframe"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            required
            maxLength={200}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain how you identify this pattern. Be as detailed as possible..."
            rows={8}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            required
          />
          <div className="text-sm text-gray-500 mt-1">{description.length} characters</div>
        </div>
      </div>

      {/* Supporting Materials */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-white">Supporting Materials (Optional)</h3>

        {/* Screenshots */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Screenshots
          </label>
          <div className="space-y-3">
            {screenshots.map((file, index) => (
              <div key={index} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                <ImageIcon className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-white flex-1">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index, "screenshot")}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-400">Upload screenshots</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFileUpload(e, "screenshot")}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Videos */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Videos
          </label>
          <div className="space-y-3">
            {videos.map((file, index) => (
              <div key={index} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                <Video className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-white flex-1">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index, "video")}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-400">Upload videos</span>
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={(e) => handleFileUpload(e, "video")}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Context */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-white">Context (Optional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Symbol
            </label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Select symbol...</option>
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Timeframe
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Select timeframe...</option>
              {TIMEFRAMES.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Algorithm Ideas */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-white">Algorithm Ideas (Optional)</h3>
        <p className="text-sm text-gray-400">
          If you have ideas on how to code this logic, share them here in plain English or pseudocode
        </p>

        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Algorithm Idea
          </label>
          <textarea
            value={algorithmIdea}
            onChange={(e) => setAlgorithmIdea(e.target.value)}
            placeholder="Describe your algorithm idea in plain English..."
            rows={4}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Pseudocode
          </label>
          <textarea
            value={pseudocode}
            onChange={(e) => setPseudocode(e.target.value)}
            placeholder="if (condition) {&#10;  // do something&#10;}"
            rows={6}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none font-mono text-sm"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Reasoning"
          )}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading}
          className="px-6 py-4 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
