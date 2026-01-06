"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { VoteButtons } from "./VoteButtons";
import {
  ThreadedComment,
  ThreadedCommentData,
  useThreadedCommentStyles,
} from "./ThreadedComment";
import { RichTextEditor } from "./RichTextEditor";
import { useUserHoverCard } from "./UserHoverCard";
import { SortType } from "@/lib/sorting";

interface FeedUser {
  id: string;
  name: string | null;
  image: string | null;
  username: string | null;
}

interface FeedItem {
  type: "correction" | "comment";
  id: string;
  content: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  score: number;
  userVote: number | null;
  user: FeedUser;
  // Correction-specific
  correctionType?: string;
  detectionId?: string | null;
  originalIndex?: number | null;
  originalTime?: string | null;
  originalPrice?: number | null;
  originalType?: string | null;
  correctedIndex?: number | null;
  correctedTime?: string | null;
  correctedPrice?: number | null;
  correctedType?: string | null;
  correctedStructure?: string | null;
  // Comment-specific
  depth?: number;
  path?: string | null;
  parentId?: string | null;
  // Replies
  replyCount?: number;
  replies?: ThreadedCommentData[];
}

interface UnifiedFeedProps {
  sessionId: string;
  currentUserId?: string;
  onNavigateToDetection?: (detectionId: string) => void;
  onNavigateToCandle?: (candleTime: string) => void;
  highlightedCommentId?: string | null;
  highlightedCorrectionId?: string | null;
}

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: "best", label: "Best" },
  { value: "top", label: "Top" },
  { value: "new", label: "New" },
  { value: "controversial", label: "Controversial" },
];

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

function getCorrectionTypeLabel(type: string): { label: string; color: string } {
  switch (type) {
    case "add":
      return { label: "Added", color: "text-green-400" };
    case "delete":
      return { label: "Removed", color: "text-red-400" };
    case "move":
      return { label: "Moved", color: "text-yellow-400" };
    case "confirm":
      return { label: "Confirmed", color: "text-blue-400" };
    case "unconfirm":
      return { label: "Unconfirmed", color: "text-orange-400" };
    case "modify":
      return { label: "Modified", color: "text-purple-400" };
    default:
      return { label: type, color: "text-gray-400" };
  }
}

export function UnifiedFeed({
  sessionId,
  currentUserId,
  onNavigateToDetection,
  onNavigateToCandle,
  highlightedCommentId,
  highlightedCorrectionId,
}: UnifiedFeedProps) {
  useThreadedCommentStyles();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortType>("new");
  const [newCommentContent, setNewCommentContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewCommentForm, setShowNewCommentForm] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { activeUserId, position, showCard, hideCard, keepCardOpen } =
    useUserHoverCard();

  // Fetch feed
  const fetchFeed = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/feed?sort=${sort}&includeReplies=true`
      );
      const data = await response.json();

      if (data.success) {
        setItems(data.data.items);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to load feed");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, sort]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Scroll to highlighted item
  useEffect(() => {
    const id = highlightedCommentId || highlightedCorrectionId;
    if (id && !isLoading) {
      const element = document.getElementById(
        `${highlightedCommentId ? "comment" : "correction"}-${id}`
      );
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightedCommentId, highlightedCorrectionId, isLoading]);

  // Submit new top-level comment
  const handleSubmitComment = async () => {
    if (!newCommentContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newCommentContent }),
      });

      const data = await response.json();
      if (data.success) {
        setNewCommentContent("");
        setShowNewCommentForm(false);
        fetchFeed(); // Refresh feed
      } else {
        alert(data.error || "Failed to post comment");
      }
    } catch (error) {
      alert("Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reply to a correction
  const handleReplyToCorrection = async (
    correctionId: string,
    content: string
  ) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, correctionId }),
      });

      const data = await response.json();
      if (data.success) {
        fetchFeed();
      } else {
        alert(data.error || "Failed to post reply");
      }
    } catch (error) {
      alert("Failed to post reply");
    }
  };

  // Reply to a comment
  const handleReplyToComment = async (parentId: string, content: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parentId }),
      });

      const data = await response.json();
      if (data.success) {
        fetchFeed();
      } else {
        alert(data.error || "Failed to post reply");
      }
    } catch (error) {
      alert("Failed to post reply");
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/comments/${commentId}`,
        { method: "DELETE" }
      );

      const data = await response.json();
      if (data.success) {
        fetchFeed();
      } else {
        alert(data.error || "Failed to delete comment");
      }
    } catch (error) {
      alert("Failed to delete comment");
    }
  };

  // Toggle item expansion
  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Copy permalink
  const handleShare = (type: "comment" | "correction", id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(type, id);
    navigator.clipboard.writeText(url.toString());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-red-400">
        {error}
        <button
          onClick={fetchFeed}
          className="ml-2 text-blue-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with sort and new comment */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Sort by:</span>
          <div className="flex gap-1">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSort(option.value)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  sort === option.value
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {currentUserId && (
          <button
            onClick={() => setShowNewCommentForm(!showNewCommentForm)}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors"
          >
            {showNewCommentForm ? "Cancel" : "New Comment"}
          </button>
        )}
      </div>

      {/* New comment form */}
      {showNewCommentForm && currentUserId && (
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <RichTextEditor
            value={newCommentContent}
            onChange={setNewCommentContent}
            onSubmit={handleSubmitComment}
            placeholder="Write a general comment..."
            sessionId={sessionId}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => {
                setShowNewCommentForm(false);
                setNewCommentContent("");
              }}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitComment}
              disabled={!newCommentContent.trim() || isSubmitting}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </div>
      )}

      {/* Feed items */}
      {items.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          No activity yet. Be the first to comment!
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <FeedItemCard
              key={item.id}
              item={item}
              sessionId={sessionId}
              currentUserId={currentUserId}
              isExpanded={expandedItems.has(item.id)}
              onToggleExpand={() => toggleExpanded(item.id)}
              onReply={
                item.type === "correction"
                  ? (content) => handleReplyToCorrection(item.id, content)
                  : (content) => handleReplyToComment(item.id, content)
              }
              onReplyToComment={handleReplyToComment}
              onDeleteComment={handleDeleteComment}
              onShare={(id) => handleShare(item.type, id)}
              onNavigateToDetection={onNavigateToDetection}
              onUserHover={showCard}
              isHighlighted={
                (item.type === "correction" && item.id === highlightedCorrectionId) ||
                (item.type === "comment" && item.id === highlightedCommentId)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Individual feed item card
interface FeedItemCardProps {
  item: FeedItem;
  sessionId: string;
  currentUserId?: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onReply: (content: string) => Promise<void>;
  onReplyToComment: (parentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onShare: (id: string) => void;
  onNavigateToDetection?: (detectionId: string) => void;
  onUserHover: (userId: string, element: HTMLElement) => void;
  isHighlighted?: boolean;
}

function FeedItemCard({
  item,
  sessionId,
  currentUserId,
  isExpanded,
  onToggleExpand,
  onReply,
  onReplyToComment,
  onDeleteComment,
  onShare,
  onNavigateToDetection,
  onUserHover,
  isHighlighted,
}: FeedItemCardProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const handleReply = async () => {
    if (!replyContent.trim() || isReplying) return;
    setIsReplying(true);
    try {
      await onReply(replyContent);
      setReplyContent("");
      setShowReplyForm(false);
    } finally {
      setIsReplying(false);
    }
  };

  const isCorrection = item.type === "correction";
  const typeInfo = isCorrection
    ? getCorrectionTypeLabel(item.correctionType || "")
    : null;

  return (
    <div
      id={`${item.type}-${item.id}`}
      className={`bg-gray-800/30 rounded-lg border border-gray-700/50 overflow-hidden ${
        isHighlighted ? "ring-2 ring-yellow-500/50 animate-pulse-highlight" : ""
      }`}
    >
      {/* Main content */}
      <div className="p-4">
        <div className="flex gap-3">
          {/* Vote buttons */}
          <VoteButtons
            itemType={isCorrection ? "correction" : "comment"}
            itemId={item.id}
            sessionId={sessionId}
            upvotes={item.upvotes}
            downvotes={item.downvotes}
            score={item.score}
            userVote={item.userVote}
            vertical
            size="sm"
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap text-sm">
              {/* Type badge for corrections */}
              {isCorrection && typeInfo && (
                <span
                  className={`px-1.5 py-0.5 text-xs font-medium rounded ${typeInfo.color} bg-gray-700/50`}
                >
                  {typeInfo.label}
                </span>
              )}

              {/* User */}
              <div
                className="flex items-center gap-1.5 cursor-pointer"
                onMouseEnter={(e) => onUserHover(item.user.id, e.currentTarget)}
              >
                {item.user.image ? (
                  <img
                    src={item.user.image}
                    alt=""
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-700" />
                )}
                <span className="font-medium text-gray-200 hover:underline">
                  {item.user.name || "Anonymous"}
                </span>
              </div>

              {/* Score */}
              <span className="text-gray-500">
                {item.score} point{item.score !== 1 ? "s" : ""}
              </span>

              {/* Time */}
              <span className="text-gray-500">
                {formatRelativeTime(item.createdAt)}
              </span>

              {/* Detection link for corrections */}
              {isCorrection && item.detectionId && onNavigateToDetection && (
                <button
                  onClick={() => onNavigateToDetection(item.detectionId!)}
                  className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded hover:bg-blue-800/50 transition-colors"
                >
                  View on chart
                </button>
              )}
            </div>

            {/* Content body */}
            <p className="mt-2 text-gray-300 whitespace-pre-wrap break-words">
              {item.content}
            </p>

            {/* Correction details */}
            {isCorrection && (item.originalPrice || item.correctedPrice) && (
              <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                {item.originalPrice && (
                  <div>
                    Original: {item.originalType} @ ${item.originalPrice.toFixed(2)}
                  </div>
                )}
                {item.correctedPrice && (
                  <div>
                    Corrected: {item.correctedType} @ ${item.correctedPrice.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4 mt-3 text-xs">
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-gray-500 hover:text-gray-300 font-medium transition-colors"
              >
                Reply
              </button>

              <button
                onClick={() => onShare(item.id)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                Share
              </button>

              {item.replyCount && item.replyCount > 0 && (
                <button
                  onClick={onToggleExpand}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {isExpanded
                    ? "Hide replies"
                    : `${item.replyCount} repl${item.replyCount === 1 ? "y" : "ies"}`}
                </button>
              )}
            </div>

            {/* Reply form */}
            {showReplyForm && currentUserId && (
              <div className="mt-3 pl-4 border-l-2 border-gray-700">
                <RichTextEditor
                  value={replyContent}
                  onChange={setReplyContent}
                  onSubmit={handleReply}
                  placeholder="Write a reply..."
                  sessionId={sessionId}
                  minRows={2}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleReply}
                    disabled={!replyContent.trim() || isReplying}
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
                  >
                    {isReplying ? "Posting..." : "Reply"}
                  </button>
                  <button
                    onClick={() => {
                      setShowReplyForm(false);
                      setReplyContent("");
                    }}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {isExpanded && item.replies && item.replies.length > 0 && (
        <div className="border-t border-gray-700/50 bg-gray-900/30 px-4 py-3">
          {item.replies.map((reply) => (
            <ThreadedComment
              key={reply.id}
              comment={reply as ThreadedCommentData}
              sessionId={sessionId}
              currentUserId={currentUserId}
              onReply={onReplyToComment}
              onDelete={onDeleteComment}
              onShare={() => onShare(reply.id)}
              onUserHover={onUserHover}
              highlighted={reply.id === undefined} // TODO: Check for highlighted comment
            />
          ))}
        </div>
      )}
    </div>
  );
}
