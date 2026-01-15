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
  Search
} from "lucide-react";

interface Feedback {
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

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-600",
  ANALYZING: "bg-blue-600",
  PROCESSING: "bg-purple-600",
  IMPLEMENTING: "bg-indigo-600",
  COMPLETED: "bg-green-600",
  FAILED: "bg-red-600",
};

const TYPE_LABELS: Record<string, string> = {
  BUG_REPORT: "Bug",
  FEATURE_REQUEST: "Feature",
  UI_UX_ISSUE: "UI/UX",
  PERFORMANCE_ISSUE: "Performance",
  QUESTION: "Question",
  OTHER: "Other",
};

export function FeedbackManagement() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchFeedback();
  }, []);

  async function fetchFeedback() {
    try {
      const res = await fetch("/api/feedback");
      const data = await res.json();
      if (data.success) {
        setFeedback(data.data.feedback);
      } else {
        setError(data.error || "Failed to load feedback");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const filteredFeedback = feedback.filter((fb) => {
    if (statusFilter !== "all" && fb.implementationStatus !== statusFilter) return false;
    if (typeFilter !== "all" && fb.type !== typeFilter) return false;
    if (searchQuery && !fb.title?.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !fb.textContent?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !fb.user.email.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

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

  const statusCounts = {
    all: feedback.length,
    PENDING: feedback.filter(f => f.implementationStatus === "PENDING").length,
    PROCESSING: feedback.filter(f => ["ANALYZING", "PROCESSING", "IMPLEMENTING"].includes(f.implementationStatus)).length,
    COMPLETED: feedback.filter(f => f.implementationStatus === "COMPLETED").length,
    FAILED: feedback.filter(f => f.implementationStatus === "FAILED").length,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total</div>
            <div className="text-2xl font-bold text-white">{statusCounts.all}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Pending</div>
            <div className="text-2xl font-bold text-gray-300">{statusCounts.PENDING}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-sm text-purple-400 mb-1">Processing</div>
            <div className="text-2xl font-bold text-purple-400">{statusCounts.PROCESSING}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-sm text-green-400 mb-1">Completed</div>
            <div className="text-2xl font-bold text-green-400">{statusCounts.COMPLETED}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-sm text-red-400 mb-1">Failed</div>
            <div className="text-2xl font-bold text-red-400">{statusCounts.FAILED}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search feedback..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="ANALYZING">Analyzing</option>
              <option value="PROCESSING">Processing</option>
              <option value="IMPLEMENTING">Implementing</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="BUG_REPORT">Bug Report</option>
              <option value="FEATURE_REQUEST">Feature Request</option>
              <option value="UI_UX_ISSUE">UI/UX Issue</option>
              <option value="PERFORMANCE_ISSUE">Performance Issue</option>
              <option value="QUESTION">Question</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        {/* Feedback List */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Feedback
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredFeedback.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No feedback found
                    </td>
                  </tr>
                ) : (
                  filteredFeedback.map((fb) => (
                    <tr key={fb.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <Link href={`/feedback/${fb.id}`} className="block hover:text-blue-400">
                          <div className="font-medium text-white">
                            {fb.title || "Untitled"}
                          </div>
                          <div className="text-sm text-gray-400 line-clamp-1 mt-1">
                            {fb.textContent}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded bg-gray-700 text-gray-300">
                          {TYPE_LABELS[fb.type] || fb.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">{fb.user.name || "No name"}</div>
                        <div className="text-xs text-gray-500">{fb.user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[fb.implementationStatus]} text-white`}>
                          {fb.implementationStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {new Date(fb.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-400 text-center">
          Showing {filteredFeedback.length} of {feedback.length} feedback items
        </div>
      </div>
    </div>
  );
}
