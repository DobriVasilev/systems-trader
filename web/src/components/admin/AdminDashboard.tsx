"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Settings,
  Database,
  Bot,
  BarChart3,
} from "lucide-react";

interface SystemHealth {
  watcher: {
    status: string;
    lastHeartbeat: string | null;
    timeSinceHeartbeat: number | null;
  };
  feedback: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    successRate: number;
  };
  activity: {
    last24h: number;
    last7d: number;
    avgProcessingTimeMinutes: number;
  };
  users: {
    devTeam: number;
  };
  recentFailures: Array<{
    id: string;
    title: string;
    error: string;
    retryCount: number;
    failedAt: string;
  }>;
}

export function AdminDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch("/api/admin/system-health");
        const data = await res.json();
        if (data.success) {
          setHealth(data.data);
        } else {
          setError(data.error || "Failed to load system health");
        }
      } catch (err) {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          {error || "Failed to load system health"}
        </div>
      </div>
    );
  }

  const watcherStatusColor = 
    health.watcher.status === "healthy" ? "text-green-500" :
    health.watcher.status === "warning" ? "text-yellow-500" :
    "text-red-500";

  const watcherStatusBg = 
    health.watcher.status === "healthy" ? "bg-green-500/10 border-green-500/20" :
    health.watcher.status === "warning" ? "bg-yellow-500/10 border-yellow-500/20" :
    "bg-red-500/10 border-red-500/20";

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/users"
            className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-blue-600 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600/20 rounded-lg group-hover:bg-blue-600/30 transition-colors">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">User Management</h3>
                <p className="text-sm text-gray-400">Manage roles & permissions</p>
              </div>
            </div>
          </Link>

          <Link
            href="/trading/settings"
            className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-purple-600 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-600/20 rounded-lg group-hover:bg-purple-600/30 transition-colors">
                <Settings className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">System Settings</h3>
                <p className="text-sm text-gray-400">Configure trading settings</p>
              </div>
            </div>
          </Link>

          <Link
            href="/admin/feedback"
            className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-green-600 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-600/20 rounded-lg group-hover:bg-green-600/30 transition-colors">
                <Database className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Feedback Management</h3>
                <p className="text-sm text-gray-400">View and manage all feedback submissions</p>
              </div>
            </div>
          </Link>

          <Link
            href="/sessions"
            className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-orange-600 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-600/20 rounded-lg group-hover:bg-orange-600/30 transition-colors">
                <BarChart3 className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Sessions Management</h3>
                <p className="text-sm text-gray-400">View and monitor all trading sessions</p>
              </div>
            </div>
          </Link>

          <Link
            href="/bots"
            className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-cyan-600 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-cyan-600/20 rounded-lg group-hover:bg-cyan-600/30 transition-colors">
                <Bot className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Bots Management</h3>
                <p className="text-sm text-gray-400">Control and configure trading bots</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Watcher Status */}
        <div className={`border rounded-lg p-6 ${watcherStatusBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className={`w-6 h-6 ${watcherStatusColor}`} />
              <div>
                <h3 className="font-semibold text-white">Autonomous Watcher Status</h3>
                <p className="text-sm text-gray-400">
                  {health.watcher.status === "healthy" ? "Running normally" :
                   health.watcher.status === "warning" ? "Delayed heartbeat" :
                   health.watcher.status === "not_running" ? "Not running" :
                   "Error or frozen"}
                </p>
              </div>
            </div>
            <div className="text-right">
              {health.watcher.lastHeartbeat && (
                <div className="text-sm text-gray-400">
                  Last heartbeat: {health.watcher.timeSinceHeartbeat}s ago
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <div className="text-3xl font-bold text-white">{health.feedback.pending}</div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <Activity className="w-5 h-5" />
              <span className="text-sm font-medium">Processing</span>
            </div>
            <div className="text-3xl font-bold text-white">{health.feedback.processing}</div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Completed</span>
            </div>
            <div className="text-3xl font-bold text-white">{health.feedback.completed}</div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Failed</span>
            </div>
            <div className="text-3xl font-bold text-white">{health.feedback.failed}</div>
          </div>
        </div>

        {/* Activity & Performance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium">Last 24 Hours</span>
            </div>
            <div className="text-2xl font-bold text-white">{health.activity.last24h}</div>
            <div className="text-xs text-gray-500 mt-1">Feedback submissions</div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium">Last 7 Days</span>
            </div>
            <div className="text-2xl font-bold text-white">{health.activity.last7d}</div>
            <div className="text-xs text-gray-500 mt-1">Feedback submissions</div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-sm font-medium">Avg Processing Time</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {health.activity.avgProcessingTimeMinutes}m
            </div>
            <div className="text-xs text-gray-500 mt-1">Last 7 days</div>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-4">Success Rate</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
              <div
                className="bg-green-500 h-full transition-all duration-500"
                style={{ width: `${health.feedback.successRate}%` }}
              />
            </div>
            <span className="text-2xl font-bold text-white">{health.feedback.successRate}%</span>
          </div>
          <div className="text-sm text-gray-400 mt-2">
            {health.feedback.completed} completed, {health.feedback.failed} failed
          </div>
        </div>

        {/* Recent Failures */}
        {health.recentFailures.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              Recent Failures (Last 24h)
            </h3>
            <div className="space-y-3">
              {health.recentFailures.map((failure) => (
                <div key={failure.id} className="bg-red-900/10 border border-red-800/30 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-white text-sm">{failure.title}</h4>
                    <span className="text-xs text-gray-500">
                      {new Date(failure.failedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-red-400 mb-2">{failure.error}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Retry count: {failure.retryCount}</span>
                    <Link
                      href={`/feedback/${failure.id}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      View details →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-4">Team Statistics</h3>
          <div className="flex items-center gap-4">
            <Users className="w-8 h-8 text-blue-400" />
            <div>
              <div className="text-2xl font-bold text-white">{health.users.devTeam}</div>
              <div className="text-sm text-gray-400">Dev Team Members</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
