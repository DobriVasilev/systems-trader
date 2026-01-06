"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSessions, PatternSession } from "@/hooks/useSessions";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Delete confirmation modal
function DeleteModal({
  session,
  onConfirm,
  onCancel,
}: {
  session: PatternSession;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold mb-2">Delete Session</h3>
        <p className="text-gray-400 mb-4">
          Are you sure you want to delete <span className="text-white font-medium">{session.name}</span>?
          This will permanently remove all detections, corrections, and comments.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Share modal - Google Docs style
interface ShareUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  permission?: string;
}

function ShareModal({
  session,
  onClose,
}: {
  session: PatternSession;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "comment" | "edit">("view");
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState("");
  const [sharedUsers, setSharedUsers] = useState<ShareUser[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [isLoadingShares, setIsLoadingShares] = useState(true);
  const [copied, setCopied] = useState(false);

  // Fetch current shares
  useEffect(() => {
    const fetchShares = async () => {
      try {
        const response = await fetch(`/api/sessions/${session.id}/share`);
        const data = await response.json();
        if (data.success) {
          setSharedUsers(data.data.map((s: { user: ShareUser; permission: string }) => ({
            ...s.user,
            permission: s.permission,
          })));
        }
      } catch {
        // Ignore errors
      } finally {
        setIsLoadingShares(false);
      }
    };
    fetchShares();
  }, [session.id]);

  const handleShare = async () => {
    if (!email.trim()) return;

    setIsSharing(true);
    setError("");

    try {
      const response = await fetch(`/api/sessions/${session.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), permission }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to share");
      }

      // Add to list
      setSharedUsers(prev => [...prev, { ...data.data.user, permission }]);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share");
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      await fetch(`/api/sessions/${session.id}/share?userId=${userId}`, {
        method: "DELETE",
      });
      setSharedUsers(prev => prev.filter(u => u.id !== userId));
    } catch {
      // Ignore
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/sessions/${session.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && email.trim()) {
      handleShare();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 w-full max-w-lg mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4">
          <h2 className="text-lg font-medium text-white">
            Share "{session.name}"
          </h2>
        </div>

        {/* Add people input */}
        <div className="px-6 pb-4">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={handleKeyDown}
              placeholder="Add people by email"
              className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg
                       focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                       text-white placeholder-gray-500 text-sm"
            />
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as "view" | "comment" | "edit")}
              className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg
                       focus:outline-none focus:border-blue-500 text-white text-sm"
            >
              <option value="view">Viewer</option>
              <option value="comment">Commenter</option>
              <option value="edit">Editor</option>
            </select>
            <button
              onClick={handleShare}
              disabled={isSharing || !email.trim()}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isSharing ? "..." : "Add"}
            </button>
          </div>
          {error && (
            <p className="text-red-400 text-xs mt-2">{error}</p>
          )}
        </div>

        {/* People with access */}
        <div className="px-6 pb-4">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
            People with access
          </h3>
          <div className="space-y-1">
            {/* Owner */}
            <div className="flex items-center gap-3 py-2">
              {session.createdBy?.image ? (
                <img
                  src={session.createdBy.image}
                  alt={session.createdBy.name || ""}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                  {session.createdBy?.name?.charAt(0) || "U"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">
                  {session.createdBy?.name || "Unknown"} <span className="text-gray-500">(you)</span>
                </div>
                <div className="text-xs text-gray-500 truncate">{session.createdBy?.email}</div>
              </div>
              <span className="text-xs text-gray-500">Owner</span>
            </div>

            {/* Shared users */}
            {isLoadingShares ? (
              <div className="py-2 text-sm text-gray-500">Loading...</div>
            ) : (
              sharedUsers.map(user => (
                <div key={user.id} className="flex items-center gap-3 py-2 group">
                  {user.image ? (
                    <img src={user.image} alt={user.name || ""} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-medium">
                      {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{user.name || user.email}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  </div>
                  <span className="text-xs text-gray-500 capitalize">{user.permission}</span>
                  <button
                    onClick={() => handleRemoveUser(user.id)}
                    className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* General access */}
        <div className="px-6 pb-4 border-t border-gray-800 pt-4">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
            General access
          </h3>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPublic ? "bg-green-600/20" : "bg-gray-800"}`}>
              {isPublic ? (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <select
                value={isPublic ? "public" : "restricted"}
                onChange={(e) => setIsPublic(e.target.value === "public")}
                className="bg-transparent text-sm text-white border-none focus:outline-none focus:ring-0 cursor-pointer hover:bg-gray-800 rounded px-2 py-1 -ml-2"
              >
                <option value="restricted" className="bg-gray-900">Restricted</option>
                <option value="public" className="bg-gray-900">Anyone with the link</option>
              </select>
              <div className="text-xs text-gray-500 ml-0.5">
                {isPublic ? "Anyone with the link can view" : "Only people with access can open"}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 text-blue-400 hover:bg-gray-800 rounded-lg transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { sessions, isLoading, deleteSession } = useSessions();
  const [deleteTarget, setDeleteTarget] = useState<PatternSession | null>(null);
  const [shareTarget, setShareTarget] = useState<PatternSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const success = await deleteSession(deleteTarget.id);
    setIsDeleting(false);
    if (success) {
      setDeleteTarget(null);
    }
  };

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (status === "unauthenticated") {
    redirect("/auth/login");
  }

  const userSessions = sessions || [];
  const totalCorrections = userSessions.reduce(
    (acc, s) => acc + (s._count?.corrections || 0),
    0
  );
  const totalDetections = userSessions.reduce(
    (acc, s) => acc + (s._count?.detections || 0),
    0
  );

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              Systems Trader
            </Link>
            <span className="text-gray-500">/</span>
            <span className="text-gray-400">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/chat"
              className="px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat
            </Link>
            <Link
              href="/sessions/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium
                       hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Session
            </Link>
            <div className="relative group">
              <button className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-800 transition-colors">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || ""}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium">
                    {session?.user?.name?.charAt(0) || "U"}
                  </div>
                )}
              </button>
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 rounded-lg shadow-xl border border-gray-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="p-3 border-b border-gray-800">
                  <div className="font-medium text-sm">{session?.user?.name}</div>
                  <div className="text-xs text-gray-500 truncate">{session?.user?.email}</div>
                </div>
                <div className="p-1">
                  <Link
                    href="/account"
                    className="block px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
                  >
                    Account Settings
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-800 rounded-md transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">
            Welcome back, {session?.user?.name?.split(" ")[0] || "Trader"}
          </h1>
          <p className="text-gray-400">
            Track your pattern validation progress and contribute to improving detection algorithms.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Total Sessions</div>
            <div className="text-2xl font-bold">{userSessions.length}</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Detections Reviewed</div>
            <div className="text-2xl font-bold">{totalDetections}</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Corrections Made</div>
            <div className="text-2xl font-bold">{totalCorrections}</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Accuracy Impact</div>
            <div className="text-2xl font-bold text-green-400">
              {totalCorrections > 0 ? `+${(totalCorrections * 0.1).toFixed(1)}%` : "-"}
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold">Recent Sessions</h2>
            <Link
              href="/sessions"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading sessions...
              </div>
            ) : userSessions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-gray-400 mb-3">No sessions yet</div>
                <Link
                  href="/sessions/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Create your first session
                </Link>
              </div>
            ) : (
              userSessions.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors group"
                >
                  <Link
                    href={`/sessions/${s.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      s.status === "active" ? "bg-green-500" :
                      s.status === "completed" ? "bg-blue-500" : "bg-gray-500"
                    }`} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.name}</div>
                      <div className="text-sm text-gray-500">
                        {s.symbol}/{s.timeframe.toUpperCase()} - {s._count?.detections || 0} detections
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 hidden sm:block">
                      {formatDate(s.updatedAt)}
                    </span>
                    {/* Share button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShareTarget(s);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded
                               opacity-0 group-hover:opacity-100 transition-all"
                      title="Share session"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(s);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded
                               opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete session"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Link
            href="/sessions/new"
            className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-blue-600 transition-colors group"
          >
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-600/30 transition-colors">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="font-medium mb-1">New Session</div>
            <div className="text-sm text-gray-500">Start validating patterns on a new chart</div>
          </Link>

          <Link
            href="/sessions"
            className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-purple-600 transition-colors group"
          >
            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-purple-600/30 transition-colors">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <div className="font-medium mb-1">Browse Sessions</div>
            <div className="text-sm text-gray-500">View and continue existing sessions</div>
          </Link>

          <Link
            href="/account"
            className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-green-600 transition-colors group"
          >
            <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-green-600/30 transition-colors">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="font-medium mb-1">Account Settings</div>
            <div className="text-sm text-gray-500">Manage your profile and preferences</div>
          </Link>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          session={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Share modal */}
      {shareTarget && (
        <ShareModal
          session={shareTarget}
          onClose={() => setShareTarget(null)}
        />
      )}
    </main>
  );
}
