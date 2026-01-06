"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  imageUrl: string | null;
  isVip: boolean;
  reactions: Record<string, string[]> | null;
  replyToId: string | null;
  replyTo: {
    id: string;
    userName: string;
    content: string;
  } | null;
  createdAt: string;
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

type Tab = "public" | "dms";

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🚀", "💯"];

export default function ChatPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("public");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [selectedDM, setSelectedDM] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch public messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/messages");
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, []);

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

  // Fetch DM messages for selected conversation
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

  // Update presence (heartbeat)
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

  // Initial load and SSE connection
  useEffect(() => {
    if (!session?.user) return;

    let eventSource: EventSource | null = null;

    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchMessages(), fetchOnlineUsers(), fetchConversations()]);
      await updatePresence();
      setIsLoading(false);

      // Connect to SSE stream
      eventSource = new EventSource("/api/chat/stream");

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "new_message":
              setMessages((prev) => {
                // Avoid duplicates
                if (prev.some((m) => m.id === data.message.id)) return prev;
                return [...prev, data.message];
              });
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

            case "new_dm":
              // Add to DM messages if we're viewing that conversation
              if (data.message.senderId === selectedDM) {
                setDmMessages((prev) => {
                  if (prev.some((m) => m.id === data.message.id)) return prev;
                  return [...prev, data.message];
                });
              }
              // Update conversations list
              fetchConversations();
              break;

            case "ping":
              // Keep-alive, ignore
              break;
          }
        } catch (e) {
          console.error("Error parsing SSE message:", e);
        }
      };

      eventSource.onerror = () => {
        console.log("SSE connection error, will retry...");
        eventSource?.close();
        // Reconnect after a delay
        setTimeout(() => {
          if (session?.user) {
            loadData();
          }
        }, 5000);
      };
    };

    loadData();

    // Fallback polling for presence updates (SSE handles messages)
    const presenceInterval = setInterval(() => {
      updatePresence();
    }, 30000);

    // Cleanup on unmount
    return () => {
      eventSource?.close();
      clearInterval(presenceInterval);
      // Mark as offline
      fetch("/api/chat/presence", { method: "DELETE" }).catch(() => {});
    };
  }, [session?.user, fetchMessages, fetchOnlineUsers, fetchConversations, updatePresence, selectedDM]);

  // Fetch DM messages when selected
  useEffect(() => {
    if (selectedDM) {
      fetchDMMessages(selectedDM);
      const interval = setInterval(() => fetchDMMessages(selectedDM), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedDM, fetchDMMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, dmMessages, scrollToBottom]);

  // Send public message
  const sendMessage = async () => {
    if (!inputValue.trim() || !session?.user) return;

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: inputValue,
          replyToId: replyingTo?.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, data.data]);
        setInputValue("");
        setReplyingTo(null);
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Send DM
  const sendDM = async () => {
    if (!inputValue.trim() || !session?.user || !selectedDM) return;

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
    }
  };

  // Add reaction
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!session?.user) return;

    const message = messages.find((m) => m.id === messageId);
    const reactions = message?.reactions || {};
    const hasReacted = reactions[emoji]?.includes(session.user.id || "");

    try {
      const res = await fetch("/api/chat/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          emoji,
          action: hasReacted ? "remove" : "add",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? data.data : m))
        );
      }
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

  // Start DM with user
  const startDMWithUser = (userId: string) => {
    setActiveTab("dms");
    setSelectedDM(userId);
  };

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
              href="/"
              className="font-semibold text-white hover:opacity-80 transition-opacity"
            >
              Systems Trader
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-500">Chat</span>
          </nav>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-400">
              {onlineUsers.length} online
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Online Users & DM Conversations */}
        <aside className="w-64 border-r border-gray-800 bg-gray-900/30 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab("public")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "public"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Public Chat
            </button>
            <button
              onClick={() => setActiveTab("dms")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === "dms"
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

          {/* Content based on tab */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "public" ? (
              // Online Users
              <div className="p-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                  Online Users ({onlineUsers.length})
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
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm">
                            {user.userName[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-900"></div>
                      </div>
                      <span className="text-sm truncate flex-1">
                        {user.userName}
                      </span>
                      {user.isVip && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">
                          VIP
                        </span>
                      )}
                    </button>
                  ))}
                  {onlineUsers.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No users online
                    </p>
                  )}
                </div>
              </div>
            ) : (
              // DM Conversations
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
          ) : activeTab === "public" ? (
            // Public Chat Messages
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`group flex gap-3 ${
                      message.userId === session.user?.id
                        ? "flex-row-reverse"
                        : ""
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
                        message.userId === session.user?.id
                          ? "items-end"
                          : "items-start"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {message.userName}
                        </span>
                        {message.isVip && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">
                            VIP
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatTime(message.createdAt)}
                        </span>
                      </div>

                      {/* Reply Reference */}
                      {message.replyTo && (
                        <div className="text-xs text-gray-400 mb-1 px-2 py-1 bg-gray-800/50 rounded border-l-2 border-gray-600">
                          <span className="font-medium">
                            {message.replyTo.userName}:
                          </span>{" "}
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
                        {message.content}
                      </div>

                      {/* Image */}
                      {message.imageUrl && (
                        <img
                          src={message.imageUrl}
                          alt=""
                          className="mt-2 max-w-xs rounded-lg"
                        />
                      )}

                      {/* Reactions */}
                      {message.reactions &&
                        Object.keys(message.reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(message.reactions).map(
                              ([emoji, users]) => (
                                <button
                                  key={emoji}
                                  onClick={() =>
                                    toggleReaction(message.id, emoji)
                                  }
                                  className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                    (users as string[]).includes(
                                      session.user?.id || ""
                                    )
                                      ? "bg-blue-500/30 border border-blue-500"
                                      : "bg-gray-700/50 border border-gray-600"
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span>{(users as string[]).length}</span>
                                </button>
                              )
                            )}
                          </div>
                        )}

                      {/* Actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1">
                        <button
                          onClick={() => setReplyingTo(message)}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                          title="Reply"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                            />
                          </svg>
                        </button>
                        <div className="relative">
                          <button
                            onClick={() =>
                              setShowEmojiPicker(
                                showEmojiPicker === message.id
                                  ? null
                                  : message.id
                              )
                            }
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                            title="React"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </button>
                          {showEmojiPicker === message.id && (
                            <div className="absolute bottom-full left-0 mb-1 bg-gray-800 rounded-lg p-2 flex gap-1 shadow-xl z-10">
                              {EMOJI_OPTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() =>
                                    toggleReaction(message.id, emoji)
                                  }
                                  className="hover:scale-125 transition-transform p-1"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {message.userId === session.user?.id && (
                          <button
                            onClick={() => deleteMessage(message.id)}
                            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
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

              {/* Input Area */}
              <div className="border-t border-gray-800 p-4">
                {replyingTo && (
                  <div className="flex items-center justify-between mb-2 px-3 py-2 bg-gray-800/50 rounded-lg">
                    <div className="text-sm">
                      <span className="text-gray-400">Replying to </span>
                      <span className="text-white font-medium">
                        {replyingTo.userName}
                      </span>
                      <p className="text-gray-500 truncate">
                        {replyingTo.content.slice(0, 50)}
                      </p>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl
                             text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim()}
                    className="px-4 py-3 bg-blue-600 text-white rounded-xl font-medium
                             hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : selectedDM ? (
            // DM Conversation
            <>
              <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
                <button
                  onClick={() => setSelectedDM(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                {(() => {
                  const partner = conversations.find(
                    (c) => c.partnerId === selectedDM
                  );
                  const user = onlineUsers.find(
                    (u) => u.userId === selectedDM
                  );
                  const name =
                    partner?.partnerName ||
                    user?.userName ||
                    "Unknown User";
                  const avatar =
                    partner?.partnerAvatar || user?.userAvatar;

                  return (
                    <>
                      {avatar ? (
                        <img
                          src={avatar}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm">
                          {name[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium">{name}</span>
                    </>
                  );
                })()}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {dmMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.senderId === session.user?.id
                        ? "flex-row-reverse"
                        : ""
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
                        message.senderId === session.user?.id
                          ? "items-end"
                          : "items-start"
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
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTime(message.createdAt)}
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
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendDM()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl
                             text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={sendDM}
                    disabled={!inputValue.trim()}
                    className="px-4 py-3 bg-blue-600 text-white rounded-xl font-medium
                             hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
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
                <p className="text-sm mt-1">
                  Click on an online user to start chatting
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
