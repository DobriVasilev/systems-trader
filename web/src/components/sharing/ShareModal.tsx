"use client";

import { useState, useEffect, useCallback } from "react";

interface ShareUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Share {
  id: string;
  userId: string;
  permission: string;
  user: ShareUser;
  createdAt: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  isOwner: boolean;
  isPublic: boolean;
}

const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  view: { label: "View", description: "Can view the session and detections" },
  comment: { label: "Comment", description: "Can view and add comments" },
  edit: { label: "Edit", description: "Can make corrections and changes" },
  admin: { label: "Admin", description: "Full access, can share with others" },
};

export function ShareModal({
  isOpen,
  onClose,
  sessionId,
  isOwner,
  isPublic: initialIsPublic,
}: ShareModalProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("view");
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchShares = useCallback(async () => {
    if (!isOwner) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}/share`);
      const data = await response.json();

      if (data.success) {
        setShares(data.data);
      }
    } catch (err) {
      console.error("Error fetching shares:", err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, isOwner]);

  useEffect(() => {
    if (isOpen) {
      fetchShares();
    }
  }, [isOpen, fetchShares]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSharing(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), permission }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      setEmail("");
      fetchShares();
    } catch (err) {
      setError("Failed to share session");
      console.error(err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemoveShare = async (userId: string) => {
    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/share?userId=${userId}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (data.success) {
        setShares((prev) => prev.filter((s) => s.userId !== userId));
      }
    } catch (err) {
      console.error("Error removing share:", err);
    }
  };

  const handleTogglePublic = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !isPublic }),
      });

      const data = await response.json();

      if (data.success) {
        setIsPublic(data.data.isPublic);
      }
    } catch (err) {
      console.error("Error toggling public status:", err);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/sessions/${sessionId}`;
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Share Session</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Copy Link */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/sessions/${sessionId}`}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
            />
            <button
              onClick={copyLink}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              {copySuccess ? "Copied!" : "Copy"}
            </button>
          </div>

          {/* Public Toggle */}
          {isOwner && (
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div>
                <div className="text-sm font-medium">Public Access</div>
                <div className="text-xs text-gray-500">
                  Anyone with the link can view
                </div>
              </div>
              <button
                onClick={handleTogglePublic}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isPublic ? "bg-green-600" : "bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    isPublic ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Share Form */}
          {isOwner && (
            <form onSubmit={handleShare} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                >
                  {Object.entries(PERMISSION_LABELS).map(([value, { label }]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={isSharing || !email.trim()}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                         hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSharing ? "Sharing..." : "Share"}
              </button>
            </form>
          )}

          {/* Current Shares */}
          {isOwner && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Shared with ({shares.length})
              </h3>
              {isLoading ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  Loading...
                </div>
              ) : shares.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  Not shared with anyone yet
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {shares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        {share.user.image ? (
                          <img
                            src={share.user.image}
                            alt={share.user.name || ""}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm">
                            {(share.user.name || share.user.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium">
                            {share.user.name || share.user.email}
                          </div>
                          <div className="text-xs text-gray-500">
                            {PERMISSION_LABELS[share.permission]?.label || share.permission}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveShare(share.userId)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
