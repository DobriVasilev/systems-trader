"use client";

import { useState, useRef, useEffect } from "react";
import { Timeframe } from "@/types/patterns";

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (timeframe: Timeframe) => void;
  disabled?: boolean;
}

interface TimeframeOption {
  value: Timeframe;
  label: string;
  category: string;
}

const ALL_TIMEFRAMES: TimeframeOption[] = [
  // Seconds (for future support)
  // { value: "1s" as Timeframe, label: "1s", category: "SECONDS" },
  // { value: "5s" as Timeframe, label: "5s", category: "SECONDS" },
  // { value: "15s" as Timeframe, label: "15s", category: "SECONDS" },
  // { value: "30s" as Timeframe, label: "30s", category: "SECONDS" },

  // Minutes
  { value: "1m", label: "1m", category: "MINUTES" },
  { value: "5m", label: "5m", category: "MINUTES" },
  { value: "15m", label: "15m", category: "MINUTES" },
  { value: "30m", label: "30m", category: "MINUTES" },

  // Hours
  { value: "1h", label: "1H", category: "HOURS" },
  { value: "4h", label: "4H", category: "HOURS" },

  // Days/Weeks
  { value: "1d", label: "1D", category: "DAYS" },
  { value: "1w", label: "1W", category: "DAYS" },
];

// Default quick-access timeframes
const DEFAULT_QUICK_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

export function TimeframeSelector({
  value,
  onChange,
  disabled = false,
}: TimeframeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [favorites, setFavorites] = useState<Timeframe[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("favoriteTimeframes");
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch {
        setFavorites([]);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
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

  // Determine which timeframes to show in quick bar
  const quickTimeframes = favorites.length > 0
    ? favorites
    : DEFAULT_QUICK_TIMEFRAMES;

  // Group timeframes by category for dropdown
  const groupedTimeframes = ALL_TIMEFRAMES.reduce((acc, tf) => {
    if (!acc[tf.category]) acc[tf.category] = [];
    acc[tf.category].push(tf);
    return acc;
  }, {} as Record<string, TimeframeOption[]>);

  return (
    <div className="flex items-center gap-1" ref={dropdownRef}>
      {/* Quick access buttons */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
        {quickTimeframes.slice(0, 7).map((tf) => {
          const option = ALL_TIMEFRAMES.find(o => o.value === tf);
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
              {option?.label || tf.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Dropdown for all timeframes */}
      <div className="relative">
        <button
          ref={buttonRef}
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
          <div className="absolute right-0 top-full mt-1 w-56 bg-gray-900 rounded-lg shadow-xl border border-gray-800 z-50">
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-800">
              <div className="text-xs text-gray-500 uppercase font-medium">Timeframes</div>
            </div>


            {/* Grouped timeframes */}
            <div className="max-h-72 overflow-y-auto">
              {Object.entries(groupedTimeframes).map(([category, tfs]) => (
                <div key={category}>
                  <div className="px-3 py-1.5 text-xs text-gray-500 uppercase bg-gray-800/50">
                    {category}
                  </div>
                  {tfs.map((tf) => (
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
                    </button>
                  ))}
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
