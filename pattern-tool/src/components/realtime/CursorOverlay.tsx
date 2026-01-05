"use client";

import { CursorPosition } from "@/lib/realtime";

interface CursorOverlayProps {
  cursors: Map<string, CursorPosition>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

// Generate a consistent color from user ID
function getUserColor(userId: string): string {
  const colors = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#ec4899", // pink
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash = hash & hash;
  }

  return colors[Math.abs(hash) % colors.length];
}

export function CursorOverlay({ cursors, containerRef }: CursorOverlayProps) {
  if (!containerRef.current) return null;

  const containerRect = containerRef.current.getBoundingClientRect();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-50">
      {Array.from(cursors.entries()).map(([userId, cursor]) => {
        const color = getUserColor(userId);

        // Ensure cursor is within container bounds
        const x = Math.min(Math.max(cursor.x, 0), containerRect.width - 20);
        const y = Math.min(Math.max(cursor.y, 0), containerRect.height - 20);

        return (
          <div
            key={userId}
            className="absolute transition-all duration-75 ease-out"
            style={{
              left: x,
              top: y,
            }}
          >
            {/* Cursor arrow */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ color }}
            >
              <path
                d="M5.5 3.21V20.79C5.5 21.55 6.39 21.97 6.97 21.47L10.74 18.09C11.01 17.85 11.36 17.71 11.73 17.71H18.29C19.05 17.71 19.46 16.82 18.97 16.24L6.03 2.42C5.53 1.85 4.5 2.21 5.5 3.21Z"
                fill="currentColor"
              />
              <path
                d="M5.5 3.21V20.79C5.5 21.55 6.39 21.97 6.97 21.47L10.74 18.09C11.01 17.85 11.36 17.71 11.73 17.71H18.29C19.05 17.71 19.46 16.82 18.97 16.24L6.03 2.42C5.53 1.85 4.5 2.21 5.5 3.21Z"
                stroke="white"
                strokeWidth="1"
              />
            </svg>

            {/* User name label */}
            <div
              className="absolute left-4 top-4 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {cursor.userName || "Anonymous"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
