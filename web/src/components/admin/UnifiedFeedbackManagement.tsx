"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Edit3,
  Trash2,
  Plus,
  Move
} from "lucide-react";

interface BugFeedback {
  id: string;
  type: string;
  title: string | null;
  textContent: string | null;
  status: string;
  implementationStatus: string;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  };
}

interface PatternCorrection {
  id: string;
  sessionId: string;
  correctionType: string;
  reason: string;
  createdAt: string;
  status: string;
  user: {
    name: string | null;
    email: string;
  };
  session: {
    name: string;
    symbol: string;
    timeframe: string;
  };
  originalType?: string;
  correctedType?: string;
}

interface SessionGroup {
  sessionId: string;
  sessionName: string;
  symbol: string;
  timeframe: string;
  corrections: PatternCorrection[];
  totalCorrections: number;
}

const CORRECTION_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  move: { label: "Moved", icon: Move, color: "text-blue-400" },
  delete: { label: "Deleted", icon: Trash2, color: "text-red-400" },
  add: { label: "Added", icon: Plus, color: "text-green-400" },
  confirm: { label: "Confirmed", icon: CheckCircle, color: "text-purple-400" },
  edit: { label: "Edited", icon: Edit3, color: "text-yellow-400" },
};

export function UnifiedFeedbackManagement() {
  const [activeTab, setActiveTab] = useState<"sessions" | "bugs">("sessions");
  const [bugFeedback, setBugFeedback] = useState<BugFeedback[]>([]);
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchAllFeedback();
  }, []);

  async function fetchAllFeedback() {
    try {
      // Fetch both types in parallel
      const [bugRes, correctionRes] = await Promise.all([
        fetch("/api/feedback"),
        fetch("/api/admin/pattern-corrections"),
      ]);

      const bugData = await bugRes.json();
      const correctionData = await correctionRes.json();

      if (bugData.success) {
        setBugFeedback(bugData.data.feedback || []);
      }

      if (correctionData.success) {
        // Group corrections by session
        const grouped = groupCorrectionsBySession(correctionData.data || []);
        setSessionGroups(grouped);
      }
    } catch (err) {
      setError("Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }

  function groupCorrectionsBySession(corrections: PatternCorrection[]): SessionGroup[] {
    const groups = new Map<string, SessionGroup>();

    corrections.forEach((correction) => {
      const sessionId = correction.sessionId;

      if (!groups.has(sessionId)) {
        groups.set(sessionId, {
          sessionId,
          sessionName: correction.session.name,
          symbol: correction.session.symbol,
          timeframe: correction.session.timeframe,
          corrections: [],
          totalCorrections: 0,
        });
      }

      const group = groups.get(sessionId)!;
      group.corrections.push(correction);
      group.totalCorrections++;
    });

    return Array.from(groups.values()).sort((a, b) => b.totalCorrections - a.totalCorrections);
  }

  function toggleSession(sessionId: string) {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  }

  const filteredSessionGroups = sessionGroups.filter((group) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = group.sessionName.toLowerCase().includes(query);
      const matchesSymbol = group.symbol.toLowerCase().includes(query);
      const matchesCorrection = group.corrections.some(
        (c) => c.reason.toLowerCase().includes(query) || c.user.email.toLowerCase().includes(query)
      );
      if (!matchesName && !matchesSymbol && !matchesCorrection) return false;
    }
    if (statusFilter !== "all") {
      const hasMatchingStatus = group.corrections.some((c) => c.status === statusFilter);
      if (!hasMatchingStatus) return false;
    }
    return true;
  });

  const totalSessionCorrections = sessionGroups.reduce((sum, g) => sum + g.totalCorrections, 0);
  const pendingCorrections = sessionGroups.reduce(
    (sum, g) => sum + g.corrections.filter((c) => c.status === "pending").length,
    0
  );
  const resolvedCorrections = sessionGroups.reduce(
    (sum, g) => sum + g.corrections.filter((c) => c.status === "resolved").length,
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-800">
          <button
            onClick={() => setActiveTab("sessions")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "sessions"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Session Corrections ({totalSessionCorrections})
          </button>
          <button
            onClick={() => setActiveTab("bugs")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "bugs"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Bug/Feature Reports ({bugFeedback.length})
          </button>
        </div>

        {activeTab === "sessions" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Total Corrections</div>
                <div className="text-2xl font-bold text-white">{totalSessionCorrections}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="text-sm text-yellow-400 mb-1">Pending Review</div>
                <div className="text-2xl font-bold text-yellow-400">{pendingCorrections}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="text-sm text-green-400 mb-1">Resolved</div>
                <div className="text-2xl font-bold text-green-400">{resolvedCorrections}</div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search sessions, corrections, users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            {/* Session Groups */}
            <div className="space-y-4">
              {filteredSessionGroups.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center text-gray-500">
                  No session corrections found
                </div>
              ) : (
                filteredSessionGroups.map((group) => {
                  const isExpanded = expandedSessions.has(group.sessionId);
                  return (
                    <div key={group.sessionId} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                      {/* Session Header */}
                      <button
                        onClick={() => toggleSession(group.sessionId)}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                          <div className="text-left">
                            <div className="font-semibold text-white">{group.sessionName}</div>
                            <div className="text-sm text-gray-400">
                              {group.symbol} • {group.timeframe} • {group.totalCorrections} corrections
                            </div>
                          </div>
                        </div>
                        <Link
                          href={`/sessions/${group.sessionId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                        >
                          View Session
                        </Link>
                      </button>

                      {/* Corrections List */}
                      {isExpanded && (
                        <div className="border-t border-gray-800">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-800/50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                    Action
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                    Reason
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                    User
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                    Status
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                    Date
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800">
                                {group.corrections.map((correction) => {
                                  const typeInfo = CORRECTION_TYPE_LABELS[correction.correctionType] || {
                                    label: correction.correctionType,
                                    icon: Edit3,
                                    color: "text-gray-400",
                                  };
                                  const Icon = typeInfo.icon;

                                  return (
                                    <tr key={correction.id} className="hover:bg-gray-800/30">
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                          <Icon className={`w-4 h-4 ${typeInfo.color}`} />
                                          <span className="text-sm text-white">{typeInfo.label}</span>
                                          {correction.originalType && (
                                            <span className="text-xs text-gray-500">
                                              {correction.originalType}
                                              {correction.correctedType && ` → ${correction.correctedType}`}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="text-sm text-gray-300 max-w-md line-clamp-2">
                                          {correction.reason}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="text-sm text-gray-400">{correction.user.name || "Unknown"}</div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <span
                                          className={`px-2 py-1 text-xs font-medium rounded ${
                                            correction.status === "pending"
                                              ? "bg-yellow-600/20 text-yellow-400"
                                              : "bg-green-600/20 text-green-400"
                                          }`}
                                        >
                                          {correction.status}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                                        {new Date(correction.createdAt).toLocaleDateString()}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {activeTab === "bugs" && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <p className="text-lg font-medium mb-2">No bug/feature reports yet</p>
            <p className="text-sm">User-submitted bugs and feature requests will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
