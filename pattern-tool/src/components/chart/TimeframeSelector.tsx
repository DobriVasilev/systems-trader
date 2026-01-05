"use client";

import { Timeframe } from "@/types/patterns";

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (timeframe: Timeframe) => void;
  disabled?: boolean;
}

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
];

export function TimeframeSelector({
  value,
  onChange,
  disabled = false,
}: TimeframeSelectorProps) {
  return (
    <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.value}
          onClick={() => onChange(tf.value)}
          disabled={disabled}
          className={`
            px-3 py-1.5 text-sm font-medium rounded-md transition-colors
            ${
              value === tf.value
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}
