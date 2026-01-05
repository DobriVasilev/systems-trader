"use client";

import Link from "next/link";
import { useRive, Layout, Fit, Alignment } from "@rive-app/react-canvas";

function RiveBackground() {
  const { RiveComponent } = useRive({
    src: "/crypto-orb.riv",
    stateMachines: "State Machine 1",
    layout: new Layout({
      fit: Fit.Cover,
      alignment: Alignment.Center,
    }),
    autoplay: true,
  });

  return (
    <div className="absolute inset-0 z-0">
      <RiveComponent />
    </div>
  );
}

export default function HeroSection() {
  return (
    <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-[#0a1628]">
      <RiveBackground />

      {/* Content overlay */}
      <div className="relative z-10 container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white"
              style={{ textShadow: "0 4px 30px rgba(0,0,0,0.5)" }}>
            Systems Trader
          </h1>
          <p className="text-gray-300 text-xl md:text-2xl mb-12"
             style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>
            Collaborative platform for validating trading pattern detection algorithms
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/sessions/new"
              className="px-8 py-4 bg-blue-600 text-white rounded-full font-medium text-lg
                       hover:bg-blue-500 transition-all flex items-center justify-center gap-2
                       shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:shadow-[0_0_40px_rgba(59,130,246,0.7)]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Start New Session
            </Link>
            <Link
              href="/sessions"
              className="px-8 py-4 bg-gray-800/60 backdrop-blur-sm border border-gray-600 text-white
                       rounded-full font-medium text-lg hover:bg-gray-700/60 transition-all"
            >
              View Sessions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
