"use client";

import { useState, useEffect, useCallback } from "react";
import { VoteButtons } from "./VoteButtons";
import { ThreadedComment, ThreadedCommentData, useThreadedCommentStyles } from "./ThreadedComment";
import { RichTextEditor } from "./RichTextEditor";
import { SortType } from "@/lib/sorting";

interface CorrectionData {
  id: string;
  correctionType: string;
  reason: string;
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
  detectionId: string | null;
  originalIndex: number | null;
  originalTime: string | null;
  originalPrice: number | null;
  originalType: string | null;
  correctedIndex: number | null;
  correctedTime: string | null;
  correctedPrice: number | null;
  correctedType: string | null;
  correctedStructure: string | null;
}

interface ThreadViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  correction: CorrectionData | null;
  currentUserId?: string;
  onNavigateToDetection?: (detectionId: string) => void;
}

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: "best", label: "Best" },
  { value: "top", label: "Top" },
  { value: "new", label: "New" },
  { value: "controversial", label: "Controversial" },
];

function getCorrectionTypeLabel(type: string): { label: string; color: string; bg: string } {
  switch (type) {
    case "add":
      return { label: "Added Detection", color: "text-green-400", bg: "bg-green-900/50" };
    case "delete":
      return { label: "Removed Detection", color: "text-red-400", bg: "bg-red-900/50" };
    case "move":
      return { label: "Moved Detection", color: "text-yellow-400", bg: "bg-yellow-900/50" };
    case "confirm":
      return { label: "Confirmed Detection", color: "text-blue-400", bg: "bg-blue-900/50" };
    case "unconfirm":
      return { label: "Unconfirmed Detection", color: "text-orange-400", bg: "bg-orange-900/50" };
    case "modify":
      return { label: "Modified Detection", color: "text-purple-400", bg: "bg-purple-900/50" };
    default:
      return { label: type, color: "text-gray-400", bg: "bg-gray-900/50" };
  }
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

export function ThreadViewModal({
  isOpen,
  onClose,
  sessionId,
  correction,
  currentUserId,
  onNavigateToDetection,
}: ThreadViewModalProps) {
  useThreadedCommentStyles();

  const [replies, setReplies] = useState<ThreadedCommentData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sort, setSort] = useState<SortType>("best");
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch replies for this correction
  const fetchReplies = useCallback(async () => {
    if (!correction) return;

    setIsLoading(true);
    try {
      // Fetch comments that are replies to this correction
      const response = await fetch(
        `/api/sessions/${sessionId}/comments?correctionId=${correction.id}&sort=${sort}`
      );
      const data = await response.json();

      if (data.success) {
        // Transform to ThreadedCommentData format
        const transformedReplies: ThreadedCommentData[] = data.data.map((comment: Record<string, unknown>) => ({
          id: comment.id as string,
          content: comment.content as string,
          createdAt: comment.createdAt as string,
          upvotes: (comment.upvotes as number) || 0,
          downvotes: (comment.downvotes as number) || 0,
          score: (comment.score as number) || 0,
          userVote: null, // TODO: Fetch user votes
          user: comment.user as ThreadedCommentData["user"],
          depth: (comment.depth as number) || 0,
          parentId: (comment.parentId as string) || null,
          correctionId: correction.id,
          replyCount: ((comment._count as { replies?: number })?.replies) || 0,
          replies: comment.replies ? transformReplies(comment.replies as Record<string, unknown>[]) : [],
        }));

        setReplies(transformedReplies);
      }
    } catch (error) {
      console.error("Error fetching replies:", error);
    } finally {
      setIsLoading(false);
    }
  }, [correction, sessionId, sort]);

  useEffect(() => {
    if (isOpen && correction) {
      fetchReplies();
    }
  }, [isOpen, correction, fetchReplies]);

  // Transform nested replies recursively
  function transformReplies(comments: Record<string, unknown>[]): ThreadedCommentData[] {
    return comments.map((comment) => ({
      id: comment.id as string,
      content: comment.content as string,
      createdAt: comment.createdAt as string,
      upvotes: (comment.upvotes as number) || 0,
      downvotes: (comment.downvotes as number) || 0,
      score: (comment.score as number) || 0,
      userVote: null,
      user: comment.user as ThreadedCommentData["user"],
      depth: (comment.depth as number) || 0,
      parentId: (comment.parentId as string) || null,
      replyCount: ((comment._count as { replies?: number })?.replies) || 0,
      replies: comment.replies ? transformReplies(comment.replies as Record<string, unknown>[]) : [],
    }));
  }

  // Submit a reply to the correction (top-level comment on this correction)
  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !correction || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: replyContent,
          correctionId: correction.id,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setReplyContent("");
        fetchReplies();
      }
    } catch (error) {
      console.error("Error posting reply:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reply to a comment (nested reply)
  const handleReplyToComment = async (parentId: string, content: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          parentId,
          correctionId: correction?.id,
        }),
      });

      const data = await response.json();
      if (data.success) {
        fetchReplies();
      }
    } catch (error) {
      console.error("Error posting reply:", error);
    }
  };

  // Delete a comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/comments?commentId=${commentId}`,
        { method: "DELETE" }
      );

      const data = await response.json();
      if (data.success) {
        fetchReplies();
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  // Copy permalink
  const handleShare = () => {
    if (!correction) return;
    const url = new URL(window.location.href);
    url.searchParams.set("correction", correction.id);
    navigator.clipboard.writeText(url.toString());
  };

  if (!isOpen || !correction) return null;

  const typeInfo = getCorrectionTypeLabel(correction.correctionType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Thread</h2>
            <span className="text-sm text-gray-400">
              {replies.length} comment{replies.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Original Post (Correction) */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex gap-4">
              {/* Vote buttons */}
              <VoteButtons
                itemType="correction"
                itemId={correction.id}
                sessionId={sessionId}
                upvotes={correction.upvotes}
                downvotes={correction.downvotes}
                score={correction.score}
                userVote={correction.userVote}
                vertical
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className={`px-2 py-1 text-sm font-medium rounded ${typeInfo.bg} ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                  <span className="text-gray-500">by</span>
                  <div className="flex items-center gap-1.5">
                    {correction.user.image ? (
                      <img src={correction.user.image} alt="" className="w-5 h-5 rounded-full" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-700" />
                    )}
                    <span className="font-medium text-gray-200">
                      {correction.user.name || "Anonymous"}
                    </span>
                  </div>
                  <span className="text-gray-500">{formatRelativeTime(correction.createdAt)}</span>
                </div>

                {/* Reason/Content */}
                <p className="text-gray-200 whitespace-pre-wrap break-words mb-4">
                  {correction.reason || "No reason provided."}
                </p>

                {/* Detection details */}
                {(correction.originalPrice || correction.correctedPrice) && (
                  <div className="bg-gray-800/50 rounded-lg p-3 mb-4 text-sm">
                    <h4 className="text-gray-400 mb-2 font-medium">Detection Details:</h4>
                    <div className="space-y-1 text-gray-300">
                      {correction.originalPrice && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Original:</span>
                          <span className="font-mono">
                            {correction.originalType?.replace("swing_", "").toUpperCase()} @ ${correction.originalPrice.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {correction.correctedPrice && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Corrected:</span>
                          <span className="font-mono">
                            {correction.correctedType?.replace("swing_", "").toUpperCase()} @ ${correction.correctedPrice.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 text-sm">
                  <button
                    onClick={handleShare}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Share
                  </button>
                  {correction.detectionId && onNavigateToDetection && (
                    <button
                      onClick={() => {
                        onNavigateToDetection(correction.detectionId!);
                        onClose();
                      }}
                      className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View on chart
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Reply composer */}
          {currentUserId && (
            <div className="p-4 border-b border-gray-700 bg-gray-800/30">
              <RichTextEditor
                value={replyContent}
                onChange={setReplyContent}
                onSubmit={handleSubmitReply}
                placeholder="Write a comment..."
                sessionId={sessionId}
                minRows={2}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleSubmitReply}
                  disabled={!replyContent.trim() || isSubmitting}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Posting..." : "Comment"}
                </button>
              </div>
            </div>
          )}

          {/* Sort controls */}
          {replies.length > 0 && (
            <div className="px-6 py-3 border-b border-gray-700 flex items-center gap-2">
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
          )}

          {/* Comments thread */}
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full" />
              </div>
            ) : replies.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No comments yet. Be the first to comment!
              </div>
            ) : (
              <div className="space-y-1">
                {replies.map((reply) => (
                  <ThreadedComment
                    key={reply.id}
                    comment={reply}
                    sessionId={sessionId}
                    currentUserId={currentUserId}
                    onReply={handleReplyToComment}
                    onDelete={handleDeleteComment}
                    onShare={() => {
                      const url = new URL(window.location.href);
                      url.searchParams.set("comment", reply.id);
                      navigator.clipboard.writeText(url.toString());
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
