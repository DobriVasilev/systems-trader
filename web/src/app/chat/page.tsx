"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🚀", "💯"];
const CHANNEL_ICONS = ["💬", "📢", "🎯", "💡", "🔧", "📈", "🎨", "🌟"];

// Loading fallback for Suspense
function ChatLoadingFallback() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400">Loading chat...</span>
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
    if (!inputValue.trim() || !session?.user || isSending) return;

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
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Error sending message:", error);
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
      <main className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Sign in to access chat</h1>
          <Link
            href="/api/auth/signin"
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/dashboard"
              className="font-semibold text-white hover:opacity-80 transition-opacity"
            >
              Systems Trader
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-500">Chat</span>
            {selectedChannel && (
              <>
                <span className="text-gray-600">/</span>
                <span className="text-gray-400">
                  {selectedChannel.icon} {selectedChannel.name}
                </span>
              </>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {/* Search */}
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
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
                className="p-2 text-gray-400 hover:text-white transition-colors relative"
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </button>

              {/* Notifications dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-h-96 overflow-y-auto z-50">
                  <div className="p-3 border-b border-gray-700 font-medium">
                    Notifications
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 border-b border-gray-700/50 hover:bg-gray-700/50 cursor-pointer ${
                          !n.read ? "bg-blue-500/10" : ""
                        }`}
                        onClick={() => {
                          if (n.link) {
                            window.location.href = n.link;
                          }
                          setShowNotifications(false);
                        }}
                      >
                        <div className="font-medium text-sm">{n.title}</div>
                        <div className="text-xs text-gray-400 mt-1">{n.body}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatTime(n.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Online count */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-400">
                {onlineUsers.length} online
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-800 bg-gray-900/30 flex flex-col">
          {/* View Mode Tabs */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setViewMode("channels")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                viewMode === "channels"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Channels
            </button>
            <button
              onClick={() => setViewMode("dms")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                viewMode === "dms"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              DMs
              {conversations.reduce((sum, c) => sum + c.unreadCount, 0) > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto">
            {viewMode === "channels" ? (
              <div className="p-3">
                {/* Channel List */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase">
                    Channels
                  </h3>
                  <button
                    onClick={() => setShowChannelModal(true)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
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
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left ${
                      selectedChannelId === null
                        ? "bg-gray-800 text-white"
                        : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                    }`}
                  >
                    <span>🌐</span>
                    <span className="flex-1 truncate">Global</span>
                  </button>

                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannelId(channel.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left ${
                        selectedChannelId === channel.id
                          ? "bg-gray-800 text-white"
                          : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                      }`}
                    >
                      <span>{channel.icon || "#"}</span>
                      <span className="flex-1 truncate">{channel.name}</span>
                      {channel.unreadCount > 0 && (
                        <span className="w-5 h-5 bg-blue-500 rounded-full text-xs flex items-center justify-center text-white">
                          {channel.unreadCount > 9 ? "9+" : channel.unreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Online Users */}
                <h3 className="text-xs font-semibold text-gray-500 uppercase mt-6 mb-3">
                  Online ({onlineUsers.length})
                </h3>
                <div className="space-y-1">
                  {onlineUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => startDMWithUser(user.userId)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800/50 transition-colors text-left"
                    >
                      <div className="relative">
                        {user.userAvatar ? (
                          <img
                            src={user.userAvatar}
                            alt=""
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                            {user.userName[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-gray-900"></div>
                      </div>
                      <span className="text-sm truncate flex-1 text-gray-300">
                        {user.userName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                  Conversations
                </h3>
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.partnerId}
                      onClick={() => setSelectedDM(conv.partnerId)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors text-left ${
                        selectedDM === conv.partnerId
                          ? "bg-gray-800"
                          : "hover:bg-gray-800/50"
                      }`}
                    >
                      {conv.partnerAvatar ? (
                        <img
                          src={conv.partnerAvatar}
                          alt=""
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm">
                          {conv.partnerName[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">
                            {conv.partnerName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTime(conv.lastMessage.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {conv.lastMessage.isFromMe && "You: "}
                          {conv.lastMessage.content}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="w-5 h-5 flex items-center justify-center bg-blue-500 rounded-full text-xs">
                          {conv.unreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                  {conversations.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No conversations yet
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-400">Loading chat...</span>
              </div>
            </div>
          ) : viewMode === "channels" ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4">
                {groupedMessages.map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-4 my-4">
                      <div className="flex-1 h-px bg-gray-800"></div>
                      <span className="text-xs text-gray-500">{group.date}</span>
                      <div className="flex-1 h-px bg-gray-800"></div>
                    </div>

                    {/* Messages for this date */}
                    <div className="space-y-4">
                      {group.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`group flex gap-3 ${
                            message.userId === session.user?.id ? "flex-row-reverse" : ""
                          }`}
                        >
                          {/* Avatar */}
                          {message.userAvatar ? (
                            <img
                              src={message.userAvatar}
                              alt=""
                              className="w-10 h-10 rounded-full flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm flex-shrink-0">
                              {message.userName[0]?.toUpperCase()}
                            </div>
                          )}

                          {/* Message Content */}
                          <div
                            className={`flex flex-col max-w-[70%] ${
                              message.userId === session.user?.id ? "items-end" : "items-start"
                            }`}
                          >
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">{message.userName}</span>
                              {message.isVip && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">
                                  VIP
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {formatTime(message.createdAt)}
                              </span>
                              {message.edited && (
                                <span className="text-xs text-gray-500">(edited)</span>
                              )}
                            </div>

                            {/* Reply Reference */}
                            {message.replyTo && (
                              <div className="text-xs text-gray-400 mb-1 px-2 py-1 bg-gray-800/50 rounded border-l-2 border-gray-600">
                                <span className="font-medium">{message.replyTo.userName}:</span>{" "}
                                {message.replyTo.content.slice(0, 50)}
                                {message.replyTo.content.length > 50 && "..."}
                              </div>
                            )}

                            {/* Message Bubble */}
                            <div
                              className={`px-4 py-2 rounded-2xl ${
                                message.userId === session.user?.id
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-800 text-gray-100"
                              }`}
                            >
                              {renderMessageContent(message.content)}
                            </div>

                            {/* Reactions */}
                            {message.reactions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {message.reactions.map((reaction) => (
                                  <button
                                    key={reaction.emoji}
                                    onClick={() => toggleReaction(message.id, reaction.emoji)}
                                    className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                      reaction.userReacted
                                        ? "bg-blue-500/30 border border-blue-500"
                                        : "bg-gray-700/50 border border-gray-600"
                                    }`}
                                  >
                                    <span>{reaction.emoji}</span>
                                    <span>{reaction.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1">
                              <button
                                onClick={() => setReplyingTo(message)}
                                className="p-1 text-gray-400 hover:text-white transition-colors"
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
                                  className="p-1 text-gray-400 hover:text-white transition-colors"
                                  title="React"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                                {showEmojiPicker === message.id && (
                                  <div className="absolute bottom-full left-0 mb-1 bg-gray-800 rounded-lg p-2 flex gap-1 shadow-xl z-10">
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
                              {message.userId === session.user?.id && (
                                <>
                                  <button
                                    onClick={() => startEdit(message)}
                                    className="p-1 text-gray-400 hover:text-white transition-colors"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => deleteMessage(message.id)}
                                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
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
                      ))}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No messages yet. Start the conversation!
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="px-4 py-2 text-sm text-gray-400">
                  {typingUsers.map((u) => u.userName).join(", ")}{" "}
                  {typingUsers.length === 1 ? "is" : "are"} typing...
                </div>
              )}

              {/* Input Area */}
              <div className="border-t border-gray-800 p-4">
                {/* Reply indicator */}
                {replyingTo && (
                  <div className="flex items-center justify-between mb-2 px-3 py-2 bg-gray-800/50 rounded-lg">
                    <div className="text-sm">
                      <span className="text-gray-400">Replying to </span>
                      <span className="text-white font-medium">{replyingTo.userName}</span>
                      <p className="text-gray-500 truncate">{replyingTo.content.slice(0, 50)}</p>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Edit indicator */}
                {editingMessage && (
                  <div className="flex items-center justify-between mb-2 px-3 py-2 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <div className="text-sm">
                      <span className="text-yellow-500 font-medium">Editing message</span>
                    </div>
                    <button
                      onClick={cancelEdit}
                      className="text-gray-400 hover:text-white"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* @mention dropdown */}
                {showMentions && mentionUsers.length > 0 && (
                  <div className="mb-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-h-48 overflow-y-auto">
                    {mentionUsers.map((user, i) => (
                      <button
                        key={user.id}
                        onClick={() => insertMention(user)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left ${
                          i === mentionIndex ? "bg-blue-500/30" : "hover:bg-gray-700/50"
                        }`}
                      >
                        {user.image ? (
                          <img src={user.image} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs">
                            {(user.name || user.email)[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm">{user.name || user.email}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            user.status === "online" ? "bg-green-500" : "bg-gray-500"
                          }`}
                        ></span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={editingMessage ? "Edit your message..." : "Type a message... (@ to mention)"}
                    rows={1}
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl
                             text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                             resize-none max-h-32"
                    style={{ minHeight: "48px" }}
                  />
                  <button
                    onClick={editingMessage ? saveEdit : sendMessage}
                    disabled={!inputValue.trim() || isSending}
                    className="px-4 py-3 bg-blue-600 text-white rounded-xl font-medium
                             hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : selectedDM ? (
            // DM View
            <>
              <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <button
                  onClick={() => setSelectedDM(null)}
                  className="text-gray-400 hover:text-white"
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
                          <img src={avatar} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm">
                            {name[0]?.toUpperCase()}
                          </div>
                        )}
                        {isOnline && (
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-900"></div>
                        )}
                      </div>
                      <div>
                        <span className="font-medium">{name}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {dmMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.senderId === session.user?.id ? "flex-row-reverse" : ""
                    }`}
                  >
                    {message.sender.image ? (
                      <img
                        src={message.sender.image}
                        alt=""
                        className="w-8 h-8 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm flex-shrink-0">
                        {message.sender.name?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] ${
                        message.senderId === session.user?.id ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`px-4 py-2 rounded-2xl ${
                          message.senderId === session.user?.id
                            ? "bg-blue-600 text-white"
                            : "bg-gray-800 text-gray-100"
                        }`}
                      >
                        {message.content}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span>{formatTime(message.createdAt)}</span>
                        {message.senderId === session.user?.id && message.read && (
                          <span className="text-blue-400">Read</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {dmMessages.length === 0 && (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No messages yet. Say hi!
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-800 p-4">
                <div className="flex items-center gap-2">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendDM();
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl
                             text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                             resize-none"
                  />
                  <button
                    onClick={sendDM}
                    disabled={!inputValue.trim() || isSending}
                    className="px-4 py-3 bg-blue-600 text-white rounded-xl font-medium
                             hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            // No DM selected
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
      </div>

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50">
          <div className="w-full max-w-2xl bg-gray-900 rounded-lg shadow-xl border border-gray-800">
            <div className="p-4 border-b border-gray-800 flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchMessages()}
                placeholder="Search messages..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {searchQuery ? "No results found" : "Type to search messages"}
                </div>
              ) : (
                searchResults.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer"
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
                      <span className="font-medium text-sm">{msg.userName}</span>
                      <span className="text-xs text-gray-500">{formatTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-gray-300 text-sm">{msg.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showChannelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-gray-900 rounded-lg shadow-xl border border-gray-800">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold">Create Channel</h2>
              <button
                onClick={() => setShowChannelModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {CHANNEL_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setNewChannelIcon(icon)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                        newChannelIcon === icon
                          ? "bg-blue-500/30 border border-blue-500"
                          : "bg-gray-800 hover:bg-gray-700"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Channel Name</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="general"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                           text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Description (optional)</label>
                <textarea
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  placeholder="What's this channel about?"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                           text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => setShowChannelModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createChannel}
                disabled={!newChannelName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium
                         hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
