"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Lightweight interactive background with cursor-following spotlight and floating particles
function InteractiveBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
    };

    const handleMouseDown = () => setIsPressed(true);
    const handleMouseUp = () => setIsPressed(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden bg-[#0a1628]">
      {/* Cursor-following spotlight */}
      <div
        className={`absolute w-[800px] h-[800px] rounded-full pointer-events-none transition-transform duration-100 ${
          isPressed ? "scale-110" : "scale-100"
        }`}
        style={{
          left: `${mousePos.x * 100}%`,
          top: `${mousePos.y * 100}%`,
          transform: `translate(-50%, -50%) ${isPressed ? "scale(1.1)" : "scale(1)"}`,
          background: `radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 40%, transparent 70%)`,
        }}
      />

      {/* Central glowing orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={`w-[400px] h-[400px] rounded-full transition-transform duration-200 ${isPressed ? "scale-95" : "scale-100"}`}>
          <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-[80px] animate-pulse" />
          <div className="absolute inset-[20%] rounded-full bg-blue-600/15 blur-[50px] animate-[pulse_3s_ease-in-out_infinite]" />
          <div className="absolute inset-[35%] rounded-full bg-blue-400/20 blur-[30px] animate-[pulse_2s_ease-in-out_infinite_0.5s]" />
        </div>
      </div>

      {/* Floating particles */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className={`absolute rounded-full bg-blue-400/30 blur-[1px] transition-transform duration-200 ${
            isPressed ? "scale-150" : "scale-100"
          }`}
          style={{
            width: `${4 + (i % 3) * 2}px`,
            height: `${4 + (i % 3) * 2}px`,
            left: `${10 + (i * 7) % 80}%`,
            top: `${15 + (i * 11) % 70}%`,
            animation: `float ${5 + (i % 4)}s ease-in-out infinite ${i * 0.3}s`,
          }}
        />
      ))}

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-10px); }
          75% { transform: translateY(-25px) translateX(5px); }
        }
      `}</style>
    </div>
  );
}

export default function HeroSection() {
  return (
    <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      <InteractiveBackground />

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
