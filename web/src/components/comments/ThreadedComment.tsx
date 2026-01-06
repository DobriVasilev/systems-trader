"use client";

import { useState, useMemo, useEffect } from "react";
import { VoteButtons } from "./VoteButtons";
import { CommentInput } from "./CommentInput";

// Depth colors cycle (Reddit-style)
const DEPTH_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#14b8a6", // teal
  "#f97316", // orange
  "#ec4899", // pink
  "#22c55e", // green
  "#eab308", // yellow
  "#ef4444", // red
];

export interface ThreadedCommentData {
  id: string;
  content: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  score: number;
  userVote: number | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    username: string | null;
  };
  depth: number;
  parentId: string | null;
  replyCount?: number;
  replies?: ThreadedCommentData[];
  // For correction replies
  correctionId?: string;
}

interface ThreadedCommentProps {
  comment: ThreadedCommentData;
  sessionId: string;
  currentUserId?: string;
  onReply: (content: string, parentId: string) => Promise<void>;
  onEdit?: (commentId: string, content: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onShare?: (commentId: string) => void;
  onUserHover?: (userId: string, element: HTMLElement) => void;
  maxDepth?: number;
  highlighted?: boolean;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function ThreadedComment({
  comment,
  sessionId,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onShare,
  onUserHover,
  maxDepth = 10,
  highlighted = false,
}: ThreadedCommentProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleting, setIsDeleting] = useState(false);

  const depthColor = DEPTH_COLORS[comment.depth % DEPTH_COLORS.length];
  const isOwner = currentUserId === comment.user.id;
  const hasReplies = comment.replies && comment.replies.length > 0;
  const totalChildren = useMemo(() => countChildren(comment), [comment]);

  const handleReply = async (content: string) => {
    await onReply(content, comment.id);
    setShowReplyInput(false);
  };

  const handleEdit = async () => {
    if (!onEdit) return;
    await onEdit(comment.id, editContent);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!onDelete || !confirm("Delete this comment?")) return;
    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyPermalink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("comment", comment.id);
    navigator.clipboard.writeText(url.toString());
    onShare?.(comment.id);
  };

  return (
    <div
      id={`comment-${comment.id}`}
      className={`relative ${highlighted ? "animate-pulse-highlight" : ""}`}
    >
      {/* Depth indicator line */}
      {comment.depth > 0 && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute left-0 top-0 bottom-0 w-4 group cursor-pointer"
          style={{ left: `${(comment.depth - 1) * 16}px` }}
          title={isCollapsed ? "Expand thread" : "Collapse thread"}
        >
          <div
            className="w-0.5 h-full mx-auto transition-all group-hover:w-1"
            style={{ backgroundColor: depthColor }}
          />
        </button>
      )}

      {/* Comment content */}
      <div
        className="pl-4"
        style={{ marginLeft: `${comment.depth * 16}px` }}
      >
        {isCollapsed ? (
          // Collapsed view
          <button
            onClick={() => setIsCollapsed(false)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 py-1"
          >
            <span className="text-gray-600">[+]</span>
            <span className="font-medium" style={{ color: depthColor }}>
              {comment.user.name || "Anonymous"}
            </span>
            <span>({totalChildren} children)</span>
          </button>
        ) : (
          // Expanded view
          <div className="py-2">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsCollapsed(true)}
                className="text-gray-600 hover:text-gray-400 text-sm"
                title="Collapse thread"
              >
                [-]
              </button>

              {/* User avatar */}
              {comment.user.image ? (
                <img
                  src={comment.user.image}
                  alt=""
                  className="w-5 h-5 rounded-full"
                  onMouseEnter={(e) =>
                    onUserHover?.(comment.user.id, e.currentTarget)
                  }
                />
              ) : (
                <div
                  className="w-5 h-5 rounded-full bg-gray-700"
                  onMouseEnter={(e) =>
                    onUserHover?.(comment.user.id, e.currentTarget as HTMLElement)
                  }
                />
              )}

              {/* Username */}
              <span
                className="text-sm font-medium hover:underline cursor-pointer"
                style={{ color: depthColor }}
                onMouseEnter={(e) =>
                  onUserHover?.(comment.user.id, e.currentTarget)
                }
              >
                {comment.user.username
                  ? `@${comment.user.username}`
                  : comment.user.name || "Anonymous"}
              </span>

              {/* Score */}
              <span className="text-xs text-gray-500">
                {comment.score} point{comment.score !== 1 ? "s" : ""}
              </span>

              {/* Time */}
              <span className="text-xs text-gray-500">
                {formatRelativeTime(comment.createdAt)}
              </span>
            </div>

            {/* Content */}
            {isEditing ? (
              <div className="mt-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleEdit}
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(comment.content);
                    }}
                    className="text-xs px-2 py-1 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            )}

            {/* Actions row */}
            <div className="flex items-center gap-1 mt-2">
              {/* Voting */}
              <VoteButtons
                itemType="comment"
                itemId={comment.id}
                sessionId={sessionId}
                upvotes={comment.upvotes}
                downvotes={comment.downvotes}
                score={comment.score}
                userVote={comment.userVote}
                vertical={false}
                size="sm"
              />

              <div className="flex items-center gap-3 ml-2 text-xs">
                <button
                  onClick={() => setShowReplyInput(!showReplyInput)}
                  className="text-gray-500 hover:text-gray-300 transition-colors font-medium"
                >
                  Reply
                </button>

                <button
                  onClick={handleCopyPermalink}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Share
                </button>

                {isOwner && onEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Edit
                  </button>
                )}

                {isOwner && onDelete && (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    {isDeleting ? "..." : "Delete"}
                  </button>
                )}
              </div>
            </div>

            {/* Reply input */}
            {showReplyInput && (
              <div className="mt-3 ml-4">
                <CommentInput
                  onSubmit={handleReply}
                  placeholder="Write a reply..."
                  autoFocus
                  showCancel
                  onCancel={() => setShowReplyInput(false)}
                />
              </div>
            )}

            {/* Nested replies */}
            {hasReplies && comment.depth < maxDepth && (
              <div className="mt-1">
                {comment.replies!.map((reply) => (
                  <ThreadedComment
                    key={reply.id}
                    comment={reply}
                    sessionId={sessionId}
                    currentUserId={currentUserId}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onShare={onShare}
                    onUserHover={onUserHover}
                    maxDepth={maxDepth}
                  />
                ))}
              </div>
            )}

            {/* "Continue thread" link at max depth */}
            {hasReplies && comment.depth >= maxDepth && (
              <button
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("comment", comment.id);
                  url.searchParams.set("context", "0");
                  window.location.href = url.toString();
                }}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Continue this thread →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to count total nested children
function countChildren(comment: ThreadedCommentData): number {
  if (!comment.replies || comment.replies.length === 0) {
    return 0;
  }
  return comment.replies.reduce(
    (sum, reply) => sum + 1 + countChildren(reply),
    0
  );
}

// Hook to inject highlight styles once
export function useThreadedCommentStyles() {
  useEffect(() => {
    if (document.querySelector("#threaded-comment-styles")) return;

    const style = document.createElement("style");
    style.id = "threaded-comment-styles";
    style.textContent = `
      @keyframes pulse-highlight {
        0%, 100% { background-color: transparent; }
        50% { background-color: rgba(251, 191, 36, 0.2); }
      }
      .animate-pulse-highlight {
        animation: pulse-highlight 2s ease-in-out 3;
      }
    `;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);
}
