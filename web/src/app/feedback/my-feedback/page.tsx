"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import Link from "next/link";

interface FeedbackItem {
  id: string;
  type: string;
  indicator: string | null;
  customIndicator: string | null;
  title: string | null;
  textContent: string | null;
  status: string;
  createdAt: string;
  implementedAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-900/30 text-yellow-400 border-yellow-800",
  IN_PROGRESS: "bg-blue-900/30 text-blue-400 border-blue-800",
  IMPLEMENTED: "bg-green-900/30 text-green-400 border-green-800",
  CLOSED: "bg-gray-900/30 text-gray-400 border-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending Review",
  IN_PROGRESS: "In Progress",
  IMPLEMENTED: "Implemented",
  CLOSED: "Closed",
};

export default function MyFeedbackPage() {
  const { data: session, status } = useSession();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "PENDING" | "IMPLEMENTED">("all");

  useEffect(() => {
    if (status === "authenticated") {
      fetchFeedback();
    }
  }, [status, filter]);

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

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    redirect("/auth/login");
  }

  const pendingCount = feedback.filter((f) => f.status === "PENDING").length;
  const implementedCount = feedback.filter((f) => f.status === "IMPLEMENTED").length;

  return (
    <div className="min-h-screen bg-black text-white">
      <AppHeader title="My Feedback" />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Feedback</h1>
            <p className="text-gray-400">Track your submitted feedback and suggestions</p>
          </div>
          <Link
            href="/feedback"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            + New Feedback
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <div className="text-2xl font-bold text-white">{feedback.length}</div>
            <div className="text-sm text-gray-400">Total Submitted</div>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
            <div className="text-sm text-gray-400">Pending Review</div>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <div className="text-2xl font-bold text-green-400">{implementedCount}</div>
            <div className="text-sm text-gray-400">Implemented</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            All ({feedback.length})
          </button>
          <button
            onClick={() => setFilter("PENDING")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "PENDING"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter("IMPLEMENTED")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === "IMPLEMENTED"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Implemented ({implementedCount})
          </button>
        </div>

        {/* Feedback List */}
        {feedback.length === 0 ? (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No feedback yet</h3>
            <p className="text-gray-500 mb-6">
              Submit your first feedback to help us improve the trading indicators
            </p>
            <Link
              href="/feedback"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              Submit Feedback
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {feedback.map((item) => (
              <div
                key={item.id}
                className="bg-gray-900 rounded-lg border border-gray-800 p-6 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {/* Indicator Badge */}
                      {item.indicator && (
                        <span className="px-3 py-1 bg-blue-900/30 text-blue-400 border border-blue-800 rounded-full text-xs font-medium">
                          {item.indicator === "Other" && item.customIndicator
                            ? item.customIndicator
                            : item.indicator}
                        </span>
                      )}
                      {/* Status Badge */}
                      <span
                        className={`px-3 py-1 border rounded-full text-xs font-medium ${
                          STATUS_COLORS[item.status] || STATUS_COLORS.PENDING
                        }`}
                      >
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {item.title || "Untitled Feedback"}
                    </h3>
                    <p className="text-gray-400 line-clamp-2">{item.textContent}</p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                    {item.implementedAt && (
                      <div className="text-xs text-green-400 mt-1">
                        Implemented {new Date(item.implementedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
