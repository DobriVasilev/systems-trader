"use client";

import { useState, useEffect } from "react";
import { TELEGRAM_COLORS, getLastSeenText } from "@/lib/telegram-theme";

interface SharedMedia {
  type: "photo" | "video" | "file" | "voice" | "link";
  url: string;
  thumbnail?: string;
  name?: string;
  size?: number;
  date: string;
}

interface CommonGroup {
  id: string;
  name: string;
  icon: string;
  memberCount: number;
}

interface UserProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    bio?: string | null;
    username?: string | null;
    role?: string;
    lastSeen?: string | null;
    isOnline?: boolean;
  } | null;
  currentUserId: string;
  onMessage: () => void;
  onCall?: () => void;
  onVideoCall?: () => void;
  onBlock?: () => void;
  onReport?: () => void;
}

export function UserProfileSidebar({
  isOpen,
  onClose,
  user,
  currentUserId,
  onMessage,
  onCall,
  onVideoCall,
  onBlock,
  onReport,
}: UserProfileSidebarProps) {
  const [activeMediaTab, setActiveMediaTab] = useState<"photos" | "videos" | "files" | "voice" | "links">("photos");
  const [sharedMedia, setSharedMedia] = useState<SharedMedia[]>([]);
  const [commonGroups, setCommonGroups] = useState<CommonGroup[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);

  // Fetch shared media when user changes
  useEffect(() => {
    if (isOpen && user) {
      fetchSharedMedia();
      fetchCommonGroups();
    }
  }, [isOpen, user]);

  const fetchSharedMedia = async () => {
    setIsLoadingMedia(true);
    // Mock data - would fetch from API
    setTimeout(() => {
      setSharedMedia([
        { type: "photo", url: "/placeholder.jpg", thumbnail: "/placeholder.jpg", date: "2024-01-15" },
        { type: "photo", url: "/placeholder2.jpg", thumbnail: "/placeholder2.jpg", date: "2024-01-14" },
        { type: "file", url: "/doc.pdf", name: "Document.pdf", size: 1024000, date: "2024-01-13" },
      ]);
      setIsLoadingMedia(false);
    }, 300);
  };

  const fetchCommonGroups = async () => {
    // Mock data - would fetch from API
    setCommonGroups([
      { id: "1", name: "Trading", icon: "📈", memberCount: 42 },
      { id: "2", name: "General", icon: "💬", memberCount: 128 },
    ]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen || !user) return null;

  const isAdmin = user.role === "admin";
  const isModerator = user.role === "moderator";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className="fixed right-0 top-0 bottom-0 w-80 z-50 overflow-y-auto"
        style={{ backgroundColor: TELEGRAM_COLORS.bgColor }}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center gap-3 p-4 border-b z-10"
          style={{
            backgroundColor: TELEGRAM_COLORS.headerBg,
            borderColor: TELEGRAM_COLORS.border,
          }}
        >
          <button
            onClick={onClose}
            className="p-1.5 rounded-full transition-colors"
            style={{ color: TELEGRAM_COLORS.text }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span style={{ color: TELEGRAM_COLORS.text }}>User Info</span>
        </div>

        {/* Profile Section */}
        <div className="p-6 flex flex-col items-center border-b" style={{ borderColor: TELEGRAM_COLORS.border }}>
          {/* Avatar */}
          <div className="relative mb-4">
            {user.image ? (
              <img
                src={user.image}
                alt=""
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-medium"
                style={{
                  backgroundColor: TELEGRAM_COLORS.secondaryBg,
                  color: TELEGRAM_COLORS.text,
                }}
              >
                {(user.name || user.email)[0]?.toUpperCase()}
              </div>
            )}
            {/* Online indicator */}
            {user.isOnline && (
              <div
                className="absolute bottom-1 right-1 w-5 h-5 rounded-full border-4"
                style={{
                  backgroundColor: TELEGRAM_COLORS.online,
                  borderColor: TELEGRAM_COLORS.bgColor,
                }}
              />
            )}
          </div>

          {/* Name */}
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-semibold" style={{ color: TELEGRAM_COLORS.text }}>
              {user.name || user.email}
            </h2>
            {isAdmin && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: "rgba(236, 57, 66, 0.2)",
                  color: TELEGRAM_COLORS.destructive,
                }}
              >
                Admin
              </span>
            )}
            {isModerator && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: "rgba(82, 136, 193, 0.2)",
                  color: TELEGRAM_COLORS.button,
                }}
              >
                Mod
              </span>
            )}
          </div>

          {/* Username */}
          {user.username && (
            <p className="text-sm mb-1" style={{ color: TELEGRAM_COLORS.accent }}>
              @{user.username}
            </p>
          )}

          {/* Status */}
          <p className="text-sm" style={{ color: TELEGRAM_COLORS.hint }}>
            {user.isOnline ? "online" : getLastSeenText(user.lastSeen || null)}
          </p>

          {/* Bio */}
          {user.bio && (
            <p
              className="text-sm text-center mt-3 px-4"
              style={{ color: TELEGRAM_COLORS.textSecondary }}
            >
              {user.bio}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div
          className="flex items-center justify-center gap-6 py-4 border-b"
          style={{ borderColor: TELEGRAM_COLORS.border }}
        >
          <button
            onClick={onMessage}
            className="flex flex-col items-center gap-1"
            style={{ color: TELEGRAM_COLORS.primary }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${TELEGRAM_COLORS.primary}20` }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-xs">Message</span>
          </button>

          {onCall && (
            <button
              onClick={onCall}
              className="flex flex-col items-center gap-1"
              style={{ color: TELEGRAM_COLORS.primary }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${TELEGRAM_COLORS.primary}20` }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <span className="text-xs">Call</span>
            </button>
          )}

          {onVideoCall && (
            <button
              onClick={onVideoCall}
              className="flex flex-col items-center gap-1"
              style={{ color: TELEGRAM_COLORS.primary }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${TELEGRAM_COLORS.primary}20` }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xs">Video</span>
            </button>
          )}

          <button className="flex flex-col items-center gap-1" style={{ color: TELEGRAM_COLORS.hint }}>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </div>
            <span className="text-xs">More</span>
          </button>
        </div>

        {/* Shared Media Section */}
        <div className="border-b" style={{ borderColor: TELEGRAM_COLORS.border }}>
          <div className="p-3 flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: TELEGRAM_COLORS.text }}>
              Shared Media
            </span>
            <button
              className="text-sm"
              style={{ color: TELEGRAM_COLORS.primary }}
            >
              See All
            </button>
          </div>

          {/* Media tabs */}
          <div className="flex border-b" style={{ borderColor: TELEGRAM_COLORS.border }}>
            {(["photos", "videos", "files", "voice", "links"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveMediaTab(tab)}
                className="flex-1 py-2 text-xs capitalize transition-colors"
                style={{
                  color: activeMediaTab === tab ? TELEGRAM_COLORS.primary : TELEGRAM_COLORS.hint,
                  borderBottom: activeMediaTab === tab ? `2px solid ${TELEGRAM_COLORS.primary}` : "none",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Media grid */}
          <div className="p-2">
            {isLoadingMedia ? (
              <div className="py-8 text-center" style={{ color: TELEGRAM_COLORS.hint }}>
                <div
                  className="w-6 h-6 mx-auto mb-2 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: TELEGRAM_COLORS.primary,
                    borderTopColor: "transparent",
                  }}
                />
              </div>
            ) : sharedMedia.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: TELEGRAM_COLORS.hint }}>
                No {activeMediaTab} shared
              </div>
            ) : activeMediaTab === "photos" || activeMediaTab === "videos" ? (
              <div className="grid grid-cols-3 gap-0.5">
                {sharedMedia
                  .filter((m) => m.type === "photo" || m.type === "video")
                  .slice(0, 6)
                  .map((media, i) => (
                    <button
                      key={i}
                      className="aspect-square rounded overflow-hidden"
                      style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
                    >
                      {media.thumbnail && (
                        <img
                          src={media.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </button>
                  ))}
              </div>
            ) : (
              <div className="space-y-1">
                {sharedMedia
                  .filter((m) => m.type === "file")
                  .slice(0, 5)
                  .map((media, i) => (
                    <button
                      key={i}
                      className="w-full flex items-center gap-3 p-2 rounded transition-colors"
                      style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
                    >
                      <div
                        className="w-10 h-10 rounded flex items-center justify-center"
                        style={{ backgroundColor: TELEGRAM_COLORS.primary }}
                      >
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm truncate" style={{ color: TELEGRAM_COLORS.text }}>
                          {media.name}
                        </p>
                        <p className="text-xs" style={{ color: TELEGRAM_COLORS.hint }}>
                          {media.size && formatFileSize(media.size)}
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Notifications Toggle */}
        <div
          className="p-4 flex items-center justify-between border-b"
          style={{ borderColor: TELEGRAM_COLORS.border }}
        >
          <div>
            <p className="text-sm" style={{ color: TELEGRAM_COLORS.text }}>Notifications</p>
            <p className="text-xs" style={{ color: TELEGRAM_COLORS.hint }}>
              {notificationsEnabled ? "Enabled" : "Muted"}
            </p>
          </div>
          <button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className="relative w-11 h-6 rounded-full transition-colors"
            style={{
              backgroundColor: notificationsEnabled ? TELEGRAM_COLORS.online : TELEGRAM_COLORS.secondaryBg,
            }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform"
              style={{
                left: notificationsEnabled ? "22px" : "2px",
              }}
            />
          </button>
        </div>

        {/* Common Groups */}
        {commonGroups.length > 0 && (
          <div className="border-b" style={{ borderColor: TELEGRAM_COLORS.border }}>
            <div className="p-3">
              <span className="text-sm font-medium" style={{ color: TELEGRAM_COLORS.text }}>
                {commonGroups.length} group{commonGroups.length !== 1 ? "s" : ""} in common
              </span>
            </div>
            <div className="pb-2">
              {commonGroups.map((group) => (
                <button
                  key={group.id}
                  className="w-full flex items-center gap-3 px-4 py-2 transition-colors"
                  style={{ backgroundColor: "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = TELEGRAM_COLORS.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <span className="text-2xl">{group.icon}</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm" style={{ color: TELEGRAM_COLORS.text }}>{group.name}</p>
                    <p className="text-xs" style={{ color: TELEGRAM_COLORS.hint }}>
                      {group.memberCount} members
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Block/Report Section */}
        {user.id !== currentUserId && (
          <div className="p-4 space-y-2">
            {onBlock && (
              <button
                onClick={onBlock}
                className="w-full py-2.5 text-sm rounded transition-colors"
                style={{
                  backgroundColor: TELEGRAM_COLORS.secondaryBg,
                  color: TELEGRAM_COLORS.destructive,
                }}
              >
                Block User
              </button>
            )}
            {onReport && (
              <button
                onClick={onReport}
                className="w-full py-2.5 text-sm rounded transition-colors"
                style={{
                  backgroundColor: TELEGRAM_COLORS.secondaryBg,
                  color: TELEGRAM_COLORS.destructive,
                }}
              >
                Report
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
