"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Timeframe, STANDARD_TIMEFRAMES } from "@/types/patterns";

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (timeframe: Timeframe) => void;
  disabled?: boolean;
}

interface TimeframeOption {
  value: Timeframe;
  label: string;
  category: string;
  seconds: number; // For sorting
}

// Parse timeframe string to seconds for comparison
function timeframeToSeconds(tf: string): number {
  const match = tf.match(/^(\d+)(s|m|h|d|w|M)$/i);
  if (!match) return 0;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
    M: 2592000, // ~30 days
  };

  return value * (multipliers[unit] || 0);
}

// Format timeframe for display
function formatTimeframe(tf: string): string {
  const match = tf.match(/^(\d+)(s|m|h|d|w|M)$/i);
  if (!match) return tf.toUpperCase();

  const value = match[1];
  const unit = match[2];

  const unitLabels: Record<string, string> = {
    s: "s",
    m: "m",
    h: "H",
    d: "D",
    w: "W",
    M: "M",
  };

  return `${value}${unitLabels[unit.toLowerCase()] || unit}`;
}

// All standard timeframes with metadata
const ALL_TIMEFRAMES: TimeframeOption[] = [
  // Seconds
  { value: "1s", label: "1s", category: "SECONDS", seconds: 1 },
  { value: "5s", label: "5s", category: "SECONDS", seconds: 5 },
  { value: "15s", label: "15s", category: "SECONDS", seconds: 15 },
  { value: "30s", label: "30s", category: "SECONDS", seconds: 30 },

  // Minutes
  { value: "1m", label: "1m", category: "MINUTES", seconds: 60 },
  { value: "3m", label: "3m", category: "MINUTES", seconds: 180 },
  { value: "5m", label: "5m", category: "MINUTES", seconds: 300 },
  { value: "15m", label: "15m", category: "MINUTES", seconds: 900 },
  { value: "30m", label: "30m", category: "MINUTES", seconds: 1800 },
  { value: "45m", label: "45m", category: "MINUTES", seconds: 2700 },

  // Hours
  { value: "1h", label: "1H", category: "HOURS", seconds: 3600 },
  { value: "2h", label: "2H", category: "HOURS", seconds: 7200 },
  { value: "3h", label: "3H", category: "HOURS", seconds: 10800 },
  { value: "4h", label: "4H", category: "HOURS", seconds: 14400 },
  { value: "6h", label: "6H", category: "HOURS", seconds: 21600 },
  { value: "8h", label: "8H", category: "HOURS", seconds: 28800 },
  { value: "12h", label: "12H", category: "HOURS", seconds: 43200 },

  // Days/Weeks/Months
  { value: "1d", label: "1D", category: "DAYS", seconds: 86400 },
  { value: "3d", label: "3D", category: "DAYS", seconds: 259200 },
  { value: "1w", label: "1W", category: "WEEKS", seconds: 604800 },
  { value: "1M", label: "1M", category: "MONTHS", seconds: 2592000 },
];

// Default quick-access timeframes
const DEFAULT_QUICK_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

export function TimeframeSelector({
  value,
  onChange,
  disabled = false,
}: TimeframeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [favorites, setFavorites] = useState<Timeframe[]>([]);
  const [customTimeframes, setCustomTimeframes] = useState<Timeframe[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState<"s" | "m" | "h" | "d" | "w" | "M">("m");
  const [customError, setCustomError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Load favorites and custom timeframes from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem("favoriteTimeframes");
    const savedCustom = localStorage.getItem("customTimeframes");

    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch {
        setFavorites([]);
      }
    }

    if (savedCustom) {
      try {
        setCustomTimeframes(JSON.parse(savedCustom));
      } catch {
        setCustomTimeframes([]);
      }
    }
  }, []);

  // Focus custom input when shown
  useEffect(() => {
    if (showCustomInput && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [showCustomInput]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustomInput(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleFavorite = (tf: Timeframe, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavorites = favorites.includes(tf)
      ? favorites.filter(f => f !== tf)
      : [...favorites, tf];
    setFavorites(newFavorites);
    localStorage.setItem("favoriteTimeframes", JSON.stringify(newFavorites));
  };

  const addCustomTimeframe = () => {
    const numValue = parseInt(customValue);
    if (isNaN(numValue) || numValue <= 0) {
      setCustomError("Enter a positive number");
      return;
    }

    // Validate reasonable ranges
    if (customUnit === "s" && numValue > 59) {
      setCustomError("Use minutes for 60+ seconds");
      return;
    }
    if (customUnit === "m" && numValue > 59) {
      setCustomError("Use hours for 60+ minutes");
      return;
    }
    if (customUnit === "h" && numValue > 23) {
      setCustomError("Use days for 24+ hours");
      return;
    }

    const newTf = `${numValue}${customUnit}` as Timeframe;

    // Check if it already exists
    const existsInStandard = ALL_TIMEFRAMES.some(t => t.value === newTf);
    const existsInCustom = customTimeframes.includes(newTf);

    if (existsInStandard || existsInCustom) {
      // Just select it if it already exists
      onChange(newTf);
      setIsOpen(false);
      setShowCustomInput(false);
      setCustomValue("");
      setCustomError(null);
      return;
    }

    // Add to custom timeframes
    const newCustom = [...customTimeframes, newTf];
    setCustomTimeframes(newCustom);
    localStorage.setItem("customTimeframes", JSON.stringify(newCustom));

    // Select it
    onChange(newTf);
    setIsOpen(false);
    setShowCustomInput(false);
    setCustomValue("");
    setCustomError(null);
  };

  const removeCustomTimeframe = (tf: Timeframe, e: React.MouseEvent) => {
    e.stopPropagation();
    const newCustom = customTimeframes.filter(t => t !== tf);
    setCustomTimeframes(newCustom);
    localStorage.setItem("customTimeframes", JSON.stringify(newCustom));

    // Also remove from favorites if present
    if (favorites.includes(tf)) {
      const newFavorites = favorites.filter(f => f !== tf);
      setFavorites(newFavorites);
      localStorage.setItem("favoriteTimeframes", JSON.stringify(newFavorites));
    }
  };

  // Combine all timeframes and sort
  const allTimeframesWithCustom = useMemo(() => {
    const combined = [...ALL_TIMEFRAMES];

    // Add custom timeframes
    customTimeframes.forEach(tf => {
      if (!combined.some(t => t.value === tf)) {
        combined.push({
          value: tf,
          label: formatTimeframe(tf),
          category: "CUSTOM",
          seconds: timeframeToSeconds(tf),
        });
      }
    });

    // Sort by seconds
    return combined.sort((a, b) => a.seconds - b.seconds);
  }, [customTimeframes]);

  // Determine which timeframes to show in quick bar
  const quickTimeframes = favorites.length > 0
    ? favorites
    : DEFAULT_QUICK_TIMEFRAMES;

  // Group timeframes by category for dropdown
  const groupedTimeframes = useMemo(() => {
    return allTimeframesWithCustom.reduce((acc, tf) => {
      if (!acc[tf.category]) acc[tf.category] = [];
      acc[tf.category].push(tf);
      return acc;
    }, {} as Record<string, TimeframeOption[]>);
  }, [allTimeframesWithCustom]);

  // Check if current value is a known timeframe
  const currentTimeframeOption = allTimeframesWithCustom.find(t => t.value === value);
  const displayValue = currentTimeframeOption?.label || formatTimeframe(value);

  return (
    <div className="flex items-center gap-1" ref={dropdownRef}>
      {/* Quick access buttons */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
        {quickTimeframes.slice(0, 7).map((tf) => {
          const option = allTimeframesWithCustom.find(o => o.value === tf);
          return (
            <button
              key={tf}
              onClick={() => onChange(tf)}
              disabled={disabled}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                ${value === tf
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              {option?.label || formatTimeframe(tf)}
            </button>
          );
        })}
      </div>

      {/* Dropdown for all timeframes */}
      <div className="relative">
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            p-2 bg-gray-900 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
          title="All timeframes"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1 w-64 bg-gray-900 rounded-lg shadow-xl border border-gray-800 z-50">
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
              <div className="text-xs text-gray-500 uppercase font-medium">Timeframes</div>
              <button
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Custom
              </button>
            </div>

            {/* Custom timeframe input */}
            {showCustomInput && (
              <div className="px-3 py-2 border-b border-gray-800 bg-gray-800/50">
                <div className="text-xs text-gray-400 mb-2">Add custom timeframe</div>
                <div className="flex gap-2">
                  <input
                    ref={customInputRef}
                    type="number"
                    value={customValue}
                    onChange={(e) => {
                      setCustomValue(e.target.value);
                      setCustomError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && addCustomTimeframe()}
                    placeholder="Value"
                    className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm
                             focus:outline-none focus:border-blue-500"
                    min="1"
                  />
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
                    className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm
                             focus:outline-none focus:border-blue-500"
                  >
                    <option value="s">Seconds</option>
                    <option value="m">Minutes</option>
                    <option value="h">Hours</option>
                    <option value="d">Days</option>
                    <option value="w">Weeks</option>
                    <option value="M">Months</option>
                  </select>
                  <button
                    onClick={addCustomTimeframe}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                {customError && (
                  <div className="text-xs text-red-400 mt-1">{customError}</div>
                )}
              </div>
            )}

            {/* Grouped timeframes */}
            <div className="max-h-80 overflow-y-auto">
              {Object.entries(groupedTimeframes).map(([category, tfs]) => (
                <div key={category}>
                  <div className="px-3 py-1.5 text-xs text-gray-500 uppercase bg-gray-800/50 sticky top-0">
                    {category}
                  </div>
                  {tfs.map((tf) => {
                    const isCustom = category === "CUSTOM";
                    return (
                      <button
                        key={tf.value}
                        onClick={() => {
                          onChange(tf.value);
                          setIsOpen(false);
                        }}
                        className={`
                          w-full px-3 py-2 text-left text-sm transition-colors
                          flex items-center justify-between group
                          ${value === tf.value ? "bg-blue-600/20 text-blue-400" : "text-gray-300 hover:bg-gray-800"}
                        `}
                      >
                        <span>{tf.label}</span>
                        <div className="flex items-center gap-1">
                          {isCustom && (
                            <button
                              onClick={(e) => removeCustomTimeframe(tf.value, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded text-red-400"
                              title="Remove custom timeframe"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={(e) => toggleFavorite(tf.value, e)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-700 rounded"
                          >
                            <svg
                              className={`w-4 h-4 ${favorites.includes(tf.value) ? "text-yellow-400 fill-yellow-400" : "text-gray-500"}`}
                              fill={favorites.includes(tf.value) ? "currentColor" : "none"}
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                              />
                            </svg>
                          </button>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-gray-800 text-xs text-gray-500">
              Star timeframes for quick access
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
