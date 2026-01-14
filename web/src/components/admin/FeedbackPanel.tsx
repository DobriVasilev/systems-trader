"use client";

import { useState, useEffect } from "react";

interface FeedbackItem {
  id: string;
  type: string;
  indicator: string | null;
  customIndicator: string | null;
  title: string | null;
  textContent: string | null;
  voiceTranscription: string | null;
  status: string;
  priority: number;
  createdAt: string;
  pageUrl: string | null;
  pagePath: string | null;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
  attachments: Array<{
    id: string;
    filename: string;
    url: string;
    category: string;
  }>;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    user: {
      name: string | null;
    };
  }>;
}

const FEEDBACK_TYPE_EMOJIS: Record<string, string> = {
  BUG_REPORT: "🐛",
  FEATURE_REQUEST: "✨",
  UI_UX_ISSUE: "🎨",
  PERFORMANCE_ISSUE: "⚡",
  QUESTION: "❓",
  OTHER: "💬",
};

const FEEDBACK_TYPE_COLORS: Record<string, string> = {
  BUG_REPORT: "text-red-400 bg-red-900/20",
  FEATURE_REQUEST: "text-blue-400 bg-blue-900/20",
  UI_UX_ISSUE: "text-purple-400 bg-purple-900/20",
  PERFORMANCE_ISSUE: "text-yellow-400 bg-yellow-900/20",
  QUESTION: "text-green-400 bg-green-900/20",
  OTHER: "text-gray-400 bg-gray-800",
};

export function FeedbackPanel() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING" | "IMPLEMENTED" | "all">("PENDING");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [implementing, setImplementing] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedback();
  }, [filter]);

  const fetchFeedback = async () => {
    setIsLoading(true);
    try {
      const statusParam = filter === "all" ? "" : `&status=${filter}`;
      const response = await fetch(`/api/feedback?limit=100${statusParam}`);
      const data = await response.json();

      if (data.success) {
        setFeedback(data.data.feedback);
      }
    } catch (error) {
      console.error("Error fetching feedback:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyPrompt = async (feedbackId: string) => {
    try {
      const response = await fetch(`/api/feedback/${feedbackId}/generate-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "full" }),
      });

      const data = await response.json();

      if (data.success) {
        await navigator.clipboard.writeText(data.data.prompt);
        setCopiedId(feedbackId);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (error) {
      console.error("Error copying prompt:", error);
      alert("Failed to copy prompt");
    }
  };

  const markAsImplemented = async (feedbackId: string) => {
    if (!confirm("Mark this feedback as implemented? The user will be notified.")) {
      return;
    }

    setImplementing(feedbackId);
    try {
      const response = await fetch(`/api/feedback/${feedbackId}/implement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success) {
        await fetchFeedback();
        if (selectedFeedback?.id === feedbackId) {
          setSelectedFeedback(null);
        }
        alert("✅ Feedback marked as implemented!");
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error marking as implemented:", error);
      alert("Failed to update feedback");
    } finally {
      setImplementing(null);
    }
  };

  const pendingCount = feedback.filter(f => f.status === "PENDING").length;
  const implementedCount = feedback.filter(f => f.status === "IMPLEMENTED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">User Feedback</h2>
          <p className="text-sm text-gray-400 mt-1">
            Universal feedback from across the application
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("PENDING")}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === "PENDING"
                ? "bg-yellow-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter("IMPLEMENTED")}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === "IMPLEMENTED"
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Done ({implementedCount})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            All ({feedback.length})
          </button>
        </div>
      </div>

      {/* Feedback List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading feedback...</div>
      ) : feedback.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No feedback found</div>
      ) : (
        <div className="grid gap-4">
          {feedback.map((item) => {
            const emoji = FEEDBACK_TYPE_EMOJIS[item.type] || "📝";
            const colorClass = FEEDBACK_TYPE_COLORS[item.type] || "text-gray-400 bg-gray-800";
            const content = item.voiceTranscription || item.textContent || "(No description)";

            return (
              <div
                key={item.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left side - Content */}
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">{emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs px-2 py-1 rounded ${colorClass}`}>
                            {item.type.replace("_", " ")}
                          </span>
                          {item.indicator && (
                            <span className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-400 border border-blue-800">
                              📊 {item.indicator === "Other" && item.customIndicator ? item.customIndicator : item.indicator}
                            </span>
                          )}
                          {item.status === "IMPLEMENTED" && (
                            <span className="text-xs px-2 py-1 rounded bg-green-900/20 text-green-400">
                              ✓ Implemented
                            </span>
                          )}
                          {item.priority > 0 && (
                            <span className="text-xs px-2 py-1 rounded bg-orange-900/20 text-orange-400">
                              Priority: {item.priority}
                            </span>
                          )}
                        </div>

                        {item.title && (
                          <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                        )}

                        <p className="text-gray-300 text-sm line-clamp-2">{content}</p>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        {item.user.image ? (
                          <img
                            src={item.user.image}
                            alt=""
                            className="w-4 h-4 rounded-full"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center text-[10px]">
                            {item.user.name?.[0] || "U"}
                          </div>
                        )}
                        {item.user.name || item.user.email}
                      </span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      {item.pagePath && <span>📍 {item.pagePath}</span>}
                      {item.attachments.length > 0 && (
                        <span>📎 {item.attachments.length} attachment(s)</span>
                      )}
                    </div>
                  </div>

                  {/* Right side - Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setSelectedFeedback(item)}
                      className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      View Details
                    </button>

                    <button
                      onClick={() => copyPrompt(item.id)}
                      disabled={copiedId === item.id}
                      className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {copiedId === item.id ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Prompt
                        </>
                      )}
                    </button>

                    {item.status === "PENDING" && (
                      <button
                        onClick={() => markAsImplemented(item.id)}
                        disabled={implementing === item.id}
                        className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {implementing === item.id ? "Updating..." : "Mark Done"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-800">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-2xl">
                      {FEEDBACK_TYPE_EMOJIS[selectedFeedback.type] || "📝"}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${FEEDBACK_TYPE_COLORS[selectedFeedback.type]}`}>
                      {selectedFeedback.type.replace("_", " ")}
                    </span>
                    {selectedFeedback.indicator && (
                      <span className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-400 border border-blue-800">
                        📊 {selectedFeedback.indicator === "Other" && selectedFeedback.customIndicator ? selectedFeedback.customIndicator : selectedFeedback.indicator}
                      </span>
                    )}
                  </div>
                  {selectedFeedback.title && (
                    <h2 className="text-2xl font-bold text-white mb-2">{selectedFeedback.title}</h2>
                  )}
                </div>
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {selectedFeedback.voiceTranscription && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Voice Transcription:</h3>
                    <p className="text-white bg-gray-800 p-4 rounded-lg">{selectedFeedback.voiceTranscription}</p>
                  </div>
                )}

                {selectedFeedback.textContent && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Description:</h3>
                    <p className="text-white whitespace-pre-wrap">{selectedFeedback.textContent}</p>
                  </div>
                )}

                {selectedFeedback.pageUrl && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Page:</h3>
                    <a
                      href={selectedFeedback.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline text-sm"
                    >
                      {selectedFeedback.pageUrl}
                    </a>
                  </div>
                )}

                {selectedFeedback.attachments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Attachments:</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedFeedback.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          {att.category === "image" ? "🖼️" : "📎"}
                          <span className="text-sm text-white truncate">{att.filename}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <button
                  onClick={() => copyPrompt(selectedFeedback.id)}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Copy Full Prompt
                </button>
                {selectedFeedback.status === "PENDING" && (
                  <button
                    onClick={() => {
                      markAsImplemented(selectedFeedback.id);
                      setSelectedFeedback(null);
                    }}
                    className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    Mark as Implemented
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
