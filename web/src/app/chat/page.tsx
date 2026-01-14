"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TELEGRAM_COLORS, getLastSeenText, DEFAULT_REACTIONS } from "@/lib/telegram-theme";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { UserProfileSidebar } from "@/components/chat/UserProfileSidebar";
import { AdminPanel } from "@/components/chat/AdminPanel";
import { FriendRequestsList, SendRequestModal } from "@/components/chat/FriendRequests";
import { ImageViewer } from "@/components/chat/ImageViewer";
import { FileUpload } from "@/components/chat/FileUpload";

// Types
interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  attachments: string[] | null;
  isVip: boolean;
  pinned: boolean;
  edited: boolean;
  editedAt: string | null;
  deleted: boolean;
  channelId: string | null;
  reactions: Array<{ emoji: string; count: number; userReacted: boolean }>;
  replyToId: string | null;
  replyTo: {
    id: string;
    userName: string;
    content: string;
  } | null;
  _count?: { readReceipts: number };
  createdAt: string;
}

interface Channel {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  type: "public" | "private";
  isDefault: boolean;
  unreadCount: number;
  isMember: boolean;
  role: string | null;
  muted: boolean;
  _count: { messages: number; members: number };
}

interface OnlineUser {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  isVip: boolean;
  status: string;
  lastSeen: string;
}

interface DMConversation {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    isFromMe: boolean;
  };
  unreadCount: number;
}

interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  imageUrl: string | null;
  read: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    image: string | null;
  };
  receiver: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface MentionUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  status: string;
}

interface Notification {
  id: string;
  type: "mention" | "reply" | "dm" | "channel_invite";
  title: string;
  body: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

interface TypingUser {
  userId: string;
  userName: string;
}

type ViewMode = "channels" | "dms";

const EMOJI_OPTIONS = DEFAULT_REACTIONS.map(r => r.emoji);
const CHANNEL_ICONS = ["💬", "📢", "🎯", "💡", "🔧", "📈", "🎨", "🌟"];

// Loading fallback for Suspense
function ChatLoadingFallback() {
  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: TELEGRAM_COLORS.bgColor, color: TELEGRAM_COLORS.text }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: TELEGRAM_COLORS.primary, borderTopColor: "transparent" }}
        />
        <span style={{ color: TELEGRAM_COLORS.hint }}>Loading chat...</span>
      </div>
    </main>
  );
}

// Main export wrapped in Suspense
export default function ChatPage() {
  return (
    <Suspense fallback={<ChatLoadingFallback />}>
      <ChatPageContent />
    </Suspense>
  );
}

function ChatPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const initialChannel = searchParams.get("channel");

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("channels");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(initialChannel);
  const [selectedDM, setSelectedDM] = useState<string | null>(null);

  // Data state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // UI state
  const [inputValue, setInputValue] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const [newChannelIcon, setNewChannelIcon] = useState("💬");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // New integrated component states
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<{
    id: string;
    name: string;
    image: string | null;
    email?: string;
    bio?: string;
    lastSeen?: string;
  } | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [showSendRequestModal, setShowSendRequestModal] = useState(false);
  const [sendRequestUserId, setSendRequestUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Image viewer state
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);

  // File upload state
  const [uploadedAttachments, setUploadedAttachments] = useState<Array<{ id: string }>>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/channels");
      const data = await res.json();
      if (data.success) {
        setChannels(data.data);
        // Auto-select default channel if none selected
        if (!selectedChannelId && data.data.length > 0) {
          const defaultChannel = data.data.find((c: Channel) => c.isDefault);
          if (defaultChannel) {
            setSelectedChannelId(defaultChannel.id);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching channels:", error);
    }
  }, [selectedChannelId]);

  // Fetch messages for selected channel
  const fetchMessages = useCallback(async () => {
    try {
      const url = selectedChannelId
        ? `/api/chat/messages?channelId=${selectedChannelId}`
        : "/api/chat/messages";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, [selectedChannelId]);

  // Fetch online users
  const fetchOnlineUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/presence");
      const data = await res.json();
      if (data.success) {
        setOnlineUsers(data.data);
      }
    } catch (error) {
      console.error("Error fetching online users:", error);
    }
  }, []);

  // Fetch DM conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/dm/conversations");
      const data = await res.json();
      if (data.success) {
        setConversations(data.data);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  }, []);

  // Fetch DM messages
  const fetchDMMessages = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/chat/dm?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setDmMessages(data.data);
      }
    } catch (error) {
      console.error("Error fetching DM messages:", error);
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/notifications");
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadNotifications(data.data.unreadCount);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, []);

  // Update presence
  const updatePresence = useCallback(async () => {
    try {
      await fetch("/api/chat/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "online" }),
      });
    } catch (error) {
      console.error("Error updating presence:", error);
    }
  }, []);

  // Search users for @mentions
  const searchMentionUsers = useCallback(async (query: string) => {
    try {
      const res = await fetch(`/api/chat/users?q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      if (data.success) {
        setMentionUsers(data.data);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    }
  }, []);

  // Search messages
  const searchMessages = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/chat/search?q=${encodeURIComponent(searchQuery)}${
          selectedChannelId ? `&channelId=${selectedChannelId}` : ""
        }`
      );
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data.messages);
      }
    } catch (error) {
      console.error("Error searching messages:", error);
    }
  }, [searchQuery, selectedChannelId]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(async () => {
    const now = Date.now();
    // Throttle to once every 2 seconds
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;

    try {
      await fetch("/api/chat/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selectedChannelId }),
      });
    } catch (error) {
      console.error("Error sending typing indicator:", error);
    }
  }, [selectedChannelId]);

  // Clear typing indicator
  const clearTypingIndicator = useCallback(async () => {
    try {
      await fetch("/api/chat/typing", { method: "DELETE" });
    } catch (error) {
      console.error("Error clearing typing indicator:", error);
    }
  }, []);

  // Initial load and SSE
  useEffect(() => {
    if (!session?.user) return;

    let eventSource: EventSource | null = null;

    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchChannels(),
        fetchOnlineUsers(),
        fetchConversations(),
        fetchNotifications(),
        updatePresence(),
      ]);

      // Check if user is admin (fetch from API to verify database role)
      try {
        const adminRes = await fetch("/api/user/me");
        const adminData = await adminRes.json();
        if (adminData.success && adminData.data?.role === "admin") {
          setIsAdmin(true);
        } else if (session?.user?.email === "dobrivassi09@gmail.com") {
          // Fallback for the main admin email
          setIsAdmin(true);
        }
      } catch {
        // Fallback: check by email
        if (session?.user?.email === "dobrivassi09@gmail.com") {
          setIsAdmin(true);
        }
      }

      setIsLoading(false);

      // Connect to SSE
      eventSource = new EventSource("/api/chat/stream");

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "new_message":
              if (
                (data.channelId === selectedChannelId) ||
                (data.channelId === null && !selectedChannelId)
              ) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === data.message.id)) return prev;
                  return [...prev, data.message];
                });
              }
              // Update channel unread count
              if (data.channelId) {
                setChannels((prev) =>
                  prev.map((c) =>
                    c.id === data.channelId
                      ? { ...c, unreadCount: c.unreadCount + 1 }
                      : c
                  )
                );
              }
              break;

            case "message_edited":
              setMessages((prev) =>
                prev.map((m) => (m.id === data.message.id ? data.message : m))
              );
              break;

            case "message_deleted":
              setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
              break;

            case "reaction_add":
            case "reaction_remove":
              // Refresh messages to get updated reactions
              fetchMessages();
              break;

            case "typing_start":
              if (
                (data.channelId === selectedChannelId) ||
                (data.channelId === null && !selectedChannelId)
              ) {
                setTypingUsers((prev) => {
                  if (prev.some((u) => u.userId === data.userId)) return prev;
                  return [...prev, { userId: data.userId, userName: data.userName }];
                });
                // Auto-remove after 3 seconds
                setTimeout(() => {
                  setTypingUsers((prev) =>
                    prev.filter((u) => u.userId !== data.userId)
                  );
                }, 3000);
              }
              break;

            case "typing_stop":
              setTypingUsers((prev) =>
                prev.filter((u) => u.userId !== data.userId)
              );
              break;

            case "presence_update":
              if (data.status === "online" && data.user) {
                setOnlineUsers((prev) => {
                  const exists = prev.some((u) => u.userId === data.userId);
                  if (exists) {
                    return prev.map((u) =>
                      u.userId === data.userId ? data.user : u
                    );
                  }
                  return [...prev, data.user];
                });
              } else if (data.status === "offline") {
                setOnlineUsers((prev) =>
                  prev.filter((u) => u.userId !== data.userId)
                );
              }
              break;

            case "presence_list":
              setOnlineUsers(data.users);
              break;

            case "notification":
              setUnreadNotifications((prev) => prev + 1);
              // Show browser notification if permitted
              if (Notification.permission === "granted") {
                new Notification(data.notification.title, {
                  body: data.notification.body,
                });
              }
              break;

            case "new_dm":
              if (data.message.senderId === selectedDM) {
                setDmMessages((prev) => {
                  if (prev.some((m) => m.id === data.message.id)) return prev;
                  return [...prev, data.message];
                });
              }
              fetchConversations();
              break;

            case "ping":
              break;
          }
        } catch (e) {
          console.error("Error parsing SSE message:", e);
        }
      };

      eventSource.onerror = () => {
        console.log("SSE connection error, will retry...");
        eventSource?.close();
        setTimeout(() => {
          if (session?.user) {
            loadData();
          }
        }, 5000);
      };
    };

    loadData();

    // Presence heartbeat
    const presenceInterval = setInterval(updatePresence, 30000);

    // Request notification permission
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      eventSource?.close();
      clearInterval(presenceInterval);
      fetch("/api/chat/presence", { method: "DELETE" }).catch(() => {});
    };
  }, [
    session?.user,
    fetchChannels,
    fetchOnlineUsers,
    fetchConversations,
    fetchNotifications,
    updatePresence,
    selectedChannelId,
    selectedDM,
    fetchMessages,
  ]);

  // Fetch messages when channel changes
  useEffect(() => {
    if (session?.user && viewMode === "channels") {
      fetchMessages();
      // Mark channel as read
      if (selectedChannelId) {
        setChannels((prev) =>
          prev.map((c) =>
            c.id === selectedChannelId ? { ...c, unreadCount: 0 } : c
          )
        );
      }
    }
  }, [session?.user, selectedChannelId, viewMode, fetchMessages]);

  // Fetch DM messages when selected
  useEffect(() => {
    if (selectedDM) {
      fetchDMMessages(selectedDM);
    }
  }, [selectedDM, fetchDMMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, dmMessages, scrollToBottom]);

  // Handle @mention detection
  useEffect(() => {
    const match = inputValue.match(/@(\w*)$/);
    if (match) {
      setShowMentions(true);
      setMentionQuery(match[1]);
      searchMentionUsers(match[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
      setMentionUsers([]);
    }
  }, [inputValue, searchMentionUsers]);

  // Handle input change with typing indicator
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      sendTypingIndicator();

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Set new timeout to clear typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(clearTypingIndicator, 3000);
    },
    [sendTypingIndicator, clearTypingIndicator]
  );

  // Insert mention
  const insertMention = useCallback((user: MentionUser) => {
    const beforeMention = inputValue.replace(/@\w*$/, "");
    const mention = `@[${user.name || user.email}](${user.id}) `;
    setInputValue(beforeMention + mention);
    setShowMentions(false);
    inputRef.current?.focus();
  }, [inputValue]);

  // Handle keyboard in input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showMentions && mentionUsers.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((prev) => (prev + 1) % mentionUsers.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex((prev) =>
            prev === 0 ? mentionUsers.length - 1 : prev - 1
          );
        } else if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(mentionUsers[mentionIndex]);
        } else if (e.key === "Escape") {
          setShowMentions(false);
        }
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (editingMessage) {
          saveEdit();
        } else if (viewMode === "dms" && selectedDM) {
          sendDM();
        } else {
          sendMessage();
        }
      }
    },
    [showMentions, mentionUsers, mentionIndex, insertMention, editingMessage, viewMode, selectedDM]
  );

  // Send message
  const sendMessage = async () => {
    if ((!inputValue.trim() && uploadedAttachments.length === 0) || !session?.user || isSending) return;

    setIsSending(true);
    clearTypingIndicator();

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: inputValue,
          replyToId: replyingTo?.id,
          channelId: selectedChannelId,
          attachments: uploadedAttachments.length > 0 ? uploadedAttachments.map(a => a.id) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.data.id)) return prev;
          return [...prev, data.data];
        });
        setInputValue("");
        setReplyingTo(null);
        setUploadedAttachments([]);
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Send voice message
  const sendVoiceMessage = async (audioBlob: Blob, duration: number) => {
    if (!session?.user || isSending) return;

    setIsSending(true);

    try {
      // Convert blob to File
      const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, {
        type: audioBlob.type || "audio/webm",
      });

      // Step 1: Get presigned upload URL
      const uploadRes = await fetch("/api/chat/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: audioFile.name,
          contentType: audioFile.type,
          fileSize: audioFile.size,
          channelId: selectedChannelId,
        }),
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.error || "Failed to prepare upload");
      }

      // Step 2: Upload to R2
      await fetch(uploadData.data.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": audioFile.type,
        },
        body: audioFile,
      });

      // Step 3: Confirm upload
      await fetch("/api/chat/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentId: uploadData.data.attachmentId,
        }),
      });

      // Step 4: Trigger transcription (async, don't wait)
      fetch("/api/chat/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentId: uploadData.data.attachmentId,
        }),
      }).catch((err) => console.error("Transcription error:", err));

      // Step 5: Send message with attachment
      const messageRes = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `🎤 Voice message (${duration.toFixed(1)}s)`,
          attachments: [uploadData.data.attachmentId],
          replyToId: replyingTo?.id,
          channelId: selectedChannelId,
        }),
      });

      const messageData = await messageRes.json();
      if (messageData.success) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === messageData.data.id)) return prev;
          return [...prev, messageData.data];
        });
        setReplyingTo(null);
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Error sending voice message:", error);
      alert("Failed to send voice message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Send DM
  const sendDM = async () => {
    if (!inputValue.trim() || !session?.user || !selectedDM || isSending) return;

    setIsSending(true);

    try {
      const res = await fetch("/api/chat/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selectedDM,
          content: inputValue,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDmMessages((prev) => [...prev, data.data]);
        setInputValue("");
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Error sending DM:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Start editing
  const startEdit = useCallback((message: ChatMessage) => {
    setEditingMessage(message);
    setInputValue(message.content);
    inputRef.current?.focus();
  }, []);

  // Save edit
  const saveEdit = async () => {
    if (!editingMessage || !inputValue.trim() || isSending) return;

    setIsSending(true);

    try {
      const res = await fetch("/api/chat/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: editingMessage.id,
          content: inputValue,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === editingMessage.id ? { ...m, ...data.data, edited: true } : m))
        );
        setEditingMessage(null);
        setInputValue("");
      }
    } catch (error) {
      console.error("Error editing message:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Cancel edit
  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
    setInputValue("");
  }, []);

  // Toggle reaction
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!session?.user) return;

    const message = messages.find((m) => m.id === messageId);
    const existingReaction = message?.reactions.find((r) => r.emoji === emoji);
    const hasReacted = existingReaction?.userReacted;

    try {
      if (hasReacted) {
        await fetch(`/api/chat/reactions?messageId=${messageId}&emoji=${encodeURIComponent(emoji)}`, {
          method: "DELETE",
        });
      } else {
        await fetch("/api/chat/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, emoji }),
        });
      }

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = [...m.reactions];
          const idx = reactions.findIndex((r) => r.emoji === emoji);
          if (idx >= 0) {
            if (hasReacted) {
              reactions[idx].count--;
              reactions[idx].userReacted = false;
              if (reactions[idx].count === 0) {
                reactions.splice(idx, 1);
              }
            } else {
              reactions[idx].count++;
              reactions[idx].userReacted = true;
            }
          } else {
            reactions.push({ emoji, count: 1, userReacted: true });
          }
          return { ...m, reactions };
        })
      );
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
    setShowEmojiPicker(null);
  };

  // Delete message
  const deleteMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/chat/messages?id=${messageId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  // Create channel
  const createChannel = async () => {
    if (!newChannelName.trim()) return;

    try {
      const res = await fetch("/api/chat/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newChannelName,
          description: newChannelDescription,
          icon: newChannelIcon,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChannels((prev) => [...prev, { ...data.data, unreadCount: 0, isMember: true, role: "admin", muted: false }]);
        setSelectedChannelId(data.data.id);
        setShowChannelModal(false);
        setNewChannelName("");
        setNewChannelDescription("");
        setNewChannelIcon("💬");
      }
    } catch (error) {
      console.error("Error creating channel:", error);
    }
  };

  // Mark notifications as read
  const markNotificationsRead = async () => {
    try {
      await fetch("/api/chat/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadNotifications(0);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  // Start DM with user
  const startDMWithUser = (userId: string) => {
    setViewMode("dms");
    setSelectedDM(userId);
  };

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  // Render @mention content
  const renderMessageContent = (content: string) => {
    // Parse @[name](id) mentions
    const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      const match = part.match(/@\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        return (
          <span
            key={i}
            className="bg-blue-500/30 text-blue-300 px-1 rounded cursor-pointer hover:bg-blue-500/50"
            onClick={() => startDMWithUser(match[2])}
          >
            @{match[1]}
          </span>
        );
      }
      return part;
    });
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = "";

    messages.forEach((msg) => {
      const msgDate = new Date(msg.createdAt).toLocaleDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  }, [messages]);

  // Selected channel
  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId),
    [channels, selectedChannelId]
  );

  if (!session?.user) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: TELEGRAM_COLORS.bgColor, color: TELEGRAM_COLORS.text }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Sign in to access chat</h1>
          <Link
            href="/api/auth/signin"
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: TELEGRAM_COLORS.primary, color: TELEGRAM_COLORS.buttonText }}
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: TELEGRAM_COLORS.bgColor, color: TELEGRAM_COLORS.text }}
    >
      {/* Header */}
      <header
        className="backdrop-blur-sm sticky top-0 z-50"
        style={{
          backgroundColor: TELEGRAM_COLORS.headerBg,
          borderBottom: `1px solid ${TELEGRAM_COLORS.border}`,
        }}
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/dashboard"
              className="font-semibold hover:opacity-80 transition-opacity"
              style={{ color: TELEGRAM_COLORS.text }}
            >
              Systems Trader
            </Link>
            <span style={{ color: TELEGRAM_COLORS.hint }}>/</span>
            <span style={{ color: TELEGRAM_COLORS.hint }}>Chat</span>
            {selectedChannel && (
              <>
                <span style={{ color: TELEGRAM_COLORS.hint }}>/</span>
                <span style={{ color: TELEGRAM_COLORS.accent }}>
                  {selectedChannel.icon} {selectedChannel.name}
                </span>
              </>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {/* Search */}
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 transition-colors"
              style={{ color: TELEGRAM_COLORS.hint }}
              title="Search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    markNotificationsRead();
                  }
                }}
                className="p-2 transition-colors relative"
                style={{ color: TELEGRAM_COLORS.hint }}
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotifications > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center"
                    style={{ backgroundColor: TELEGRAM_COLORS.destructive, color: "#fff" }}
                  >
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </button>

              {/* Notifications dropdown */}
              {showNotifications && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50"
                  style={{
                    backgroundColor: TELEGRAM_COLORS.secondaryBg,
                    border: `1px solid ${TELEGRAM_COLORS.border}`,
                  }}
                >
                  <div
                    className="p-3 font-medium"
                    style={{
                      color: TELEGRAM_COLORS.text,
                      borderBottom: `1px solid ${TELEGRAM_COLORS.border}`,
                    }}
                  >
                    Notifications
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center" style={{ color: TELEGRAM_COLORS.hint }}>
                      No notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className="p-3 cursor-pointer hover:opacity-80"
                        style={{
                          borderBottom: `1px solid ${TELEGRAM_COLORS.border}50`,
                          backgroundColor: !n.read ? `${TELEGRAM_COLORS.primary}20` : "transparent",
                        }}
                        onClick={() => {
                          if (n.link) {
                            window.location.href = n.link;
                          }
                          setShowNotifications(false);
                        }}
                      >
                        <div className="font-medium text-sm" style={{ color: TELEGRAM_COLORS.text }}>{n.title}</div>
                        <div className="text-xs mt-1" style={{ color: TELEGRAM_COLORS.hint }}>{n.body}</div>
                        <div className="text-xs mt-1" style={{ color: TELEGRAM_COLORS.hint }}>
                          {formatTime(n.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Friend Requests Button */}
            <button
              onClick={() => setShowFriendRequests(true)}
              className="p-2 transition-colors hover:opacity-80"
              style={{ color: TELEGRAM_COLORS.hint }}
              title="Friend Requests"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>

            {/* Admin Panel Button */}
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowAdminPanel(true)}
                  className="p-2 transition-colors hover:opacity-80"
                  style={{ color: TELEGRAM_COLORS.primary }}
                  title="Admin Panel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <button
                  onClick={async () => {
                    if (confirm("Are you sure you want to clear ALL messages in this channel? This cannot be undone!")) {
                      try {
                        const res = await fetch(`/api/chat/messages?channelId=${selectedChannelId || "null"}`, {
                          method: "DELETE",
                        });
                        if (res.ok) {
                          setMessages([]);
                        }
                      } catch (error) {
                        console.error("Error clearing messages:", error);
                      }
                    }
                  }}
                  className="p-2 transition-colors hover:opacity-80"
                  style={{ color: TELEGRAM_COLORS.destructive }}
                  title="Clear All Messages (Admin)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}

            {/* Online count */}
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: TELEGRAM_COLORS.online }}
              ></div>
              <span className="text-sm" style={{ color: TELEGRAM_COLORS.hint }}>
                {onlineUsers.length} online
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Better Toggle UI - Prominent buttons */}
      <div
        className="px-6 py-3 flex gap-3"
        style={{ borderBottom: `1px solid ${TELEGRAM_COLORS.border}` }}
      >
        <button
          onClick={() => setViewMode("channels")}
          className="flex-1 px-6 py-3 rounded-lg font-medium transition-all"
          style={{
            backgroundColor: viewMode === "channels" ? TELEGRAM_COLORS.primary : TELEGRAM_COLORS.secondaryBg,
            color: viewMode === "channels" ? "#fff" : TELEGRAM_COLORS.text,
          }}
        >
          🌐 Community & Channels
        </button>
        <button
          onClick={() => setViewMode("dms")}
          className="flex-1 px-6 py-3 rounded-lg font-medium transition-all relative"
          style={{
            backgroundColor: viewMode === "dms" ? TELEGRAM_COLORS.primary : TELEGRAM_COLORS.secondaryBg,
            color: viewMode === "dms" ? "#fff" : TELEGRAM_COLORS.text,
          }}
        >
          💬 Direct Messages
          {conversations.reduce((sum, c) => sum + c.unreadCount, 0) > 0 && (
            <span
              className="absolute top-2 right-2 w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold"
              style={{ backgroundColor: TELEGRAM_COLORS.destructive, color: "#fff" }}
            >
              {conversations.reduce((sum, c) => sum + c.unreadCount, 0)}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className="w-64 flex flex-col"
          style={{
            backgroundColor: TELEGRAM_COLORS.secondaryBg,
            borderRight: `1px solid ${TELEGRAM_COLORS.border}`,
          }}
        >

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto">
            {viewMode === "channels" ? (
              <div className="p-3">
                {/* Channel List */}
                <div className="flex items-center justify-between mb-3">
                  <h3
                    className="text-xs font-semibold uppercase"
                    style={{ color: TELEGRAM_COLORS.hint }}
                  >
                    Channels
                  </h3>
                  <button
                    onClick={() => setShowChannelModal(true)}
                    className="p-1 transition-colors hover:opacity-80"
                    style={{ color: TELEGRAM_COLORS.hint }}
                    title="Create channel"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-1">
                  {/* Global chat (no channel) */}
                  <button
                    onClick={() => setSelectedChannelId(null)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left"
                    style={{
                      backgroundColor: selectedChannelId === null ? TELEGRAM_COLORS.selection : "transparent",
                      color: selectedChannelId === null ? TELEGRAM_COLORS.text : TELEGRAM_COLORS.hint,
                    }}
                  >
                    <span>🌐</span>
                    <span className="flex-1 truncate">Global</span>
                  </button>

                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannelId(channel.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left"
                      style={{
                        backgroundColor: selectedChannelId === channel.id ? TELEGRAM_COLORS.selection : "transparent",
                        color: selectedChannelId === channel.id ? TELEGRAM_COLORS.text : TELEGRAM_COLORS.hint,
                      }}
                    >
                      <span>{channel.icon || "#"}</span>
                      <span className="flex-1 truncate">{channel.name}</span>
                      {channel.unreadCount > 0 && (
                        <span
                          className="w-5 h-5 rounded-full text-xs flex items-center justify-center"
                          style={{ backgroundColor: TELEGRAM_COLORS.primary, color: "#fff" }}
                        >
                          {channel.unreadCount > 9 ? "9+" : channel.unreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Online Users */}
                <h3
                  className="text-xs font-semibold uppercase mt-6 mb-3"
                  style={{ color: TELEGRAM_COLORS.hint }}
                >
                  Online ({onlineUsers.length})
                </h3>
                <div className="space-y-1">
                  {onlineUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        // Open user profile sidebar instead of DMs
                        setSelectedProfileUser({
                          id: user.userId,
                          name: user.userName,
                          image: user.userAvatar,
                          lastSeen: user.lastSeen,
                        });
                        setShowUserProfile(true);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left hover:opacity-80"
                      style={{ backgroundColor: "transparent" }}
                    >
                      <div className="relative">
                        {user.userAvatar ? (
                          <img
                            src={user.userAvatar}
                            alt=""
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                            style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg, color: TELEGRAM_COLORS.text }}
                          >
                            {user.userName[0]?.toUpperCase()}
                          </div>
                        )}
                        <div
                          className="absolute bottom-0 right-0 w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: TELEGRAM_COLORS.online,
                            border: `1px solid ${TELEGRAM_COLORS.secondaryBg}`,
                          }}
                        ></div>
                      </div>
                      <span
                        className="text-sm truncate flex-1"
                        style={{ color: TELEGRAM_COLORS.text }}
                      >
                        {user.userName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3">
                <h3
                  className="text-xs font-semibold uppercase mb-3"
                  style={{ color: TELEGRAM_COLORS.hint }}
                >
                  Conversations
                </h3>
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.partnerId}
                      onClick={() => setSelectedDM(conv.partnerId)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors text-left"
                      style={{
                        backgroundColor: selectedDM === conv.partnerId ? TELEGRAM_COLORS.selection : "transparent",
                      }}
                    >
                      {conv.partnerAvatar ? (
                        <img
                          src={conv.partnerAvatar}
                          alt=""
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm"
                          style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg, color: TELEGRAM_COLORS.text }}
                        >
                          {conv.partnerName[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className="text-sm font-medium truncate"
                            style={{ color: TELEGRAM_COLORS.text }}
                          >
                            {conv.partnerName}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: TELEGRAM_COLORS.hint }}
                          >
                            {formatTime(conv.lastMessage.createdAt)}
                          </span>
                        </div>
                        <p
                          className="text-xs truncate"
                          style={{ color: TELEGRAM_COLORS.hint }}
                        >
                          {conv.lastMessage.isFromMe && "You: "}
                          {conv.lastMessage.content}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span
                          className="w-5 h-5 flex items-center justify-center rounded-full text-xs"
                          style={{ backgroundColor: TELEGRAM_COLORS.primary, color: "#fff" }}
                        >
                          {conv.unreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                  {conversations.length === 0 && (
                    <p
                      className="text-sm text-center py-4"
                      style={{ color: TELEGRAM_COLORS.hint }}
                    >
                      No conversations yet
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Chat Area - with grid for messages + online users */}
        <div
          className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr,250px]"
          style={{ backgroundColor: TELEGRAM_COLORS.bgColor }}
        >
          {/* Messages Section */}
          <div className="flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-3">
                <div
                  className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: TELEGRAM_COLORS.primary, borderTopColor: "transparent" }}
                />
                <span style={{ color: TELEGRAM_COLORS.hint }}>Loading chat...</span>
              </div>
            </div>
          ) : viewMode === "channels" ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 chat-doodle-bg">
                {groupedMessages.map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center justify-center my-4">
                      <span
                        className="text-xs px-3 py-1 rounded-full"
                        style={{
                          backgroundColor: TELEGRAM_COLORS.secondaryBg,
                          color: TELEGRAM_COLORS.hint,
                        }}
                      >
                        {group.date}
                      </span>
                    </div>

                    {/* Messages for this date */}
                    <div className="space-y-2">
                      {group.messages.map((message) => {
                        const isOwn = message.userId === session.user?.id;
                        return (
                          <div
                            key={message.id}
                            className={`group flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
                          >
                            {/* Avatar - only show for others, clickable */}
                            {!isOwn && (
                              <button
                                onClick={() => {
                                  setSelectedProfileUser({
                                    id: message.userId,
                                    name: message.userName,
                                    image: message.userAvatar,
                                  });
                                  setShowUserProfile(true);
                                }}
                                className="flex-shrink-0 mt-auto cursor-pointer hover:opacity-80"
                              >
                                {message.userAvatar ? (
                                  <img
                                    src={message.userAvatar}
                                    alt=""
                                    className="w-8 h-8 rounded-full"
                                  />
                                ) : (
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs"
                                    style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg, color: TELEGRAM_COLORS.text }}
                                  >
                                    {message.userName[0]?.toUpperCase()}
                                  </div>
                                )}
                              </button>
                            )}

                            {/* Message Content */}
                            <div
                              className={`flex flex-col max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}
                            >
                              {/* Reply Reference */}
                              {message.replyTo && (
                                <div
                                  className="text-xs mb-1 px-2 py-1 rounded"
                                  style={{
                                    backgroundColor: isOwn ? "rgba(255,255,255,0.1)" : TELEGRAM_COLORS.secondaryBg,
                                    borderLeft: `2px solid ${TELEGRAM_COLORS.primary}`,
                                    color: TELEGRAM_COLORS.hint,
                                  }}
                                >
                                  <span style={{ color: TELEGRAM_COLORS.accent }}>{message.replyTo.userName}</span>
                                  <p className="truncate">{message.replyTo.content.slice(0, 50)}</p>
                                </div>
                              )}

                              {/* Message Bubble with Telegram style */}
                              <div className="relative">
                                <div
                                  className="px-3 py-2 relative"
                                  style={{
                                    backgroundColor: isOwn ? TELEGRAM_COLORS.outgoingBubble : TELEGRAM_COLORS.incomingBubble,
                                    color: TELEGRAM_COLORS.text,
                                    borderRadius: isOwn ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                                    minWidth: "60px",
                                  }}
                                >
                                  {/* Header - show name for others, clickable */}
                                  {!isOwn && (
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <button
                                        onClick={() => {
                                          setSelectedProfileUser({
                                            id: message.userId,
                                            name: message.userName,
                                            image: message.userAvatar,
                                          });
                                          setShowUserProfile(true);
                                        }}
                                        className="text-sm font-medium hover:underline cursor-pointer"
                                        style={{ color: TELEGRAM_COLORS.accent }}
                                      >
                                        {message.userName}
                                      </button>
                                      {message.isVip && (
                                        <span
                                          className="text-xs px-1.5 py-0.5 rounded"
                                          style={{ backgroundColor: "rgba(255, 193, 7, 0.2)", color: "#ffc107" }}
                                        >
                                          VIP
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Message Text */}
                                  <div className="break-words whitespace-pre-wrap">
                                    {renderMessageContent(message.content)}
                                  </div>

                                  {/* Time and status */}
                                  <div
                                    className="flex items-center gap-1 justify-end mt-1"
                                    style={{ color: isOwn ? "rgba(255,255,255,0.6)" : TELEGRAM_COLORS.hint }}
                                  >
                                    {message.edited && (
                                      <span className="text-xs">edited</span>
                                    )}
                                    <span className="text-xs">{formatTime(message.createdAt)}</span>
                                    {isOwn && (
                                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 2.354 7.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z"/>
                                        <path d="M6.354 11.354a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 .708-.708L6 10.293l6.646-6.647a.5.5 0 0 1 .708.708l-7 7z"/>
                                      </svg>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Reactions */}
                              {message.reactions.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {message.reactions.map((reaction) => (
                                    <button
                                      key={reaction.emoji}
                                      onClick={() => toggleReaction(message.id, reaction.emoji)}
                                      className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 transition-transform hover:scale-110"
                                      style={{
                                        backgroundColor: reaction.userReacted
                                          ? `${TELEGRAM_COLORS.primary}40`
                                          : TELEGRAM_COLORS.secondaryBg,
                                        border: reaction.userReacted
                                          ? `1px solid ${TELEGRAM_COLORS.primary}`
                                          : `1px solid ${TELEGRAM_COLORS.border}`,
                                        color: TELEGRAM_COLORS.text,
                                      }}
                                    >
                                      <span>{reaction.emoji}</span>
                                      <span>{reaction.count}</span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Actions */}
                              <div
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1"
                                style={{ color: TELEGRAM_COLORS.hint }}
                              >
                                <button
                                  onClick={() => setReplyingTo(message)}
                                  className="p-1 hover:opacity-80 transition-opacity"
                                  title="Reply"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                  </svg>
                                </button>
                                <div className="relative">
                                  <button
                                    onClick={() =>
                                      setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)
                                    }
                                    className="p-1 hover:opacity-80 transition-opacity"
                                    title="React"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </button>
                                  {showEmojiPicker === message.id && (
                                    <div
                                      className="absolute bottom-full left-0 mb-1 rounded-lg p-2 flex gap-1 shadow-xl z-10"
                                      style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
                                    >
                                      {EMOJI_OPTIONS.map((emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={() => toggleReaction(message.id, emoji)}
                                          className="hover:scale-125 transition-transform p-1"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {isOwn && (
                                  <>
                                    <button
                                      onClick={() => startEdit(message)}
                                      className="p-1 hover:opacity-80 transition-opacity"
                                      title="Edit"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => deleteMessage(message.id)}
                                      className="p-1 transition-opacity"
                                      style={{ color: TELEGRAM_COLORS.destructive }}
                                      title="Delete"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div
                    className="flex items-center justify-center h-full"
                    style={{ color: TELEGRAM_COLORS.hint }}
                  >
                    No messages yet. Start the conversation!
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <TypingIndicator users={typingUsers} />
              )}

              {/* Input Area */}
              <div
                className="p-4"
                style={{
                  backgroundColor: TELEGRAM_COLORS.headerBg,
                  borderTop: `1px solid ${TELEGRAM_COLORS.border}`,
                }}
              >
                {/* Reply indicator */}
                {replyingTo && (
                  <div
                    className="flex items-center justify-between mb-2 px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: TELEGRAM_COLORS.secondaryBg,
                      borderLeft: `2px solid ${TELEGRAM_COLORS.primary}`,
                    }}
                  >
                    <div className="text-sm">
                      <span style={{ color: TELEGRAM_COLORS.hint }}>Replying to </span>
                      <span style={{ color: TELEGRAM_COLORS.accent }}>{replyingTo.userName}</span>
                      <p style={{ color: TELEGRAM_COLORS.hint }} className="truncate">{replyingTo.content.slice(0, 50)}</p>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="hover:opacity-80"
                      style={{ color: TELEGRAM_COLORS.hint }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Edit indicator */}
                {editingMessage && (
                  <div
                    className="flex items-center justify-between mb-2 px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: "rgba(255, 193, 7, 0.1)",
                      borderLeft: "2px solid #ffc107",
                    }}
                  >
                    <div className="text-sm">
                      <span style={{ color: "#ffc107" }} className="font-medium">Editing message</span>
                    </div>
                    <button
                      onClick={cancelEdit}
                      className="hover:opacity-80"
                      style={{ color: TELEGRAM_COLORS.hint }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* @mention dropdown */}
                {showMentions && mentionUsers.length > 0 && (
                  <div
                    className="mb-2 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                    style={{
                      backgroundColor: TELEGRAM_COLORS.secondaryBg,
                      border: `1px solid ${TELEGRAM_COLORS.border}`,
                    }}
                  >
                    {mentionUsers.map((user, i) => (
                      <button
                        key={user.id}
                        onClick={() => insertMention(user)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left"
                        style={{
                          backgroundColor: i === mentionIndex ? `${TELEGRAM_COLORS.primary}30` : "transparent",
                          color: TELEGRAM_COLORS.text,
                        }}
                      >
                        {user.image ? (
                          <img src={user.image} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                            style={{ backgroundColor: TELEGRAM_COLORS.bgColor, color: TELEGRAM_COLORS.text }}
                          >
                            {(user.name || user.email)[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm">{user.name || user.email}</span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: user.status === "online" ? TELEGRAM_COLORS.online : TELEGRAM_COLORS.hint,
                          }}
                        ></span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Emoji Picker */}
                <EmojiPicker
                  isOpen={showInputEmoji}
                  onClose={() => setShowInputEmoji(false)}
                  onEmojiSelect={(emoji) => {
                    setInputValue((prev) => prev + emoji);
                    inputRef.current?.focus();
                  }}
                  onGifSelect={(gifUrl) => {
                    // Send GIF as message
                    setInputValue(`[GIF](${gifUrl})`);
                    inputRef.current?.focus();
                  }}
                />

                {/* File Upload Attachments Preview */}
                {uploadedAttachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {uploadedAttachments.map((att: any, idx) => (
                      <div
                        key={idx}
                        className="relative px-3 py-2 rounded-lg flex items-center gap-2"
                        style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
                      >
                        <span className="text-sm" style={{ color: TELEGRAM_COLORS.text }}>
                          📎 Attachment
                        </span>
                        <button
                          onClick={() => setUploadedAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="hover:opacity-80"
                          style={{ color: TELEGRAM_COLORS.hint }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 relative">
                  {/* File upload button */}
                  <div className="relative">
                    <FileUpload
                      channelId={selectedChannelId}
                      onUploadComplete={(attachment) => {
                        setUploadedAttachments(prev => [...prev, { id: attachment.id }]);
                      }}
                      maxFiles={5}
                    />
                  </div>

                  {/* Emoji button */}
                  <button
                    onClick={() => setShowInputEmoji(!showInputEmoji)}
                    className="p-3 rounded-full transition-colors hover:opacity-80"
                    style={{ color: TELEGRAM_COLORS.hint }}
                    title="Emoji"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-6c.78 2.34 2.72 4 5 4s4.22-1.66 5-4H7zm8-4c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm-6 0c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1z"/>
                    </svg>
                  </button>

                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={editingMessage ? "Edit your message..." : "Type a message... (@ to mention)"}
                    rows={1}
                    className="flex-1 px-4 py-3 rounded-2xl resize-none max-h-32 focus:outline-none"
                    style={{
                      backgroundColor: TELEGRAM_COLORS.inputBg,
                      border: `1px solid ${TELEGRAM_COLORS.border}`,
                      color: TELEGRAM_COLORS.text,
                      minHeight: "48px",
                    }}
                  />

                  {/* Voice recorder or Send button */}
                  {!inputValue.trim() && !editingMessage ? (
                    <VoiceRecorder
                      onSend={sendVoiceMessage}
                      onCancel={() => {
                        // Voice recording cancelled
                      }}
                    />
                  ) : (
                    <button
                      onClick={editingMessage ? saveEdit : sendMessage}
                      disabled={!inputValue.trim() || isSending}
                      className="p-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: TELEGRAM_COLORS.primary,
                        color: TELEGRAM_COLORS.buttonText,
                      }}
                    >
                      {isSending ? (
                        <div
                          className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                          style={{ borderColor: "#fff", borderTopColor: "transparent" }}
                        />
                      ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : selectedDM ? (
            // DM View
            <>
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{
                  backgroundColor: TELEGRAM_COLORS.headerBg,
                  borderBottom: `1px solid ${TELEGRAM_COLORS.border}`,
                }}
              >
                <button
                  onClick={() => setSelectedDM(null)}
                  className="hover:opacity-80"
                  style={{ color: TELEGRAM_COLORS.hint }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {(() => {
                  const partner = conversations.find((c) => c.partnerId === selectedDM);
                  const user = onlineUsers.find((u) => u.userId === selectedDM);
                  const name = partner?.partnerName || user?.userName || "Unknown User";
                  const avatar = partner?.partnerAvatar || user?.userAvatar;
                  const isOnline = onlineUsers.some((u) => u.userId === selectedDM);

                  return (
                    <>
                      <div className="relative">
                        {avatar ? (
                          <img src={avatar} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm"
                            style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg, color: TELEGRAM_COLORS.text }}
                          >
                            {name[0]?.toUpperCase()}
                          </div>
                        )}
                        {isOnline && (
                          <div
                            className="absolute bottom-0 right-0 w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: TELEGRAM_COLORS.online,
                              border: `2px solid ${TELEGRAM_COLORS.headerBg}`,
                            }}
                          ></div>
                        )}
                      </div>
                      <div>
                        <span className="font-medium" style={{ color: TELEGRAM_COLORS.text }}>{name}</span>
                        <p
                          className="text-xs"
                          style={{ color: isOnline ? TELEGRAM_COLORS.online : TELEGRAM_COLORS.hint }}
                        >
                          {isOnline ? "online" : "offline"}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 chat-doodle-bg">
                {dmMessages.map((message) => {
                  const isOwn = message.senderId === session.user?.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
                    >
                      {!isOwn && (
                        message.sender.image ? (
                          <img
                            src={message.sender.image}
                            alt=""
                            className="w-8 h-8 rounded-full flex-shrink-0 mt-auto"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-auto"
                            style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg, color: TELEGRAM_COLORS.text }}
                          >
                            {message.sender.name?.[0]?.toUpperCase() || "?"}
                          </div>
                        )
                      )}
                      <div
                        className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}
                      >
                        <div
                          className="px-3 py-2"
                          style={{
                            backgroundColor: isOwn ? TELEGRAM_COLORS.outgoingBubble : TELEGRAM_COLORS.incomingBubble,
                            color: TELEGRAM_COLORS.text,
                            borderRadius: isOwn ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          }}
                        >
                          <div className="break-words whitespace-pre-wrap">{message.content}</div>
                          <div
                            className="flex items-center gap-1 justify-end mt-1"
                            style={{ color: isOwn ? "rgba(255,255,255,0.6)" : TELEGRAM_COLORS.hint }}
                          >
                            <span className="text-xs">{formatTime(message.createdAt)}</span>
                            {isOwn && (
                              <svg
                                className="w-4 h-4"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                style={{ color: message.read ? TELEGRAM_COLORS.primary : "currentColor" }}
                              >
                                <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 2.354 7.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z"/>
                                <path d="M6.354 11.354a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 .708-.708L6 10.293l6.646-6.647a.5.5 0 0 1 .708.708l-7 7z"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {dmMessages.length === 0 && (
                  <div
                    className="flex items-center justify-center h-full"
                    style={{ color: TELEGRAM_COLORS.hint }}
                  >
                    No messages yet. Say hi!
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div
                className="p-4"
                style={{
                  backgroundColor: TELEGRAM_COLORS.headerBg,
                  borderTop: `1px solid ${TELEGRAM_COLORS.border}`,
                }}
              >
                <div className="flex items-end gap-2 relative">
                  {/* Emoji button */}
                  <button
                    onClick={() => setShowInputEmoji(!showInputEmoji)}
                    className="p-3 rounded-full transition-colors hover:opacity-80"
                    style={{ color: TELEGRAM_COLORS.hint }}
                    title="Emoji"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-6c.78 2.34 2.72 4 5 4s4.22-1.66 5-4H7zm8-4c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm-6 0c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1z"/>
                    </svg>
                  </button>

                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendDM();
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 px-4 py-3 rounded-2xl resize-none max-h-32 focus:outline-none"
                    style={{
                      backgroundColor: TELEGRAM_COLORS.inputBg,
                      border: `1px solid ${TELEGRAM_COLORS.border}`,
                      color: TELEGRAM_COLORS.text,
                      minHeight: "48px",
                    }}
                  />

                  {/* Voice recorder or Send button */}
                  {!inputValue.trim() ? (
                    <VoiceRecorder
                      onSend={async (audioBlob, duration) => {
                        try {
                          // Upload voice file
                          const formData = new FormData();
                          formData.append("file", audioBlob, "voice-message.webm");

                          const uploadRes = await fetch("/api/chat/upload", {
                            method: "POST",
                            body: formData,
                          });
                          const uploadData = await uploadRes.json();

                          if (uploadData.success) {
                            // Send DM with voice attachment
                            await fetch("/api/chat/direct-messages", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                recipientId: selectedDM,
                                content: "[Voice message]",
                                voiceAttachmentId: uploadData.data.attachmentId,
                                voiceDuration: duration,
                              }),
                            });
                          }
                        } catch (error) {
                          console.error("Error sending voice DM:", error);
                          alert("Failed to send voice message. Please check microphone permissions.");
                        }
                      }}
                      onCancel={() => {
                        // Voice recording cancelled
                      }}
                    />
                  ) : (
                    <button
                      onClick={sendDM}
                      disabled={!inputValue.trim() || isSending}
                      className="p-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: TELEGRAM_COLORS.primary,
                        color: TELEGRAM_COLORS.buttonText,
                      }}
                    >
                      {isSending ? (
                        <div
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                        />
                      ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>

                {/* Emoji Picker for DMs */}
                <EmojiPicker
                  isOpen={showInputEmoji}
                  onClose={() => setShowInputEmoji(false)}
                  onEmojiSelect={(emoji) => {
                    setInputValue((prev) => prev + emoji);
                    inputRef.current?.focus();
                  }}
                  onGifSelect={(gifUrl) => {
                    setShowInputEmoji(false);
                  }}
                />
              </div>
            </>
          ) : (
            // No DM selected
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center" style={{ color: TELEGRAM_COLORS.hint }}>
                <svg
                  className="w-16 h-16 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: TELEGRAM_COLORS.secondaryBg }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p>Select a conversation or start a new one</p>
                <p className="text-sm mt-1">Click on an online user to start chatting</p>
              </div>
            </div>
          )}
          </div>

          {/* Online Users Sidebar */}
          <aside
            className="hidden lg:flex flex-col border-l"
            style={{
              backgroundColor: TELEGRAM_COLORS.secondaryBg,
              borderColor: TELEGRAM_COLORS.border,
            }}
          >
            <div
              className="p-4 font-semibold"
              style={{
                color: TELEGRAM_COLORS.text,
                borderBottom: `1px solid ${TELEGRAM_COLORS.border}`,
              }}
            >
              Online Users ({onlineUsers.length})
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {onlineUsers.length === 0 ? (
                <div className="text-center text-sm py-8" style={{ color: TELEGRAM_COLORS.hint }}>
                  No users online
                </div>
              ) : (
                onlineUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedProfileUser({
                        id: user.userId,
                        name: user.userName,
                        image: user.userAvatar,
                      });
                      setShowUserProfile(true);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:opacity-80 transition-opacity text-left"
                    style={{ backgroundColor: TELEGRAM_COLORS.bgColor }}
                  >
                    <div className="relative flex-shrink-0">
                      {user.userAvatar ? (
                        <img src={user.userAvatar} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                          style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg, color: TELEGRAM_COLORS.text }}
                        >
                          {user.userName[0]?.toUpperCase()}
                        </div>
                      )}
                      <div
                        className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
                        style={{
                          backgroundColor: TELEGRAM_COLORS.online,
                          borderColor: TELEGRAM_COLORS.secondaryBg,
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: TELEGRAM_COLORS.text }}>
                          {user.userName}
                        </span>
                        {user.isVip && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ backgroundColor: "rgba(255, 193, 7, 0.2)", color: "#ffc107" }}
                          >
                            VIP
                          </span>
                        )}
                      </div>
                      <span className="text-xs" style={{ color: TELEGRAM_COLORS.hint }}>
                        {user.status === "online" ? "Online" : getLastSeenText(user.lastSeen)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center pt-20 z-50">
          <div
            className="w-full max-w-2xl rounded-lg shadow-xl"
            style={{
              backgroundColor: TELEGRAM_COLORS.secondaryBg,
              border: `1px solid ${TELEGRAM_COLORS.border}`,
            }}
          >
            <div
              className="p-4 flex items-center gap-3"
              style={{ borderBottom: `1px solid ${TELEGRAM_COLORS.border}` }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: TELEGRAM_COLORS.hint }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchMessages()}
                placeholder="Search messages..."
                className="flex-1 bg-transparent focus:outline-none"
                style={{ color: TELEGRAM_COLORS.text }}
                autoFocus
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="hover:opacity-80"
                style={{ color: TELEGRAM_COLORS.hint }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center" style={{ color: TELEGRAM_COLORS.hint }}>
                  {searchQuery ? "No results found" : "Type to search messages"}
                </div>
              ) : (
                searchResults.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 cursor-pointer hover:opacity-80"
                    style={{ borderBottom: `1px solid ${TELEGRAM_COLORS.border}50` }}
                    onClick={() => {
                      setShowSearch(false);
                      setSearchQuery("");
                      setSearchResults([]);
                      if (msg.channelId) {
                        setSelectedChannelId(msg.channelId);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm" style={{ color: TELEGRAM_COLORS.text }}>{msg.userName}</span>
                      <span className="text-xs" style={{ color: TELEGRAM_COLORS.hint }}>{formatTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-sm" style={{ color: TELEGRAM_COLORS.text }}>{msg.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showChannelModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div
            className="w-full max-w-md rounded-lg shadow-xl"
            style={{
              backgroundColor: TELEGRAM_COLORS.secondaryBg,
              border: `1px solid ${TELEGRAM_COLORS.border}`,
            }}
          >
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${TELEGRAM_COLORS.border}` }}
            >
              <h2 className="font-semibold" style={{ color: TELEGRAM_COLORS.text }}>Create Channel</h2>
              <button
                onClick={() => setShowChannelModal(false)}
                className="hover:opacity-80"
                style={{ color: TELEGRAM_COLORS.hint }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: TELEGRAM_COLORS.hint }}>Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {CHANNEL_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setNewChannelIcon(icon)}
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-colors"
                      style={{
                        backgroundColor: newChannelIcon === icon ? `${TELEGRAM_COLORS.primary}30` : TELEGRAM_COLORS.bgColor,
                        border: newChannelIcon === icon ? `1px solid ${TELEGRAM_COLORS.primary}` : `1px solid ${TELEGRAM_COLORS.border}`,
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm mb-2" style={{ color: TELEGRAM_COLORS.hint }}>Channel Name</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="general"
                  className="w-full px-3 py-2 rounded-lg focus:outline-none"
                  style={{
                    backgroundColor: TELEGRAM_COLORS.inputBg,
                    border: `1px solid ${TELEGRAM_COLORS.border}`,
                    color: TELEGRAM_COLORS.text,
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-2" style={{ color: TELEGRAM_COLORS.hint }}>Description (optional)</label>
                <textarea
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  placeholder="What's this channel about?"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg resize-none focus:outline-none"
                  style={{
                    backgroundColor: TELEGRAM_COLORS.inputBg,
                    border: `1px solid ${TELEGRAM_COLORS.border}`,
                    color: TELEGRAM_COLORS.text,
                  }}
                />
              </div>
            </div>
            <div
              className="p-4 flex justify-end gap-2"
              style={{ borderTop: `1px solid ${TELEGRAM_COLORS.border}` }}
            >
              <button
                onClick={() => setShowChannelModal(false)}
                className="px-4 py-2 transition-colors hover:opacity-80"
                style={{ color: TELEGRAM_COLORS.hint }}
              >
                Cancel
              </button>
              <button
                onClick={createChannel}
                disabled={!newChannelName.trim()}
                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: TELEGRAM_COLORS.primary,
                  color: TELEGRAM_COLORS.buttonText,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Sidebar */}
      <UserProfileSidebar
        isOpen={showUserProfile && selectedProfileUser !== null}
        onClose={() => {
          setShowUserProfile(false);
          setSelectedProfileUser(null);
        }}
        user={selectedProfileUser ? {
          id: selectedProfileUser.id,
          name: selectedProfileUser.name,
          image: selectedProfileUser.image,
          email: selectedProfileUser.email || "",
          bio: selectedProfileUser.bio,
          lastSeen: selectedProfileUser.lastSeen,
        } : null}
        currentUserId={session?.user?.id || ""}
        onMessage={() => {
          if (selectedProfileUser) {
            setShowUserProfile(false);
            setSelectedProfileUser(null);
            setViewMode("dms");
            setSelectedDM(selectedProfileUser.id);
          }
        }}
        onAddFriend={() => {
          if (selectedProfileUser) {
            setSendRequestUserId(selectedProfileUser.id);
            setShowSendRequestModal(true);
          }
        }}
      />

      {/* Admin Panel */}
      <AdminPanel
        isOpen={showAdminPanel && isAdmin}
        onClose={() => setShowAdminPanel(false)}
        channels={channels}
        onCreateChannel={async (data) => {
          const res = await fetch("/api/chat/channels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const result = await res.json();
          if (result.success) {
            setChannels((prev) => [...prev, { ...result.data, unreadCount: 0, isMember: true, role: "admin", muted: false }]);
          }
        }}
        onDeleteChannel={async (channelId) => {
          const res = await fetch(`/api/chat/channels?channelId=${channelId}`, {
            method: "DELETE",
          });
          const result = await res.json();
          if (result.success) {
            setChannels((prev) => prev.filter((c) => c.id !== channelId));
            if (selectedChannelId === channelId) {
              setSelectedChannelId(null);
            }
          } else {
            throw new Error(result.error || "Failed to delete channel");
          }
        }}
        onEditChannel={async (channelId, data) => {
          const res = await fetch("/api/chat/channels", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId, ...data }),
          });
          const result = await res.json();
          if (result.success) {
            setChannels((prev) => prev.map((c) => c.id === channelId ? { ...c, ...data } : c));
          }
        }}
      />

      {/* Friend Requests Modal */}
      {showFriendRequests && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div
            className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-lg"
            style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
          >
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${TELEGRAM_COLORS.border}` }}
            >
              <h2 className="font-semibold" style={{ color: TELEGRAM_COLORS.text }}>Friend Requests</h2>
              <button
                onClick={() => setShowFriendRequests(false)}
                style={{ color: TELEGRAM_COLORS.hint }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <FriendRequestsList
              requests={[]}
              onAccept={async (requestId) => {
                await fetch("/api/chat/friends", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ requestId, action: "accept" }),
                });
                fetchConversations();
              }}
              onDecline={async (requestId) => {
                await fetch("/api/chat/friends", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ requestId, action: "decline" }),
                });
              }}
              onBlock={async (userId) => {
                await fetch("/api/chat/friends", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ requestId: userId, action: "block" }),
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Send Friend Request Modal */}
      <SendRequestModal
        isOpen={showSendRequestModal}
        onClose={() => {
          setShowSendRequestModal(false);
          setSendRequestUserId(null);
        }}
        targetUser={sendRequestUserId && selectedProfileUser?.id === sendRequestUserId ? {
          id: selectedProfileUser.id,
          name: selectedProfileUser.name,
          email: selectedProfileUser.email || "",
          image: selectedProfileUser.image,
        } : sendRequestUserId ? {
          id: sendRequestUserId,
          name: null,
          email: "",
          image: null,
        } : null}
        onSend={async (userId, message) => {
          const res = await fetch("/api/chat/friends", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ receiverId: userId, message }),
          });
          const result = await res.json();
          if (result.success) {
            alert(result.message || "Friend request sent!");
          } else {
            alert(result.error || "Failed to send friend request");
          }
          setShowSendRequestModal(false);
          setSendRequestUserId(null);
        }}
      />

      {/* Image Viewer Modal */}
      {viewerImageUrl && (
        <ImageViewer
          imageUrl={viewerImageUrl}
          onClose={() => setViewerImageUrl(null)}
        />
      )}
    </main>
  );
}
