"use client";

import { useState, useRef, useEffect } from "react";

interface SymbolSelectorProps {
  value: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
}

interface CoinData {
  symbol: string;
  price: number | null;
  maxLeverage: number;
}

// Fallback list if API fails
const FALLBACK_SYMBOLS = [
  "BTC", "ETH", "SOL", "DOGE", "XRP", "HYPE", "AVAX", "LINK", "ARB", "OP",
  "MATIC", "APT", "SUI", "SEI", "TIA", "INJ", "NEAR", "ATOM", "FTM", "AAVE",
];

export function SymbolSelector({
  value,
  onChange,
  disabled = false,
}: SymbolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("favoriteCoins");
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch {
        setFavorites([]);
      }
    }
  }, []);

  // Fetch coins from Hyperliquid
  useEffect(() => {
    async function fetchCoins() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/hyperliquid/coins");
        const data = await response.json();
        if (data.success) {
          setCoins(data.data);
        } else {
          // Use fallback
          setCoins(FALLBACK_SYMBOLS.map(s => ({ symbol: s, price: null, maxLeverage: 50 })));
        }
      } catch {
        // Use fallback
        setCoins(FALLBACK_SYMBOLS.map(s => ({ symbol: s, price: null, maxLeverage: 50 })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchCoins();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking the toggle button
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

  const toggleFavorite = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavorites = favorites.includes(symbol)
      ? favorites.filter(f => f !== symbol)
      : [...favorites, symbol];
    setFavorites(newFavorites);
    localStorage.setItem("favoriteCoins", JSON.stringify(newFavorites));
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return "-";
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  // Filter and sort coins
  const filteredCoins = coins
    .filter(c => c.symbol.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aFav = favorites.includes(a.symbol);
      const bFav = favorites.includes(b.symbol);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });

  const currentCoin = coins.find(c => c.symbol === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-4 py-2 bg-gray-900 rounded-lg
          text-white font-medium hover:bg-gray-800 transition-colors min-w-[140px]
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <span className="font-mono">{value}</span>
        {currentCoin?.price && (
          <span className="text-gray-400 text-sm">{formatPrice(currentCoin.price)}</span>
        )}
        <svg
          className={`w-4 h-4 transition-transform ml-auto ${isOpen ? "rotate-180" : ""}`}
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
        <div className="absolute top-full left-0 mt-1 w-72 bg-gray-900 rounded-lg shadow-xl border border-gray-800 z-50">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coins..."
              className="w-full px-3 py-2 bg-gray-800 rounded-md text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Favorites section */}
          {favorites.length > 0 && !search && (
            <div className="px-2 pb-2">
              <div className="text-xs text-gray-500 uppercase px-2 mb-1">Favorites</div>
              <div className="flex flex-wrap gap-1">
                {favorites.map(symbol => (
                  <button
                    key={`fav-${symbol}`}
                    onClick={() => {
                      onChange(symbol);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`
                      px-2 py-1 text-xs rounded transition-colors flex items-center gap-1
                      ${value === symbol ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}
                    `}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-800" />

          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredCoins.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">No coins found</div>
            ) : (
              filteredCoins.map((coin) => (
                <button
                  key={coin.symbol}
                  onClick={() => {
                    onChange(coin.symbol);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`
                    w-full px-4 py-2.5 text-left text-sm hover:bg-gray-800 transition-colors
                    flex items-center justify-between group
                    ${value === coin.symbol ? "bg-gray-800" : ""}
                  `}
                >
                  <div className="flex items-center gap-3">
                    {/* Coin icon placeholder */}
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                      {coin.symbol.slice(0, 2)}
                    </div>
                    <span className={`font-mono ${value === coin.symbol ? "text-blue-400" : "text-gray-200"}`}>
                      {coin.symbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs">
                      {formatPrice(coin.price)}
                    </span>
                    <button
                      onClick={(e) => toggleFavorite(coin.symbol, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-700 rounded"
                    >
                      <svg
                        className={`w-4 h-4 ${favorites.includes(coin.symbol) ? "text-yellow-400 fill-yellow-400" : "text-gray-500"}`}
                        fill="none"
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
              ))
            )}
          </div>

          <div className="border-t border-gray-800 px-3 py-2 text-xs text-gray-500">
            {coins.length} coins available
          </div>
        </div>
      )}
    </div>
  );
}
