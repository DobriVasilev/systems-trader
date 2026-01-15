"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Play,
  CheckCircle,
  Clock,
  XCircle,
  ChevronRight,
  Plus,
  TestTube,
  Code,
  Lightbulb,
  Wrench,
  ExternalLink,
} from "lucide-react";

interface Implementation {
  id: string;
  title: string;
  description: string | null;
  type: string;
  phase: string;
  status: string;
  progress: number;
  sessionId: string | null;
  indicatorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

interface Session {
  id: string;
  name: string;
  patternType: string;
  symbol: string;
  timeframe: string;
  status: string;
  createdAt: Date;
}

interface ImplementationsDashboardProps {
  implementations: Implementation[];
  sessions: Session[];
}

const PHASE_ICONS: Record<string, any> = {
  planning: Lightbulb,
  implementing: Code,
  testing: TestTube,
  refining: Wrench,
  completed: CheckCircle,
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  completed: "text-green-400 bg-green-500/10 border-green-500/30",
  failed: "text-red-400 bg-red-500/10 border-red-500/30",
  paused: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  cancelled: "text-gray-400 bg-gray-500/10 border-gray-500/30",
};

export function ImplementationsDashboard({
  implementations,
  sessions,
}: ImplementationsDashboardProps) {
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "failed">("all");

  const filteredImplementations = implementations.filter(impl => {
    if (filter === "all") return true;
    return impl.status === filter;
  });

  const activeCount = implementations.filter(i => i.status === "active").length;
  const completedCount = implementations.filter(i => i.status === "completed").length;
  const failedCount = implementations.filter(i => i.status === "failed").length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Pattern Implementations</h1>
        <p className="text-gray-400">
          Test patterns, send corrections to Claude Code, and track implementation progress
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-1">Total</div>
          <div className="text-2xl font-bold text-white">{implementations.length}</div>
        </div>
        <div className="bg-gray-900 border border-blue-500/30 rounded-lg p-6">
          <div className="text-sm text-blue-400 mb-1 flex items-center gap-2">
            <Play className="w-4 h-4" />
            Active
          </div>
          <div className="text-2xl font-bold text-blue-400">{activeCount}</div>
        </div>
        <div className="bg-gray-900 border border-green-500/30 rounded-lg p-6">
          <div className="text-sm text-green-400 mb-1 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Completed
          </div>
          <div className="text-2xl font-bold text-green-400">{completedCount}</div>
        </div>
        <div className="bg-gray-900 border border-red-500/30 rounded-lg p-6">
          <div className="text-sm text-red-400 mb-1 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Failed
          </div>
          <div className="text-2xl font-bold text-red-400">{failedCount}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-white/10 text-white"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("active")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "active"
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter("completed")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "completed"
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Completed
        </button>
        <button
          onClick={() => setFilter("failed")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "failed"
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Failed
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content - Implementations */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Implementation Sessions</h2>
          </div>

          {filteredImplementations.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
              <Code className="w-12 h-12 mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400 mb-2">No implementations yet</p>
              <p className="text-sm text-gray-500">
                Create a test session and send corrections to start
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredImplementations.map((impl) => {
                const PhaseIcon = PHASE_ICONS[impl.phase] || Clock;
                const statusColor = STATUS_COLORS[impl.status];

                return (
                  <Link
                    key={impl.id}
                    href={`/implementation/${impl.id}`}
                    className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg p-4 transition-all hover:shadow-lg group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg border ${statusColor}`}>
                          <PhaseIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate">{impl.title}</div>
                          <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                            <span className="capitalize">{impl.phase.replace(/_/g, " ")}</span>
                            <span>•</span>
                            <span>{impl.progress}% complete</span>
                            {impl.startedAt && (
                              <>
                                <span>•</span>
                                <span>
                                  {new Date(impl.startedAt).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar - Available Sessions */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Test Sessions</h3>
            <Link
              href="/sessions/new"
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-4"
            >
              <Plus className="w-4 h-4" />
              Create New Test Session
            </Link>

            <div className="space-y-2">
              {sessions.slice(0, 5).map((session) => (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg p-3 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{session.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {session.symbol} • {session.timeframe}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors flex-shrink-0 ml-2" />
                  </div>
                </Link>
              ))}

              {sessions.length > 5 && (
                <Link
                  href="/sessions"
                  className="block text-center text-sm text-blue-400 hover:text-blue-300 pt-2"
                >
                  View all {sessions.length} sessions →
                </Link>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-2 text-sm">
              <Link
                href="/indicators/submit"
                className="block text-gray-400 hover:text-white transition-colors"
              >
                → Submit new indicator idea
              </Link>
              <Link
                href="/admin"
                className="block text-gray-400 hover:text-white transition-colors"
              >
                → View all feedback
              </Link>
              <Link
                href="/dashboard"
                className="block text-gray-400 hover:text-white transition-colors"
              >
                → Main dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
