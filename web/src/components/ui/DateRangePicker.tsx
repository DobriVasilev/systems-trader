"use client";

import { useState, useRef, useEffect, useMemo } from "react";

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

type PresetRange = {
  label: string;
  getValue: () => { start: Date; end: Date };
};

const PRESET_RANGES: PresetRange[] = [
  {
    label: "Today",
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start, end: now };
    },
  },
  {
    label: "Yesterday",
    getValue: () => {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      return { start, end };
    },
  },
  {
    label: "Last 7 days",
    getValue: () => ({
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    label: "Last 14 days",
    getValue: () => ({
      start: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    label: "Last 30 days",
    getValue: () => ({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    label: "Last 60 days",
    getValue: () => ({
      start: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    label: "Last 90 days",
    getValue: () => ({
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    label: "Last 6 months",
    getValue: () => ({
      start: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    label: "Last 1 year",
    getValue: () => ({
      start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
  },
  {
    label: "Year to date",
    getValue: () => ({
      start: new Date(new Date().getFullYear(), 0, 1),
      end: new Date(),
    }),
  },
  {
    label: "All time",
    getValue: () => ({
      start: new Date(2020, 0, 1), // Hyperliquid launch ~2020
      end: new Date(),
    }),
  },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  disabled = false,
  minDate,
  maxDate = new Date(),
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [tempStart, setTempStart] = useState<Date | null>(null);
  const [tempEnd, setTempEnd] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setTempStart(null);
        setTempEnd(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset temp states when opening
  useEffect(() => {
    if (isOpen) {
      setTempStart(startDate);
      setTempEnd(endDate);
      setViewDate(endDate);
      setSelecting("start");
    }
  }, [isOpen, startDate, endDate]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Get calendar days for the view month
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startPadding = firstDay.getDay();
    const days: (Date | null)[] = [];

    // Add padding for days before the first day of month
    for (let i = 0; i < startPadding; i++) {
      const prevDate = new Date(year, month, -startPadding + i + 1);
      days.push(prevDate);
    }

    // Add days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Add padding to complete the last week
    const remaining = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  }, [viewDate]);

  const handleDayClick = (date: Date) => {
    if (disabled) return;
    if (minDate && date < minDate) return;
    if (maxDate && date > maxDate) return;

    if (selecting === "start") {
      setTempStart(date);
      if (tempEnd && date > tempEnd) {
        setTempEnd(null);
      }
      setSelecting("end");
    } else {
      if (tempStart && date < tempStart) {
        // If selecting end before start, swap them
        setTempEnd(tempStart);
        setTempStart(date);
      } else {
        setTempEnd(date);
      }
      setSelecting("start");
    }
  };

  const handleApply = () => {
    if (tempStart && tempEnd) {
      // Set start to beginning of day and end to end of day
      const start = new Date(tempStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(tempEnd);
      end.setHours(23, 59, 59, 999);
      onChange(start, end);
      setIsOpen(false);
    }
  };

  const handlePresetClick = (preset: PresetRange) => {
    const { start, end } = preset.getValue();
    setTempStart(start);
    setTempEnd(end);
    onChange(start, end);
    setIsOpen(false);
  };

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const prevYear = () => {
    setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1));
  };

  const nextYear = () => {
    setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1));
  };

  const isInRange = (date: Date) => {
    const start = tempStart || startDate;
    const end = hoverDate || tempEnd || endDate;

    if (!start || !end) return false;

    const dateTime = date.getTime();
    const startTime = Math.min(start.getTime(), end.getTime());
    const endTime = Math.max(start.getTime(), end.getTime());

    return dateTime >= startTime && dateTime <= endTime;
  };

  const isStartDate = (date: Date) => {
    const start = tempStart || startDate;
    return start && date.toDateString() === start.toDateString();
  };

  const isEndDate = (date: Date) => {
    const end = tempEnd || endDate;
    return end && date.toDateString() === end.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === viewDate.getMonth();
  };

  const isToday = (date: Date) => {
    return date.toDateString() === new Date().toDateString();
  };

  const isDisabled = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                 hover:bg-gray-750 transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="text-sm">
          {formatDateShort(startDate)} - {formatDateShort(endDate)}
        </span>
        <span className="text-xs text-gray-500">({daysDiff}d)</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-gray-900 border border-gray-700
                      rounded-lg shadow-xl flex overflow-hidden">
          {/* Presets */}
          <div className="w-36 border-r border-gray-700 py-2">
            <div className="px-3 py-1 text-xs text-gray-500 uppercase font-medium">Presets</div>
            {PRESET_RANGES.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-800 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-3 w-72">
            {/* Selection indicator */}
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-700">
              <button
                onClick={() => setSelecting("start")}
                className={`flex-1 px-2 py-1.5 rounded text-sm text-left border transition-colors ${
                  selecting === "start"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <div className="text-xs text-gray-500 mb-0.5">Start</div>
                <div className="font-medium">{tempStart ? formatDate(tempStart) : "Select..."}</div>
              </button>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <button
                onClick={() => setSelecting("end")}
                className={`flex-1 px-2 py-1.5 rounded text-sm text-left border transition-colors ${
                  selecting === "end"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <div className="text-xs text-gray-500 mb-0.5">End</div>
                <div className="font-medium">{tempEnd ? formatDate(tempEnd) : "Select..."}</div>
              </button>
            </div>

            {/* Month/Year navigation */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={prevYear}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                  title="Previous year"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={prevMonth}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                  title="Previous month"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>

              <div className="text-sm font-medium">
                {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={nextMonth}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                  title="Next month"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={nextYear}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                  title="Next year"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {DAYS.map((day) => (
                <div key={day} className="text-center text-xs text-gray-500 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((date, idx) => {
                if (!date) return <div key={idx} />;

                const inRange = isInRange(date);
                const isStart = isStartDate(date);
                const isEnd = isEndDate(date);
                const inCurrentMonth = isCurrentMonth(date);
                const today = isToday(date);
                const dateDisabled = isDisabled(date);

                return (
                  <button
                    key={idx}
                    onClick={() => !dateDisabled && handleDayClick(date)}
                    onMouseEnter={() => selecting === "end" && tempStart && setHoverDate(date)}
                    onMouseLeave={() => setHoverDate(null)}
                    disabled={dateDisabled}
                    className={`
                      relative h-8 text-sm rounded transition-colors
                      ${dateDisabled ? "text-gray-700 cursor-not-allowed" : "hover:bg-gray-700"}
                      ${!inCurrentMonth ? "text-gray-600" : ""}
                      ${inRange && !isStart && !isEnd ? "bg-blue-500/20" : ""}
                      ${isStart || isEnd ? "bg-blue-600 text-white font-medium" : ""}
                      ${today && !isStart && !isEnd ? "ring-1 ring-blue-500" : ""}
                    `}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-700">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setTempStart(null);
                  setTempEnd(null);
                }}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={!tempStart || !tempEnd}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
