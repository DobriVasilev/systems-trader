"use client";

import { useState } from "react";
import Link from "next/link";
import { useSessions, PatternSession } from "@/hooks/useSessions";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SessionCard({
  session,
  onDelete,
}: {
  session: PatternSession;
  onDelete: (id: string) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this session?")) return;

    setIsDeleting(true);
    await onDelete(session.id);
    setIsDeleting(false);
  };

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="block bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition-colors border border-gray-800 hover:border-gray-700"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-lg text-white">{session.name}</h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
            <span className="font-mono">{session.symbol}/USD</span>
            <span className="text-gray-600">|</span>
            <span>{session.timeframe.toUpperCase()}</span>
            <span className="text-gray-600">|</span>
            <span className="capitalize">{session.patternType.replace("_", " ")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
            title="Delete session"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <span>{session._count.detections} detections</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <span>{session._count.corrections} corrections</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span>{session._count.comments} comments</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          {session.createdBy.image ? (
            <img
              src={session.createdBy.image}
              alt={session.createdBy.name || ""}
              className="w-5 h-5 rounded-full"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-gray-700" />
          )}
          <span className="text-sm text-gray-400">
            {session.createdBy.name || session.createdBy.email}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          Updated {formatDate(session.updatedAt)}
        </span>
      </div>
    </Link>
  );
}

export default function SessionsPage() {
  const { sessions, isLoading, error, deleteSession } = useSessions();

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              Systems Trader
            </Link>
            <span className="text-gray-500">/</span>
            <span className="text-gray-400">Sessions</span>
          </div>
          <Link
            href="/sessions/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium
                     hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Session
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {error ? (
          <div className="text-center py-12">
            <div className="text-red-400 mb-2">Error loading sessions</div>
            <div className="text-gray-500 text-sm">{error}</div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400">Loading sessions...</span>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">No sessions yet</div>
            <Link
              href="/sessions/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create your first session
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onDelete={deleteSession}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
