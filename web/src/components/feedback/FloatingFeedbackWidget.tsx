"use client";

import { useFeedback } from "@/contexts/FeedbackContext";
import { TELEGRAM_COLORS } from "@/lib/telegram-theme";

export function FloatingFeedbackWidget() {
  const { isOpen, isMinimized, openFeedback, restoreFeedback, closeFeedback } = useFeedback();

  // Show FAB when feedback is not open, or show minimized widget when minimized
  if (!isOpen && !isMinimized) {
    return (
      <button
        onClick={() => openFeedback()}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-40 transition-transform hover:scale-110 active:scale-95"
        style={{
          backgroundColor: TELEGRAM_COLORS.primary,
          color: TELEGRAM_COLORS.buttonText,
        }}
        title="Send Feedback (Alt + F)"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </button>
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
