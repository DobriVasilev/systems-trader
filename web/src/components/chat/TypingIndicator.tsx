"use client";

import { TELEGRAM_COLORS } from "@/lib/telegram-theme";

interface TypingIndicatorProps {
  users: Array<{ userId: string; userName: string }>;
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const getText = () => {
    if (users.length === 1) {
      return `${users[0].userName} is typing`;
    } else if (users.length === 2) {
      return `${users[0].userName} and ${users[1].userName} are typing`;
    } else {
      return `${users.length} people are typing`;
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 text-sm"
      style={{ color: TELEGRAM_COLORS.hint }}
    >
      {/* Animated dots */}
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{
              backgroundColor: TELEGRAM_COLORS.hint,
              animationDelay: `${i * 0.15}s`,
              animationDuration: "0.6s",
            }}
          />
        ))}
      </div>
      <span>{getText()}</span>
    </div>
  );
}

// Chat list typing preview (replaces last message)
interface TypingPreviewProps {
  userName: string;
}

export function TypingPreview({ userName }: TypingPreviewProps) {
  return (
    <div className="flex items-center gap-1" style={{ color: TELEGRAM_COLORS.primary }}>
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1 h-1 rounded-full animate-bounce"
            style={{
              backgroundColor: TELEGRAM_COLORS.primary,
              animationDelay: `${i * 0.15}s`,
              animationDuration: "0.6s",
            }}
          />
        ))}
      </div>
      <span className="text-xs">typing...</span>
    </div>
  );
}
