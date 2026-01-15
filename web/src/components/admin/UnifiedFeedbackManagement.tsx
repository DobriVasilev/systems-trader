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
  Move,
  Copy,
  Download,
  User
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

interface IndicatorReasoning {
  id: string;
  indicatorType: string;
  title: string;
  description: string;
  status: string;
  votes: number;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  };
}

export function UnifiedFeedbackManagement() {
  const [activeTab, setActiveTab] = useState<"sessions" | "bugs" | "indicators">("sessions");
  const [bugFeedback, setBugFeedback] = useState<BugFeedback[]>([]);
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>([]);
  const [indicatorReasoning, setIndicatorReasoning] = useState<IndicatorReasoning[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchAllFeedback();
  }, []);

  async function fetchAllFeedback() {
    try {
      // Fetch all three types in parallel
      const [bugRes, correctionRes, reasoningRes] = await Promise.all([
        fetch("/api/feedback"),
        fetch("/api/admin/pattern-corrections"),
        fetch("/api/indicators/reasoning"),
      ]);

      const bugData = await bugRes.json();
      const correctionData = await correctionRes.json();
      const reasoningData = await reasoningRes.json();

      if (bugData.success) {
        setBugFeedback(bugData.data.feedback || []);
      }

      if (correctionData.success) {
        // Group corrections by session
        const grouped = groupCorrectionsBySession(correctionData.data || []);
        setSessionGroups(grouped);
      }

      if (reasoningData.success) {
        setIndicatorReasoning(reasoningData.data.reasoning || []);
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

  function generateClaudePrompt(correction: PatternCorrection): string {
    const typeInfo = CORRECTION_TYPE_LABELS[correction.correctionType] || { label: correction.correctionType };
    return `# Pattern Correction Feedback

**Session:** ${correction.session.name}
**Symbol:** ${correction.session.symbol}
**Timeframe:** ${correction.session.timeframe}
**User:** ${correction.user.name || "Unknown"} (${correction.user.email})

## Correction Details
- **Action:** ${typeInfo.label}
- **Original Type:** ${correction.originalType || "N/A"}
- **Corrected Type:** ${correction.correctedType || "N/A"}

## Reason
${correction.reason}

## Task
Please review this pattern correction and implement the necessary changes to improve pattern detection accuracy.

**Session ID:** ${correction.sessionId}
**Correction ID:** ${correction.id}
**Date:** ${new Date(correction.createdAt).toLocaleString()}`;
  }

  function generateIndicatorPrompt(reasoning: IndicatorReasoning): string {
    return `# Indicator Reasoning Implementation Request

**Indicator Type:** ${reasoning.indicatorType.replace(/_/g, " ")}
**Title:** ${reasoning.title}
**User:** ${reasoning.user.name || "Unknown"} (${reasoning.user.email})

## Description
${reasoning.description}

## Task
Please review this indicator reasoning and implement the pattern detection logic.

**Reasoning ID:** ${reasoning.id}
**Votes:** ${reasoning.votes}
**Status:** ${reasoning.status}
**Submitted:** ${new Date(reasoning.createdAt).toLocaleString()}`;
  }

  async function copyClaudePrompt(id: string, type: "correction" | "reasoning") {
    try {
      let prompt = "";
      if (type === "correction") {
        const correction = sessionGroups
          .flatMap(g => g.corrections)
          .find(c => c.id === id);
        if (correction) {
          prompt = generateClaudePrompt(correction);
        }
      } else {
        const reasoning = indicatorReasoning.find(r => r.id === id);
        if (reasoning) {
          prompt = generateIndicatorPrompt(reasoning);
        }
      }

      await navigator.clipboard.writeText(prompt);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  function downloadJSON(data: any, filename: string) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadAllSessionData() {
    const data = {
      exported: new Date().toISOString(),
      totalSessions: sessionGroups.length,
      totalCorrections: totalSessionCorrections,
      sessions: sessionGroups.map(group => ({
        sessionId: group.sessionId,
        sessionName: group.sessionName,
        symbol: group.symbol,
        timeframe: group.timeframe,
        corrections: group.corrections.map(c => ({
          id: c.id,
          type: c.correctionType,
          reason: c.reason,
          status: c.status,
          user: c.user,
          originalType: c.originalType,
          correctedType: c.correctedType,
          createdAt: c.createdAt,
        })),
      })),
    };
    downloadJSON(data, `session-corrections-${Date.now()}.json`);
  }

  function downloadAllIndicatorData() {
    const data = {
      exported: new Date().toISOString(),
      total: indicatorReasoning.length,
      reasoning: indicatorReasoning,
    };
    downloadJSON(data, `indicator-reasoning-${Date.now()}.json`);
  }

  // Get unique users for filter
  const uniqueUsers = Array.from(
    new Set(
      sessionGroups
        .flatMap(g => g.corrections)
        .map(c => c.user.email)
    )
  ).sort();

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
    if (userFilter !== "all") {
      const hasMatchingUser = group.corrections.some((c) => c.user.email === userFilter);
      if (!hasMatchingUser) return false;
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
          <button
            onClick={() => setActiveTab("indicators")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "indicators"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Indicator Reasoning ({indicatorReasoning.length})
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
              <div className="flex gap-4 mb-4">
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
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 min-w-[140px]"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </select>
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 min-w-[200px]"
                >
                  <option value="all">All Users</option>
                  {uniqueUsers.map((email) => (
                    <option key={email} value={email}>
                      {email}
                    </option>
                  ))}
                </select>
                <button
                  onClick={downloadAllSessionData}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  Download All
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Filter className="w-3 h-3" />
                <span>
                  Showing {filteredSessionGroups.length} of {sessionGroups.length} sessions
                  {userFilter !== "all" && ` • Filtered by user: ${userFilter}`}
                </span>
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
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                    Actions
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
                                        <div className="flex items-center gap-2">
                                          <User className="w-4 h-4 text-gray-500" />
                                          <div>
                                            <div className="text-sm text-white font-medium">{correction.user.name || "Unknown"}</div>
                                            <div className="text-xs text-gray-500">{correction.user.email}</div>
                                          </div>
                                        </div>
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
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <button
                                          onClick={() => copyClaudePrompt(correction.id, "correction")}
                                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors flex items-center gap-1.5"
                                        >
                                          {copiedId === correction.id ? (
                                            <>
                                              <CheckCircle className="w-3 h-3" />
                                              Copied!
                                            </>
                                          ) : (
                                            <>
                                              <Copy className="w-3 h-3" />
                                              Copy Prompt
                                            </>
                                          )}
                                        </button>
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

        {activeTab === "indicators" && (
          <>
            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              {indicatorReasoning.length > 0 && (
                <button
                  onClick={downloadAllIndicatorData}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download All
                </button>
              )}
              <Link
                href="/indicators/submit"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Submit New Reasoning
              </Link>
            </div>

            {/* Indicator Reasoning List */}
            {indicatorReasoning.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p className="text-lg font-medium mb-2">No indicator reasoning submitted yet</p>
                <p className="text-sm mb-4">Share your pattern recognition logic to help improve the algorithms</p>
                <Link
                  href="/indicators/submit"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Submit Reasoning
                </Link>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800 border-b border-gray-700">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Indicator
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Title
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Votes
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {indicatorReasoning.map((reasoning) => (
                        <tr key={reasoning.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium rounded bg-purple-600/20 text-purple-400">
                              {reasoning.indicatorType.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-white">{reasoning.title}</div>
                            <div className="text-sm text-gray-400 line-clamp-1 mt-1">
                              {reasoning.description}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white">{reasoning.user.name || "Unknown"}</div>
                            <div className="text-xs text-gray-500">{reasoning.user.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded ${
                                reasoning.status === "PENDING"
                                  ? "bg-yellow-600/20 text-yellow-400"
                                  : reasoning.status === "APPROVED"
                                  ? "bg-green-600/20 text-green-400"
                                  : reasoning.status === "IMPLEMENTED"
                                  ? "bg-blue-600/20 text-blue-400"
                                  : "bg-gray-600/20 text-gray-400"
                              }`}
                            >
                              {reasoning.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1 text-gray-400">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-sm">{reasoning.votes}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {new Date(reasoning.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => copyClaudePrompt(reasoning.id, "reasoning")}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors flex items-center gap-1.5"
                            >
                              {copiedId === reasoning.id ? (
                                <>
                                  <CheckCircle className="w-3 h-3" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  Copy Prompt
                                </>
                              )}
                            </button>
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
