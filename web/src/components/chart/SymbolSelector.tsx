"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface SymbolSelectorProps {
  value: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
}

interface CoinData {
  symbol: string;
  name: string;
  price: number | null;
  maxLeverage: number | null;
  type: "perp" | "spot" | "pre-launch";
  icon?: string;
}

// Fallback list if API fails
const FALLBACK_SYMBOLS = [
  "BTC", "ETH", "SOL", "DOGE", "XRP", "HYPE", "AVAX", "LINK", "ARB", "OP",
  "MATIC", "APT", "SUI", "SEI", "TIA", "INJ", "NEAR", "ATOM", "FTM", "AAVE",
];

// Coin icon component with fallback
function CoinIcon({ symbol, icon, size = 24 }: { symbol: string; icon?: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Generate gradient colors from symbol
  const getGradientColors = (sym: string) => {
    const hash = sym.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue1 = hash % 360;
    const hue2 = (hash * 2) % 360;
    return { hue1, hue2 };
  };

  const { hue1, hue2 } = getGradientColors(symbol);

  if (!icon || imgError) {
    return (
      <div
        className="rounded-full flex items-center justify-center font-bold text-white"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 40%))`,
          fontSize: size * 0.4,
        }}
      >
        {symbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {loading && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            background: `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 40%))`,
          }}
        />
      )}
      <Image
        src={icon}
        alt={symbol}
        width={size}
        height={size}
        className={`rounded-full ${loading ? "opacity-0" : "opacity-100"} transition-opacity`}
        onLoad={() => setLoading(false)}
        onError={() => {
          setImgError(true);
          setLoading(false);
        }}
        unoptimized // External URLs need this
      />
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<"all" | "perp" | "spot">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
          setCoins(FALLBACK_SYMBOLS.map(s => ({
            symbol: s,
            name: s,
            price: null,
            maxLeverage: 50,
            type: "perp" as const,
          })));
        }
      } catch {
        // Use fallback
        setCoins(FALLBACK_SYMBOLS.map(s => ({
          symbol: s,
          name: s,
          price: null,
          maxLeverage: 50,
          type: "perp" as const,
        })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchCoins();
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
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
    .filter(c => {
      // Search filter
      const matchesSearch = c.symbol.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      // Tab filter
      if (activeTab === "perp") return c.type === "perp";
      if (activeTab === "spot") return c.type === "spot";
      return true;
    })
    .sort((a, b) => {
      const aFav = favorites.includes(a.symbol);
      const bFav = favorites.includes(b.symbol);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });

  const currentCoin = coins.find(c => c.symbol === value);
  const perpCount = coins.filter(c => c.type === "perp").length;
  const spotCount = coins.filter(c => c.type === "spot").length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 bg-gray-900 rounded-lg
          text-white font-medium hover:bg-gray-800 transition-colors min-w-[160px]
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <CoinIcon symbol={value} icon={currentCoin?.icon} size={20} />
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
        <div className="absolute top-full left-0 mt-1 w-80 bg-gray-900 rounded-lg shadow-xl border border-gray-800 z-50">
          {/* Search */}
          <div className="p-2">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coins..."
              className="w-full px-3 py-2 bg-gray-800 rounded-md text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tabs */}
          <div className="flex px-2 gap-1 border-b border-gray-800 pb-2">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === "all"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              All ({coins.length})
            </button>
            <button
              onClick={() => setActiveTab("perp")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === "perp"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              Perps ({perpCount})
            </button>
            <button
              onClick={() => setActiveTab("spot")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === "spot"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              Spot ({spotCount})
            </button>
          </div>

          {/* Favorites section */}
          {favorites.length > 0 && !search && (
            <div className="px-2 py-2 border-b border-gray-800">
              <div className="text-xs text-gray-500 uppercase px-1 mb-1.5">Favorites</div>
              <div className="flex flex-wrap gap-1">
                {favorites.map(symbol => {
                  const coin = coins.find(c => c.symbol === symbol);
                  return (
                    <button
                      key={`fav-${symbol}`}
                      onClick={() => {
                        onChange(symbol);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className={`
                        px-2 py-1 text-xs rounded transition-colors flex items-center gap-1.5
                        ${value === symbol ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}
                      `}
                    >
                      <CoinIcon symbol={symbol} icon={coin?.icon} size={14} />
                      {symbol}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Coin list */}
          <div className="max-h-72 overflow-y-auto">
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
                    w-full px-3 py-2.5 text-left text-sm hover:bg-gray-800 transition-colors
                    flex items-center justify-between group
                    ${value === coin.symbol ? "bg-gray-800" : ""}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <CoinIcon symbol={coin.symbol} icon={coin.icon} size={28} />
                    <div className="flex flex-col">
                      <span className={`font-mono font-medium ${value === coin.symbol ? "text-blue-400" : "text-gray-200"}`}>
                        {coin.symbol}
                      </span>
                      <span className="text-xs text-gray-500">{coin.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <span className="text-gray-300 text-xs font-mono">
                        {formatPrice(coin.price)}
                      </span>
                      <span className={`text-[10px] px-1.5 rounded ${
                        coin.type === "perp"
                          ? "bg-purple-500/20 text-purple-400"
                          : coin.type === "spot"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {coin.type.toUpperCase()}
                      </span>
                    </div>
                    <button
                      onClick={(e) => toggleFavorite(coin.symbol, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-700 rounded"
                    >
                      <svg
                        className={`w-4 h-4 ${favorites.includes(coin.symbol) ? "text-yellow-400 fill-yellow-400" : "text-gray-500"}`}
                        fill={favorites.includes(coin.symbol) ? "currentColor" : "none"}
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
            {coins.length} coins available ({perpCount} perps, {spotCount} spot)
          </div>
        </div>
      )}
    </div>
  );
}
