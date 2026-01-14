"use client";

import { useFeedback } from "@/contexts/FeedbackContext";
import { TELEGRAM_COLORS } from "@/lib/telegram-theme";

export function FloatingFeedbackWidget() {
  const { isOpen, isMinimized, openFeedback, restoreFeedback, closeFeedback } = useFeedback();

  // Show FAB when feedback is not open, or show minimized widget when minimized
  if (!isOpen && !isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => openFeedback()}
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 relative"
          style={{
            backgroundColor: TELEGRAM_COLORS.primary,
            color: TELEGRAM_COLORS.buttonText,
          }}
          title="Send Feedback (Alt + F) • Voice or Text"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          {/* Voice indicator badge */}
          <div
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: "#fff",
              border: `2px solid ${TELEGRAM_COLORS.primary}`,
            }}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: TELEGRAM_COLORS.primary }}>
              <path d="M7 4a3 3 0 016 0v4a3 3 0 01-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
            </svg>
          </div>
        </button>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-6 right-6 rounded-2xl shadow-2xl z-40 overflow-hidden"
        style={{
          backgroundColor: TELEGRAM_COLORS.secondaryBg,
          border: `2px solid ${TELEGRAM_COLORS.primary}`,
          width: "320px",
        }}
      >
        <div
          className="flex items-center gap-3 p-4"
          style={{ backgroundColor: TELEGRAM_COLORS.primary }}
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
            💬
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold" style={{ color: "#fff" }}>
              Feedback Draft Saved
            </h3>
            <p className="text-xs opacity-80" style={{ color: "#fff" }}>
              Continue writing your feedback
            </p>
          </div>
          <button
            onClick={closeFeedback}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            style={{ color: "#fff" }}
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3">
          <button
            onClick={restoreFeedback}
            className="w-full py-3 px-4 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: TELEGRAM_COLORS.primary,
              color: TELEGRAM_COLORS.buttonText,
            }}
          >
            Continue Editing
          </button>

          <button
            onClick={closeFeedback}
            className="w-full py-2 px-4 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: "transparent",
              border: `1px solid ${TELEGRAM_COLORS.border}`,
              color: TELEGRAM_COLORS.hint,
            }}
          >
            Discard Draft
          </button>
        </div>
      </div>
    );
  }

  return null;
}
