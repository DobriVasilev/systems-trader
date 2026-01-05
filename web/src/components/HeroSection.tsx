"use client";

import Link from "next/link";
import { useRive, Layout, Fit, Alignment } from "@rive-app/react-canvas";

function RiveBackground() {
  const { RiveComponent } = useRive({
    src: "https://public.rive.app/community/runtime-files/18667-35097-crypto-website-concept.riv",
    stateMachines: "State Machine 1",
    artboard: "CoinOrb",
    layout: new Layout({
      fit: Fit.Cover,
      alignment: Alignment.Center,
    }),
    autoplay: true,
  });

  return (
    <div className="absolute inset-0 z-0 opacity-50">
      <RiveComponent />
    </div>
  );
}

export default function HeroSection() {
  return (
    <div className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      <RiveBackground />

      {/* Content overlay */}
      <div className="relative z-10 container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 drop-shadow-lg">
            Systems Trader
          </h1>
          <p className="text-gray-300 text-xl mb-12 drop-shadow-md">
            Collaborative platform for validating trading pattern detection algorithms
          </p>

          <div className="flex justify-center gap-4">
            <Link
              href="/sessions/new"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium text-lg
                       hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Start New Session
            </Link>
            <Link
              href="/sessions"
              className="px-6 py-3 bg-gray-800/80 backdrop-blur text-white rounded-lg font-medium text-lg
                       hover:bg-gray-700 transition-colors shadow-lg"
            >
              View Sessions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
