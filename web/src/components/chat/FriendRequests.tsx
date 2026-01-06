"use client";

import { useState } from "react";
import { TELEGRAM_COLORS } from "@/lib/telegram-theme";

interface FriendRequest {
  id: string;
  sender: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  message: string | null;
  createdAt: string;
}

interface FriendRequestsProps {
  requests: FriendRequest[];
  onAccept: (requestId: string) => Promise<void>;
  onDecline: (requestId: string) => Promise<void>;
  onBlock: (userId: string) => Promise<void>;
}

export function FriendRequestsList({
  requests,
  onAccept,
  onDecline,
  onBlock,
}: FriendRequestsProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAccept = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await onAccept(requestId);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await onDecline(requestId);
    } finally {
      setProcessingId(null);
    }
  };

  if (requests.length === 0) {
    return (
      <div className="p-8 text-center" style={{ color: TELEGRAM_COLORS.hint }}>
        <svg
          className="w-16 h-16 mx-auto mb-4 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
          />
        </svg>
        <p>No message requests</p>
        <p className="text-sm mt-1 opacity-70">
          When someone who isn&apos;t your contact messages you, it will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y" style={{ borderColor: TELEGRAM_COLORS.border }}>
      {requests.map((request) => (
        <div
          key={request.id}
          className="p-4"
          style={{ borderColor: TELEGRAM_COLORS.border }}
        >
          {/* User info */}
          <div className="flex items-center gap-3 mb-3">
            {request.sender.image ? (
              <img
                src={request.sender.image}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium"
                style={{
                  backgroundColor: TELEGRAM_COLORS.secondaryBg,
                  color: TELEGRAM_COLORS.text,
                }}
              >
                {(request.sender.name || request.sender.email)[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" style={{ color: TELEGRAM_COLORS.text }}>
                {request.sender.name || request.sender.email}
              </p>
              <p className="text-sm truncate" style={{ color: TELEGRAM_COLORS.hint }}>
                Wants to send you a message
              </p>
            </div>
            <span className="text-xs" style={{ color: TELEGRAM_COLORS.hint }}>
              {formatTimeAgo(request.createdAt)}
            </span>
          </div>

          {/* Message preview */}
          {request.message && (
            <div
              className="p-3 rounded-lg mb-3"
              style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
            >
              <p className="text-sm" style={{ color: TELEGRAM_COLORS.textSecondary }}>
                {request.message}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAccept(request.id)}
              disabled={processingId === request.id}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: TELEGRAM_COLORS.primary,
                color: TELEGRAM_COLORS.buttonText,
              }}
            >
              {processingId === request.id ? "..." : "Accept"}
            </button>
            <button
              onClick={() => handleDecline(request.id)}
              disabled={processingId === request.id}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: TELEGRAM_COLORS.secondaryBg,
                color: TELEGRAM_COLORS.text,
              }}
            >
              Decline
            </button>
            <button
              onClick={() => onBlock(request.sender.id)}
              disabled={processingId === request.id}
              className="p-2.5 rounded-lg transition-colors"
              style={{
                backgroundColor: TELEGRAM_COLORS.secondaryBg,
                color: TELEGRAM_COLORS.destructive,
              }}
              title="Block user"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Send friend request modal
interface SendRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  onSend: (userId: string, message: string) => Promise<void>;
}

export function SendRequestModal({
  isOpen,
  onClose,
  targetUser,
  onSend,
}: SendRequestModalProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!targetUser) return;

    setIsSending(true);
    try {
      await onSend(targetUser.id, message);
      setMessage("");
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen || !targetUser) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg shadow-xl z-50"
        style={{ backgroundColor: TELEGRAM_COLORS.bgColor }}
      >
        <div className="p-4 border-b" style={{ borderColor: TELEGRAM_COLORS.border }}>
          <h3 className="font-semibold" style={{ color: TELEGRAM_COLORS.text }}>
            Send Message Request
          </h3>
        </div>

        <div className="p-4">
          {/* Target user info */}
          <div className="flex items-center gap-3 mb-4">
            {targetUser.image ? (
              <img
                src={targetUser.image}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium"
                style={{
                  backgroundColor: TELEGRAM_COLORS.secondaryBg,
                  color: TELEGRAM_COLORS.text,
                }}
              >
                {(targetUser.name || targetUser.email)[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-medium" style={{ color: TELEGRAM_COLORS.text }}>
                {targetUser.name || targetUser.email}
              </p>
              <p className="text-sm" style={{ color: TELEGRAM_COLORS.hint }}>
                This user is not in your contacts
              </p>
            </div>
          </div>

          {/* Info notice */}
          <div
            className="p-3 rounded-lg mb-4 text-sm"
            style={{
              backgroundColor: `${TELEGRAM_COLORS.primary}15`,
              color: TELEGRAM_COLORS.hint,
            }}
          >
            <p>
              <span style={{ color: TELEGRAM_COLORS.primary }}>Note:</span> This user will need to accept your request before you can send them messages.
            </p>
          </div>

          {/* Message input */}
          <div>
            <label className="block text-sm mb-2" style={{ color: TELEGRAM_COLORS.hint }}>
              Include a message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi! I'd like to connect with you..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none resize-none"
              style={{
                backgroundColor: TELEGRAM_COLORS.inputBg,
                border: `1px solid ${TELEGRAM_COLORS.inputBorder}`,
                color: TELEGRAM_COLORS.text,
              }}
            />
          </div>
        </div>

        <div
          className="p-4 flex justify-end gap-2 border-t"
          style={{ borderColor: TELEGRAM_COLORS.border }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm transition-colors"
            style={{ color: TELEGRAM_COLORS.hint }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: TELEGRAM_COLORS.primary,
              color: TELEGRAM_COLORS.buttonText,
            }}
          >
            {isSending ? "Sending..." : "Send Request"}
          </button>
        </div>
      </div>
    </>
  );
}

// Helper to format relative time
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
