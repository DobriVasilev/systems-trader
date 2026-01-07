"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  createdAt: string;
  _count: {
    createdSessions: number;
  };
}

interface Session {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  patternType: string;
  status: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  _count: {
    detections: number;
    corrections: number;
    comments: number;
  };
  feedbackCount: number;
  hasFeedback: boolean;
}

interface Stats {
  users: number;
  sessions: number;
  sessionsWithFeedback: number;
  detections: number;
  corrections: number;
  comments: number;
  totalFeedback: number;
}

export default function AdminPage() {
  const { data: authSession, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"overview" | "users" | "sessions">("sessions");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "withFeedback">("all");
  const [exporting, setExporting] = useState<string | null>(null);

  // Fetch data based on active tab
  useEffect(() => {
    if (status === "loading") return;
    if (!authSession?.user) {
      router.push("/auth/login");
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const type = activeTab === "overview" ? "overview" : activeTab;
        const response = await fetch(`/api/admin?type=${type}`);
        const data = await response.json();

        if (!data.success) {
          if (response.status === 403) {
            setError("Admin access required");
            return;
          }
          throw new Error(data.error);
        }

        if (activeTab === "overview") {
          setStats(data.data);
        } else if (activeTab === "users") {
          setUsers(data.data);
        } else if (activeTab === "sessions") {
          setSessions(data.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeTab, authSession, status, router]);

  // Quick export function
  const handleExport = async (sessionId: string) => {
    setExporting(sessionId);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/export`);
      const data = await response.json();

      if (data.success) {
        // Copy to clipboard
        const exportText = JSON.stringify(data.data, null, 2);
        await navigator.clipboard.writeText(exportText);
        alert("Exported data copied to clipboard!");
      } else {
        alert("Export failed: " + data.error);
      }
    } catch {
      alert("Export failed");
    } finally {
      setExporting(null);
    }
  };

  const filteredSessions = filter === "withFeedback"
    ? sessions.filter((s) => s.hasFeedback)
    : sessions;

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (error === "Admin access required") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-4">You need admin privileges to access this page.</p>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="px-2 py-1 bg-red-900/50 text-red-300 rounded text-xs">ADMIN</span>
              <span>{authSession?.user?.name || authSession?.user?.email}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-gray-900/50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {(["sessions", "users", "overview"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "text-white border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full" />
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-300">
            {error}
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Users" value={stats.users} />
                <StatCard label="Total Sessions" value={stats.sessions} />
                <StatCard label="Sessions with Feedback" value={stats.sessionsWithFeedback} highlight />
                <StatCard label="Total Detections" value={stats.detections} />
                <StatCard label="Corrections (Reasons)" value={stats.corrections} />
                <StatCard label="Comments" value={stats.comments} />
                <StatCard label="Total Feedback" value={stats.totalFeedback} highlight />
              </div>
            )}

            {/* Users Tab */}
            {activeTab === "users" && (
              <div className="space-y-4">
                <div className="text-sm text-gray-400">
                  {users.length} users
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Sessions</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-800/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {user.image ? (
                                <img src={user.image} alt="" className="w-8 h-8 rounded-full" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-700" />
                              )}
                              <span className="font-medium">{user.name || "Anonymous"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">{user.email}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-xs rounded ${
                                user.role === "admin"
                                  ? "bg-red-900/50 text-red-300"
                                  : "bg-gray-700 text-gray-300"
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{user._count.createdSessions}</td>
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sessions Tab */}
            {activeTab === "sessions" && (
              <div className="space-y-4">
                {/* Filter */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFilter("all")}
                      className={`px-3 py-1.5 text-sm rounded ${
                        filter === "all"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-white"
                      }`}
                    >
                      All ({sessions.length})
                    </button>
                    <button
                      onClick={() => setFilter("withFeedback")}
                      className={`px-3 py-1.5 text-sm rounded ${
                        filter === "withFeedback"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-white"
                      }`}
                    >
                      With Feedback ({sessions.filter((s) => s.hasFeedback).length})
                    </button>
                  </div>
                  <div className="text-sm text-gray-400">
                    Showing {filteredSessions.length} sessions
                  </div>
                </div>

                {/* Sessions list */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Session</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Owner</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Detections</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Feedback</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Updated</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {filteredSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-gray-800/50">
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium">{session.name}</div>
                              <div className="text-xs text-gray-500">
                                {session.symbol} • {session.timeframe} • {session.patternType}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {session.createdBy.image ? (
                                <img src={session.createdBy.image} alt="" className="w-6 h-6 rounded-full" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gray-700" />
                              )}
                              <span className="text-sm">{session.createdBy.name || session.createdBy.email}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">{session._count.detections}</td>
                          <td className="px-4 py-3">
                            {session.hasFeedback ? (
                              <span className="px-2 py-1 text-xs bg-green-900/50 text-green-300 rounded">
                                {session.feedbackCount} items
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {new Date(session.updatedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/sessions/${session.id}`}
                                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                              >
                                Open
                              </Link>
                              {session.hasFeedback && (
                                <button
                                  onClick={() => handleExport(session.id)}
                                  disabled={exporting === session.id}
                                  className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
                                >
                                  {exporting === session.id ? "..." : "Export"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-lg border ${highlight ? "bg-blue-900/20 border-blue-700" : "bg-gray-900 border-gray-800"}`}>
      <div className="text-sm text-gray-400">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? "text-blue-400" : ""}`}>{value}</div>
    </div>
  );
}
