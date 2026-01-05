"use client";

import { useState, useRef, useEffect } from "react";

interface SymbolSelectorProps {
  value: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
}

const POPULAR_SYMBOLS = [
  "BTC",
  "ETH",
  "SOL",
  "DOGE",
  "XRP",
  "AVAX",
  "LINK",
  "ARB",
  "OP",
  "MATIC",
];

export function SymbolSelector({
  value,
  onChange,
  disabled = false,
}: SymbolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking the toggle button (let the button's onClick handle it)
      if (buttonRef.current?.contains(event.target as Node)) {
        return;
      }
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSymbols = POPULAR_SYMBOLS.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-4 py-2 bg-gray-900 rounded-lg
          text-white font-medium hover:bg-gray-800 transition-colors
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <span>{value}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-gray-900 rounded-lg shadow-xl border border-gray-800 z-50">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 bg-gray-800 rounded-md text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredSymbols.map((symbol) => (
              <button
                key={symbol}
                onClick={() => {
                  onChange(symbol);
                  setIsOpen(false);
                  setSearch("");
                }}
                className={`
                  w-full px-4 py-2 text-left text-sm hover:bg-gray-800 transition-colors
                  ${value === symbol ? "text-blue-400" : "text-gray-300"}
                `}
              >
                {symbol}
              </button>
            ))}
            {filteredSymbols.length === 0 && (
              <div className="px-4 py-2 text-sm text-gray-500">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
