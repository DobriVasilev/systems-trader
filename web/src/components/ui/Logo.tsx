"use client";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
}

const sizes = {
  sm: { icon: "w-6 h-6", text: "text-sm" },
  md: { icon: "w-8 h-8", text: "text-lg" },
  lg: { icon: "w-10 h-10", text: "text-xl" },
  xl: { icon: "w-12 h-12", text: "text-2xl" },
};

export function Logo({ size = "md", className = "", showText = true }: LogoProps) {
  const { icon, text } = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg className={icon} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Background circle with gradient */}
        <defs>
          <linearGradient id="logo-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="0.5" stopColor="#2563EB" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="logo-line" x1="8" y1="8" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#93C5FD" />
            <stop offset="1" stopColor="#60A5FA" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Main background - rounded square */}
        <rect x="2" y="2" width="36" height="36" rx="8" fill="url(#logo-bg)" />

        {/* Inner subtle pattern */}
        <rect x="4" y="4" width="32" height="32" rx="6" fill="black" fillOpacity="0.15" />

        {/* Candlestick chart representation */}
        <g filter="url(#glow)">
          {/* Candle 1 - bearish */}
          <rect x="9" y="14" width="4" height="12" rx="1" fill="#EF4444" />
          <line x1="11" y1="10" x2="11" y2="14" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="11" y1="26" x2="11" y2="30" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />

          {/* Candle 2 - bullish */}
          <rect x="18" y="18" width="4" height="8" rx="1" fill="#22C55E" />
          <line x1="20" y1="14" x2="20" y2="18" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="20" y1="26" x2="20" y2="30" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />

          {/* Candle 3 - bullish (higher) */}
          <rect x="27" y="10" width="4" height="10" rx="1" fill="#22C55E" />
          <line x1="29" y1="6" x2="29" y2="10" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="29" y1="20" x2="29" y2="24" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* Trend line connecting swing points */}
        <path
          d="M11 26 L20 18 L29 10"
          stroke="url(#logo-line)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.9"
        />

        {/* Swing point markers */}
        <circle cx="11" cy="26" r="2" fill="#60A5FA" />
        <circle cx="20" cy="18" r="2" fill="#60A5FA" />
        <circle cx="29" cy="10" r="2" fill="#60A5FA" />
      </svg>

      {showText && (
        <span className={`font-semibold ${text}`}>
          Systems Trader
        </span>
      )}
    </div>
  );
}

// Simplified icon-only version for favicons and small spaces
export function LogoIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-icon-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="0.5" stopColor="#2563EB" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="36" height="36" rx="8" fill="url(#logo-icon-bg)" />
      <rect x="4" y="4" width="32" height="32" rx="6" fill="black" fillOpacity="0.15" />

      {/* Candles */}
      <rect x="9" y="14" width="4" height="12" rx="1" fill="#EF4444" />
      <line x1="11" y1="10" x2="11" y2="14" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="26" x2="11" y2="30" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />

      <rect x="18" y="18" width="4" height="8" rx="1" fill="#22C55E" />
      <line x1="20" y1="14" x2="20" y2="18" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="26" x2="20" y2="30" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />

      <rect x="27" y="10" width="4" height="10" rx="1" fill="#22C55E" />
      <line x1="29" y1="6" x2="29" y2="10" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="29" y1="20" x2="29" y2="24" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />

      {/* Trend line */}
      <path d="M11 26 L20 18 L29 10" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />

      {/* Points */}
      <circle cx="11" cy="26" r="2" fill="#60A5FA" />
      <circle cx="20" cy="18" r="2" fill="#60A5FA" />
      <circle cx="29" cy="10" r="2" fill="#60A5FA" />
    </svg>
  );
}

export default Logo;
