"use client";

import { memo, useState, useRef } from "react";
import { TELEGRAM_COLORS, DEFAULT_REACTIONS } from "@/lib/telegram-theme";

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
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
  // For message grouping
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUserClick: (userId: string) => void;
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
  isFirstInGroup = true,
  isLastInGroup = true,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onUserClick,
  renderContent,
}: MessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastTapTime = useRef<number>(0);

  const isOwn = userId === currentUserId;
  const time = new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

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
      className={`group flex items-end gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
      style={{
        marginTop: isFirstInGroup ? "8px" : "2px",
        marginBottom: isLastInGroup ? "8px" : "2px",
      }}
      onClick={handleTap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
