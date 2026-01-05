"use client";

import { useState } from "react";

const logos = [
  {
    id: "geometric-lines",
    name: "Geometric Lines",
    description: "Clean geometric lines forming an abstract chart pattern",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <path
          d="M8 48 L20 32 L28 40 L40 24 L52 36 L56 28"
          fill="none"
          stroke="url(#grad1)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="32" r="3" fill="#3b82f6" />
        <circle cx="40" cy="24" r="3" fill="#8b5cf6" />
        <circle cx="56" cy="28" r="3" fill="#a855f7" />
      </svg>
    ),
  },
  {
    id: "hexagon-pulse",
    name: "Hexagon Pulse",
    description: "Hexagonal shape with ascending bars inside",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="grad2" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <polygon
          points="32,4 58,18 58,46 32,60 6,46 6,18"
          fill="none"
          stroke="url(#grad2)"
          strokeWidth="2.5"
        />
        <rect x="16" y="38" width="6" height="14" fill="#06b6d4" rx="1" />
        <rect x="25" y="30" width="6" height="22" fill="#3b82f6" rx="1" />
        <rect x="34" y="22" width="6" height="30" fill="#6366f1" rx="1" />
        <rect x="43" y="18" width="6" height="34" fill="#8b5cf6" rx="1" />
      </svg>
    ),
  },
  {
    id: "wave-pulse",
    name: "Wave Pulse",
    description: "Dynamic wave representing market momentum",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <path
          d="M4 40 Q16 20 24 32 T40 28 T56 24 L60 20"
          fill="none"
          stroke="url(#grad3)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M4 48 Q16 32 24 40 T40 36 T56 32 L60 28"
          fill="none"
          stroke="url(#grad3)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle cx="60" cy="20" r="4" fill="#8b5cf6" />
      </svg>
    ),
  },
  {
    id: "diamond-chart",
    name: "Diamond Chart",
    description: "Diamond with integrated candlestick pattern",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <path
          d="M32 4 L58 32 L32 60 L6 32 Z"
          fill="none"
          stroke="url(#grad4)"
          strokeWidth="2.5"
        />
        <line x1="18" y1="42" x2="18" y2="24" stroke="#10b981" strokeWidth="2" />
        <rect x="15" y="28" width="6" height="10" fill="#10b981" />
        <line x1="32" y1="48" x2="32" y2="18" stroke="#ef4444" strokeWidth="2" />
        <rect x="29" y="22" width="6" height="16" fill="#ef4444" />
        <line x1="46" y1="40" x2="46" y2="26" stroke="#10b981" strokeWidth="2" />
        <rect x="43" y="30" width="6" height="6" fill="#10b981" />
      </svg>
    ),
  },
  {
    id: "minimal-s",
    name: "Minimal S",
    description: "Stylized S lettermark with gradient",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="grad5" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <path
          d="M44 16 C44 16 48 16 48 22 C48 28 32 28 32 32 C32 36 48 36 48 42 C48 48 44 48 44 48 L20 48 C20 48 16 48 16 42 C16 36 32 36 32 32 C32 28 16 28 16 22 C16 16 20 16 20 16 L44 16 Z"
          fill="none"
          stroke="url(#grad5)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "pulse-circle",
    name: "Pulse Circle",
    description: "Circular logo with pulse line through center",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="grad6" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="26" fill="none" stroke="url(#grad6)" strokeWidth="3" />
        <path
          d="M10 32 L22 32 L26 20 L30 44 L34 28 L38 36 L42 32 L54 32"
          fill="none"
          stroke="url(#grad6)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "bull-minimal",
    name: "Bull Minimal",
    description: "Abstract bull horns representing bullish markets",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="grad7" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <path
          d="M12 48 C12 48 12 24 24 16 L32 24"
          fill="none"
          stroke="url(#grad7)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M52 48 C52 48 52 24 40 16 L32 24"
          fill="none"
          stroke="url(#grad7)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="24" r="4" fill="#10b981" />
      </svg>
    ),
  },
  {
    id: "arrow-stack",
    name: "Arrow Stack",
    description: "Stacked ascending arrows showing growth",
    svg: (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="grad8" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <path d="M32 8 L48 24 L40 24 L40 36 L24 36 L24 24 L16 24 Z" fill="#8b5cf6" />
        <path d="M32 24 L44 36 L38 36 L38 46 L26 46 L26 36 L20 36 Z" fill="#6366f1" opacity="0.7" />
        <path d="M32 38 L42 48 L36 48 L36 56 L28 56 L28 48 L22 48 Z" fill="#4f46e5" opacity="0.5" />
      </svg>
    ),
  },
];

export default function LogoPickerPage() {
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [hoveredLogo, setHoveredLogo] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-blue-500/10 via-transparent to-transparent" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-purple-500/10 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Systems Trader
          </h1>
          <p className="text-gray-400 text-lg mb-2">Choose your brand identity</p>
          <p className="text-gray-500 text-sm">Select a logo that represents your trading vision</p>
        </div>

        {/* Logo Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto mb-16">
          {logos.map((logo) => (
            <button
              key={logo.id}
              onClick={() => setSelectedLogo(logo.id)}
              onMouseEnter={() => setHoveredLogo(logo.id)}
              onMouseLeave={() => setHoveredLogo(null)}
              className={`
                group relative aspect-square rounded-2xl p-8 transition-all duration-300
                ${
                  selectedLogo === logo.id
                    ? "bg-gradient-to-br from-blue-600/30 to-purple-600/30 ring-2 ring-blue-500 shadow-lg shadow-blue-500/20"
                    : "bg-gray-900/50 hover:bg-gray-800/70 border border-gray-800 hover:border-gray-700"
                }
              `}
            >
              {/* Logo */}
              <div
                className={`
                  w-full h-full transition-transform duration-300
                  ${hoveredLogo === logo.id || selectedLogo === logo.id ? "scale-110" : ""}
                `}
              >
                {logo.svg}
              </div>

              {/* Selection indicator */}
              {selectedLogo === logo.id && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}

              {/* Name overlay */}
              <div
                className={`
                  absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-gray-900 to-transparent
                  transition-opacity duration-300
                  ${hoveredLogo === logo.id || selectedLogo === logo.id ? "opacity-100" : "opacity-0"}
                `}
              >
                <p className="text-sm font-medium text-center">{logo.name}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Logo Preview */}
        {selectedLogo && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-900/50 rounded-3xl p-8 border border-gray-800">
              <h2 className="text-xl font-semibold mb-6 text-center text-gray-300">
                Preview
              </h2>

              {/* Large preview */}
              <div className="flex flex-col items-center gap-8">
                <div className="w-32 h-32">
                  {logos.find((l) => l.id === selectedLogo)?.svg}
                </div>

                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">
                    {logos.find((l) => l.id === selectedLogo)?.name}
                  </h3>
                  <p className="text-gray-400">
                    {logos.find((l) => l.id === selectedLogo)?.description}
                  </p>
                </div>

                {/* Mock header preview */}
                <div className="w-full bg-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10">
                      {logos.find((l) => l.id === selectedLogo)?.svg}
                    </div>
                    <span className="font-semibold text-lg">Systems Trader</span>
                    <div className="ml-auto flex gap-4 text-sm text-gray-400">
                      <span>Sessions</span>
                      <span>New Session</span>
                    </div>
                  </div>
                </div>

                {/* Size variants */}
                <div className="flex items-end gap-8 py-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6">
                      {logos.find((l) => l.id === selectedLogo)?.svg}
                    </div>
                    <span className="text-xs text-gray-500">24px</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10">
                      {logos.find((l) => l.id === selectedLogo)?.svg}
                    </div>
                    <span className="text-xs text-gray-500">40px</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16">
                      {logos.find((l) => l.id === selectedLogo)?.svg}
                    </div>
                    <span className="text-xs text-gray-500">64px</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-24">
                      {logos.find((l) => l.id === selectedLogo)?.svg}
                    </div>
                    <span className="text-xs text-gray-500">96px</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={() => {
                  alert(`Selected logo: ${selectedLogo}\n\nTo use this logo, export the SVG code from this page.`);
                }}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium
                         hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/20"
              >
                Use This Logo
              </button>
              <button
                onClick={() => setSelectedLogo(null)}
                className="px-8 py-3 bg-gray-800 text-gray-300 rounded-xl font-medium
                         hover:bg-gray-700 transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div className="text-center mt-16 text-gray-500 text-sm">
          <p>Click on a logo to select it and preview how it looks in different contexts</p>
        </div>
      </div>
    </main>
  );
}
