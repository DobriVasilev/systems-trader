"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  Clock,
  CheckCircle,
  AlertCircle,
  GitCommit,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Play,
  XCircle,
  User,
  Calendar,
  Activity,
  MessageSquare,
} from "lucide-react";
import { ClaudeChatInterface } from "./ClaudeChatInterface";

interface ExecutionData {
  execution: {
    id: string;
    workspaceId: string;
    status: string;
    phase: string | null;
    progress: number;
    triggeredAt: string;
    completedAt: string | null;
    erroredAt: string | null;
    sessionIds: string[];
    filesChanged: string[];
    commitHash: string | null;
    commitMessage: string | null;
    deployStatus: string | null;
    deployUrl: string | null;
    error: string | null;
    claudeSessionId: string | null;
    sessionResumed: boolean;
    claudeOutput: string | null;
    retryCount: number;
  };
  workspace: {
    id: string;
    name: string;
    patternType: string;
    category: string;
    status: string;
    version: string;
  };
  triggeredBy: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  sessions: Array<{
    id: string;
    name: string;
    symbol: string;
    timeframe: string;
    patternType: string;
    corrections: Array<{
      id: string;
      correctionType: string;
      reason: string;
      originalTime: string | null;
      originalPrice: number | null;
      correctedTime: string | null;
      correctedPrice: number | null;
      correctedType: string | null;
      user: {
        name: string | null;
        email: string;
      };
    }>;
  }>;
  messages: Array<{
    id: string;
    type: string;
    title: string | null;
    content: string | null;
    authorType: string;
    status: string | null;
    progress: number | null;
    createdAt: string;
  }>;
  fileDiffs: Record<string, string>;
}

export function ExecutionViewer({ executionId }: { executionId: string }) {
  const [data, setData] = useState<ExecutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    transcript: true,
    sessions: true,
    files: true,
    timeline: false,
  });
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/admin/claude-executions/${executionId}`);
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || "Failed to load execution data");
        }
      } catch (err) {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [executionId]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleFile = (file: string) => {
    setExpandedFiles((prev) => ({ ...prev, [file]: !prev[file] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          {error || "Failed to load execution data"}
        </div>
      </div>
    );
  }

  const { execution, workspace, triggeredBy, sessions, messages, fileDiffs } = data;

  const statusColor =
    execution.status === "completed"
      ? "text-green-400"
      : execution.status === "failed"
      ? "text-red-400"
      : execution.status === "running"
      ? "text-yellow-400"
      : "text-gray-400";

  const statusBg =
    execution.status === "completed"
      ? "bg-green-900/20 border-green-800"
      : execution.status === "failed"
      ? "bg-red-900/20 border-red-800"
      : execution.status === "running"
      ? "bg-yellow-900/20 border-yellow-800"
      : "bg-gray-800 border-gray-700";

  const executionDuration = execution.completedAt
    ? Math.round(
        (new Date(execution.completedAt).getTime() - new Date(execution.triggeredAt).getTime()) /
          1000 /
          60
      )
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/admin"
            className="text-sm text-blue-400 hover:text-blue-300 mb-2 inline-block"
          >
            ← Back to Admin Dashboard
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{workspace.name}</h1>
              <p className="text-gray-400">
                {workspace.category} · {workspace.patternType} · v{workspace.version}
              </p>
            </div>
            <div className={`px-4 py-2 rounded-lg border ${statusBg}`}>
              <span className={`text-sm font-medium ${statusColor}`}>
                {execution.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <User className="w-4 h-4" />
              <span className="text-xs">Triggered By</span>
            </div>
            <div className="text-white font-medium">{triggeredBy.name || triggeredBy.email}</div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-xs">Started</span>
            </div>
            <div className="text-white font-medium">
              {new Date(execution.triggeredAt).toLocaleString()}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Duration</span>
            </div>
            <div className="text-white font-medium">
              {executionDuration !== null ? `${executionDuration}m` : "In progress..."}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Activity className="w-4 h-4" />
              <span className="text-xs">Session Resumed</span>
            </div>
            <div className="text-white font-medium">{execution.sessionResumed ? "Yes" : "No"}</div>
          </div>
        </div>

        {/* Error Alert */}
        {execution.error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-400 mb-1">Execution Failed</h3>
                <p className="text-sm text-red-300">{execution.error}</p>
                {execution.retryCount > 0 && (
                  <p className="text-xs text-gray-400 mt-2">Retry count: {execution.retryCount}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Claude Transcript */}
        {execution.claudeOutput && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg">
            <button
              onClick={() => toggleSection("transcript")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">Claude Code Transcript</h3>
              </div>
              {expandedSections.transcript ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {expandedSections.transcript && (
              <div className="px-6 pb-6">
                <div className="bg-black rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                    {execution.claudeOutput}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sessions & Corrections */}
        {sessions.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg">
            <button
              onClick={() => toggleSection("sessions")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">
                  Sessions & Corrections ({sessions.length})
                </h3>
              </div>
              {expandedSections.sessions ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {expandedSections.sessions && (
              <div className="px-6 pb-6 space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-white">{session.name}</h4>
                        <p className="text-sm text-gray-400 mt-1">
                          {session.symbol} · {session.timeframe}
                        </p>
                      </div>
                      <Link
                        href={`/sessions/${session.id}`}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    {session.corrections.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-400 uppercase">
                          Corrections ({session.corrections.length})
                        </div>
                        {session.corrections.map((correction) => (
                          <div key={correction.id} className="bg-gray-900/50 rounded p-3 text-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-xs">
                                {correction.correctionType}
                              </span>
                              {correction.correctedType && (
                                <span className="text-xs text-gray-400">→ {correction.correctedType}</span>
                              )}
                            </div>
                            <p className="text-gray-300 mb-2">{correction.reason}</p>
                            <div className="text-xs text-gray-500">
                              By {correction.user.name || correction.user.email}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Files Changed */}
        {execution.filesChanged.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg">
            <button
              onClick={() => toggleSection("files")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <GitCommit className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white">
                  Files Changed ({execution.filesChanged.length})
                </h3>
                {execution.commitHash && (
                  <Link
                    href={`https://github.com/DobriVasilev/systems-trader/commit/${execution.commitHash}`}
                    target="_blank"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {execution.commitHash.slice(0, 7)} <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
              {expandedSections.files ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {expandedSections.files && (
              <div className="px-6 pb-6 space-y-3">
                {execution.commitMessage && (
                  <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                    <div className="text-xs text-gray-400 mb-2">Commit Message</div>
                    <pre className="text-sm text-white whitespace-pre-wrap">{execution.commitMessage}</pre>
                  </div>
                )}
                {execution.filesChanged.map((file) => (
                  <div key={file} className="bg-gray-800/50 rounded-lg">
                    <button
                      onClick={() => toggleFile(file)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors rounded-lg"
                    >
                      <span className="text-sm text-white font-mono">{file}</span>
                      {expandedFiles[file] ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    {expandedFiles[file] && fileDiffs[file] && (
                      <div className="px-4 pb-4">
                        <div className="bg-black rounded p-4 overflow-x-auto">
                          <pre className="text-xs text-gray-300 whitespace-pre font-mono">
                            {fileDiffs[file]}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        {messages.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg">
            <button
              onClick={() => toggleSection("timeline")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-orange-400" />
                <h3 className="font-semibold text-white">Timeline ({messages.length} events)</h3>
              </div>
              {expandedSections.timeline ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {expandedSections.timeline && (
              <div className="px-6 pb-6">
                <div className="space-y-3">
                  {messages.map((msg, idx) => (
                    <div key={msg.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            msg.authorType === "claude"
                              ? "bg-purple-600/20"
                              : msg.authorType === "system"
                              ? "bg-gray-600/20"
                              : "bg-blue-600/20"
                          }`}
                        >
                          {msg.authorType === "claude" ? (
                            <Bot className="w-4 h-4 text-purple-400" />
                          ) : msg.authorType === "system" ? (
                            <Activity className="w-4 h-4 text-gray-400" />
                          ) : (
                            <User className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        {idx < messages.length - 1 && (
                          <div className="w-0.5 flex-1 bg-gray-800 min-h-[20px]" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          {msg.title && (
                            <span className="text-sm font-medium text-white">{msg.title}</span>
                          )}
                          <span className="text-xs text-gray-500">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {msg.content && <p className="text-sm text-gray-400">{msg.content}</p>}
                        {msg.progress !== null && msg.progress !== undefined && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-blue-500 h-full transition-all"
                                style={{ width: `${msg.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400">{msg.progress}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Deploy Status */}
        {execution.deployStatus && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-blue-400" />
              Deployment Status
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Status:</span>
                <span
                  className={`text-sm font-medium ${
                    execution.deployStatus === "ready"
                      ? "text-green-400"
                      : execution.deployStatus === "building"
                      ? "text-yellow-400"
                      : execution.deployStatus === "error"
                      ? "text-red-400"
                      : "text-gray-400"
                  }`}
                >
                  {execution.deployStatus}
                </span>
              </div>
              {execution.deployUrl && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">URL:</span>
                  <Link
                    href={execution.deployUrl}
                    target="_blank"
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    View deployment <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Interactive Chat */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-semibold text-white">Ask Claude</h3>
                <p className="text-sm text-gray-400">
                  Send follow-up questions or request changes
                </p>
              </div>
            </div>
          </div>
          <div className="h-[600px]">
            <ClaudeChatInterface
              workspaceId={workspace.id}
              executionId={execution.id}
              initialMessages={messages.filter(
                (m) => m.type === "chat_message" || m.type === "chat_response" || m.type === "chat_error"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
