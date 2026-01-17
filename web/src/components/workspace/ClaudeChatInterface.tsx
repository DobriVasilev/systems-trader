"use client";

import { useState, useEffect, useRef } from "react";
import { Bot, User, Send, Loader2, AlertCircle } from "lucide-react";

interface Message {
  id: string;
  type: string;
  authorType: "user" | "claude" | "system";
  title: string;
  content: string;
  createdAt: string;
  data?: any;
}

interface ClaudeChatInterfaceProps {
  workspaceId: string;
  executionId?: string;
  initialMessages?: Message[];
}

export function ClaudeChatInterface({
  workspaceId,
  executionId,
  initialMessages = [],
}: ClaudeChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for new messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(
          `/api/workspace/${workspaceId}/messages?executionId=${executionId || ""}`
        );
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      }
    };

    const interval = setInterval(fetchMessages, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [workspaceId, executionId]);

  async function handleSend() {
    if (!inputMessage.trim() || sending) return;

    const userMessage = inputMessage;
    setInputMessage("");
    setSending(true);
    setError(null);

    // Optimistically add user message to UI
    const tempUserMessage: Message = {
      id: `temp_${Date.now()}`,
      type: "chat_message",
      authorType: "user",
      title: "You",
      content: userMessage,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const res = await fetch("/api/claude/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          message: userMessage,
          executionId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Add Claude's response
        const claudeMessage: Message = {
          id: data.chatId,
          type: "chat_response",
          authorType: "claude",
          title: "Claude Code",
          content: data.response,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev.slice(0, -1), tempUserMessage, claudeMessage]);
      } else {
        setError(data.error || "Failed to get response from Claude");
        // Remove temp message on error
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      setError("Failed to send message");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center gap-3">
        <Bot className="w-5 h-5 text-blue-400" />
        <div>
          <h3 className="font-medium text-white">Chat with Claude Code</h3>
          <p className="text-sm text-gray-400">
            Ask questions or request changes
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm mt-1">
              Start a conversation with Claude Code
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${
              msg.authorType === "user" ? "flex-row-reverse" : ""
            }`}
          >
            {/* Avatar */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                msg.authorType === "claude"
                  ? "bg-blue-500/20 text-blue-400"
                  : msg.authorType === "user"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-gray-700 text-gray-400"
              }`}
            >
              {msg.authorType === "claude" ? (
                <Bot className="w-4 h-4" />
              ) : msg.authorType === "user" ? (
                <User className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
            </div>

            {/* Message */}
            <div
              className={`flex-1 ${msg.authorType === "user" ? "text-right" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-300">
                  {msg.title}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </span>
              </div>

              <div
                className={`inline-block max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.authorType === "claude"
                    ? "bg-gray-800 text-gray-100"
                    : msg.authorType === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {msg.type === "chat_error" ? (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">{msg.content}</div>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-gray-800 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Claude is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-red-400">Error</div>
            <div className="text-sm text-red-300">{error}</div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Claude to make changes, explain code, or answer questions..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!inputMessage.trim() || sending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send • Shift + Enter for new line
        </p>
      </div>
    </div>
  );
}
