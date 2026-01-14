"use client";

import { memo, useState, useRef, useEffect } from "react";
import { TELEGRAM_COLORS, DEFAULT_REACTIONS } from "@/lib/telegram-theme";
import { VoiceMessagePlayer } from "./VoiceRecorder";

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

interface Attachment {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  category: string;
  size: number;
  duration?: number | null;
  transcription?: string | null;
  transcriptionStatus?: string | null;
}

interface MessageBubbleProps {
  id: string;
  content: string;
  userName: string;
  userAvatar: string | null;
  userId: string;
  currentUserId: string;
  createdAt: string;
  edited?: boolean;
  isVip?: boolean;
  reactions: Reaction[];
  replyTo?: {
    id: string;
    userName: string;
    content: string;
  } | null;
  readStatus?: "sending" | "sent" | "delivered" | "read";
  attachments?: Attachment[];
  // For message grouping
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUserClick: (userId: string) => void;
  onImageClick?: (imageUrl: string) => void;
  renderContent: (content: string) => React.ReactNode;
}

function MessageBubbleComponent({
  id,
  content,
  userName,
  userAvatar,
  userId,
  currentUserId,
  createdAt,
  edited,
  isVip,
  reactions,
  replyTo,
  readStatus,
  attachments,
  isFirstInGroup = true,
  isLastInGroup = true,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onUserClick,
  onImageClick,
  renderContent,
}: MessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [voiceTranscriptions, setVoiceTranscriptions] = useState<Record<string, string>>({});
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastTapTime = useRef<number>(0);

  // Swipe-to-reply state
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const isOwn = userId === currentUserId;
  const time = new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Swipe gesture handlers
  const handleTouchStartSwipe = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMoveSwipe = (e: React.TouchEvent) => {
    if (!touchStartX.current) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0 && deltaX < 80) {
      setSwipeOffset(deltaX);
      e.preventDefault();
    }
  };

  const handleTouchEndSwipe = () => {
    if (swipeOffset > 50) {
      // Trigger reply
      onReply();
    }

    // Reset
    setSwipeOffset(0);
    touchStartX.current = 0;
    touchStartY.current = 0;
  };

  // Poll for transcriptions for voice messages
  useEffect(() => {
    if (!attachments) return;

    const voiceAttachments = attachments.filter(
      (a) => a.category === "audio" && a.transcriptionStatus === "processing"
    );

    if (voiceAttachments.length === 0) return;

    const pollInterval = setInterval(async () => {
      for (const attachment of voiceAttachments) {
        try {
          const res = await fetch(`/api/chat/transcribe?attachmentId=${attachment.id}`);
          const data = await res.json();

          if (data.success && data.data.status === "completed" && data.data.transcription) {
            setVoiceTranscriptions((prev) => ({
              ...prev,
              [attachment.id]: data.data.transcription,
            }));
          }
        } catch (error) {
          console.error("Error polling transcription:", error);
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [attachments]);

  // Double tap detection for quick react
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      // Double tap - quick react with heart
      onReact("❤️");
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }
  };

  // Long press for reaction picker
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowReactionPicker(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // Read receipt icons
  const ReadReceipt = () => {
    if (!isOwn || !readStatus) return null;

    if (readStatus === "sending") {
      return (
        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    }

    if (readStatus === "sent") {
      return (
        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none">
          <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    const color = readStatus === "read" ? TELEGRAM_COLORS.primary : "currentColor";
    return (
      <svg className="w-4 h-4" style={{ color }} viewBox="0 0 24 24" fill="none">
        <path d="M2 12l5 5L17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 12l5 5L22 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  // Bubble tail SVG
  const BubbleTail = ({ side }: { side: "left" | "right" }) => {
    if (!isLastInGroup) return null;

    return (
      <svg
        className={`absolute bottom-0 w-3 h-3 ${
          side === "right" ? "-right-1.5" : "-left-1.5"
        }`}
        style={{
          fill: side === "right" ? TELEGRAM_COLORS.outgoingBubble : TELEGRAM_COLORS.incomingBubble,
        }}
        viewBox="0 0 12 12"
      >
        {side === "right" ? (
          <path d="M0 12 Q0 0 12 0 L0 0 Z" />
        ) : (
          <path d="M12 12 Q12 0 0 0 L12 0 Z" />
        )}
      </svg>
    );
  };

  return (
    <div
      className={`group flex items-end gap-2 ${isOwn ? "flex-row-reverse" : ""} transition-transform`}
      style={{
        marginTop: isFirstInGroup ? "8px" : "2px",
        marginBottom: isLastInGroup ? "8px" : "2px",
        transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : "none",
      }}
      onClick={handleTap}
      onTouchStart={(e) => {
        handleTouchStart(e);
        handleTouchStartSwipe(e);
      }}
      onTouchMove={handleTouchMoveSwipe}
      onTouchEnd={(e) => {
        handleTouchEnd(e);
        handleTouchEndSwipe();
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactionPicker(false);
      }}
    >
      {/* Avatar - only show for first message in group from others */}
      <div className="w-8 flex-shrink-0">
        {!isOwn && isLastInGroup && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUserClick(userId);
            }}
            className="block"
          >
            {userAvatar ? (
              <img src={userAvatar} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg, color: TELEGRAM_COLORS.text }}
              >
                {userName[0]?.toUpperCase()}
              </div>
            )}
          </button>
        )}
      </div>

      <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
        {/* Username - only for first message in group from others */}
        {!isOwn && isFirstInGroup && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUserClick(userId);
            }}
            className="text-sm font-medium mb-1 flex items-center gap-2"
            style={{ color: TELEGRAM_COLORS.accent }}
          >
            {userName}
            {isVip && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "rgba(255, 193, 7, 0.2)",
                  color: "#FFC107",
                }}
              >
                VIP
              </span>
            )}
          </button>
        )}

        {/* Reply reference */}
        {replyTo && (
          <div
            className="text-xs mb-1 px-2 py-1 rounded border-l-2"
            style={{
              backgroundColor: isOwn
                ? "rgba(255,255,255,0.1)"
                : "rgba(255,255,255,0.05)",
              borderColor: TELEGRAM_COLORS.accent,
              color: TELEGRAM_COLORS.hint,
            }}
          >
            <span style={{ color: TELEGRAM_COLORS.accent }}>{replyTo.userName}</span>
            <p className="truncate">{replyTo.content.slice(0, 50)}</p>
          </div>
        )}

        {/* Message bubble */}
        <div
          className="relative px-3 py-2"
          style={{
            backgroundColor: isOwn
              ? TELEGRAM_COLORS.outgoingBubble
              : TELEGRAM_COLORS.incomingBubble,
            borderRadius: isOwn
              ? isLastInGroup
                ? "18px 18px 4px 18px"
                : "18px 18px 18px 18px"
              : isLastInGroup
              ? "18px 18px 18px 4px"
              : "18px 18px 18px 18px",
          }}
        >
          <BubbleTail side={isOwn ? "right" : "left"} />

          {/* Image Attachments */}
          {attachments && attachments.length > 0 && (
            <div className="space-y-2 mb-2">
              {attachments
                .filter((a) => a.category === "image")
                .map((attachment) => (
                  <button
                    key={attachment.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onImageClick?.(attachment.url);
                    }}
                    className="block rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={attachment.url}
                      alt={attachment.filename}
                      className="max-w-full max-h-64 object-cover rounded-lg"
                    />
                  </button>
                ))}
            </div>
          )}

          {/* Voice Attachments */}
          {attachments && attachments.length > 0 && (
            <div className="space-y-2 mb-2">
              {attachments
                .filter((a) => a.category === "audio")
                .map((attachment) => (
                  <div key={attachment.id} className="flex flex-col gap-2">
                    <VoiceMessagePlayer
                      audioUrl={attachment.url}
                      duration={attachment.duration || 0}
                      isPlayed={false}
                    />
                    {/* Transcription */}
                    {(attachment.transcription || voiceTranscriptions[attachment.id]) && (
                      <div
                        className="text-sm px-3 py-2 rounded-lg italic"
                        style={{
                          backgroundColor: isOwn
                            ? "rgba(255, 255, 255, 0.1)"
                            : "rgba(255, 255, 255, 0.05)",
                          color: TELEGRAM_COLORS.hint,
                        }}
                      >
                        {attachment.transcription || voiceTranscriptions[attachment.id]}
                      </div>
                    )}
                    {/* Transcription status */}
                    {attachment.transcriptionStatus === "processing" &&
                      !attachment.transcription &&
                      !voiceTranscriptions[attachment.id] && (
                        <div
                          className="text-xs px-3 py-1 rounded flex items-center gap-2"
                          style={{ color: TELEGRAM_COLORS.hint }}
                        >
                          <div
                            className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                            style={{
                              borderColor: TELEGRAM_COLORS.hint,
                              borderTopColor: "transparent",
                            }}
                          />
                          <span>Transcribing...</span>
                        </div>
                      )}
                    {attachment.transcriptionStatus === "failed" && (
                      <div
                        className="text-xs px-3 py-1 rounded"
                        style={{ color: TELEGRAM_COLORS.destructive }}
                      >
                        Transcription failed
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Content */}
          <div style={{ color: TELEGRAM_COLORS.text }}>
            {renderContent(content)}
          </div>

          {/* Time and read status */}
          <div
            className="flex items-center gap-1 justify-end mt-0.5"
            style={{ color: TELEGRAM_COLORS.hint }}
          >
            {edited && <span className="text-xs">edited</span>}
            <span className="text-xs">{time}</span>
            <ReadReceipt />
          </div>
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  onReact(reaction.emoji);
                }}
                className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                style={{
                  backgroundColor: reaction.userReacted
                    ? TELEGRAM_COLORS.reactionBgSelected
                    : TELEGRAM_COLORS.reactionBg,
                  border: reaction.userReacted
                    ? `1px solid ${TELEGRAM_COLORS.primary}`
                    : `1px solid ${TELEGRAM_COLORS.border}`,
                }}
              >
                <span>{reaction.emoji}</span>
                <span style={{ color: TELEGRAM_COLORS.text }}>{reaction.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Reaction picker */}
        {showReactionPicker && (
          <div
            className="absolute -top-12 left-0 flex gap-1 p-2 rounded-full shadow-xl z-20"
            style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
          >
            {DEFAULT_REACTIONS.map(({ emoji }) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  onReact(emoji);
                  setShowReactionPicker(false);
                }}
                className="text-xl hover:scale-125 transition-transform p-1"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {showActions && (
          <div
            className="flex items-center gap-1 mt-1 transition-opacity"
            style={{ opacity: showActions ? 1 : 0 }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReply();
              }}
              className="p-1.5 rounded-full transition-colors"
              style={{ color: TELEGRAM_COLORS.hint }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TELEGRAM_COLORS.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = TELEGRAM_COLORS.hint)}
              title="Reply"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReactionPicker(!showReactionPicker);
              }}
              className="p-1.5 rounded-full transition-colors"
              style={{ color: TELEGRAM_COLORS.hint }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TELEGRAM_COLORS.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = TELEGRAM_COLORS.hint)}
              title="React"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {isOwn && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1.5 rounded-full transition-colors"
                style={{ color: TELEGRAM_COLORS.hint }}
                onMouseEnter={(e) => (e.currentTarget.style.color = TELEGRAM_COLORS.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = TELEGRAM_COLORS.hint)}
                title="Edit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {isOwn && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 rounded-full transition-colors"
                style={{ color: TELEGRAM_COLORS.hint }}
                onMouseEnter={(e) => (e.currentTarget.style.color = TELEGRAM_COLORS.destructive)}
                onMouseLeave={(e) => (e.currentTarget.style.color = TELEGRAM_COLORS.hint)}
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);
