"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface User {
  id: string;
  name: string | null;
  username: string | null;
  email?: string;
  image: string | null;
}

interface MentionAutocompleteProps {
  query: string;
  sessionId?: string;
  position: { top: number; left: number };
  onSelect: (user: User) => void;
  onClose: () => void;
}

export function MentionAutocomplete({
  query,
  sessionId,
  position,
  onSelect,
  onClose,
}: MentionAutocompleteProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search for users
  useEffect(() => {
    if (!query) {
      setUsers([]);
      return;
    }

    const searchUsers = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ q: query });
        if (sessionId) params.set("sessionId", sessionId);

        const response = await fetch(`/api/users/search?${params}`);
        const data = await response.json();

        if (data.success) {
          setUsers(data.data);
          setSelectedIndex(0);
        }
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search
    const timeout = setTimeout(searchUsers, 200);
    return () => clearTimeout(timeout);
  }, [query, sessionId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, users.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          if (users[selectedIndex]) {
            onSelect(users[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [users, selectedIndex, onSelect, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = containerRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    selectedElement?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!query && users.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        minWidth: "200px",
        maxWidth: "300px",
        maxHeight: "200px",
      }}
    >
      {isLoading ? (
        <div className="px-3 py-2 text-sm text-gray-400">Searching...</div>
      ) : users.length === 0 ? (
        <div className="px-3 py-2 text-sm text-gray-400">No users found</div>
      ) : (
        <div className="overflow-y-auto max-h-[200px]">
          {users.map((user, index) => (
            <button
              key={user.id}
              data-index={index}
              onClick={() => onSelect(user)}
              className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors ${
                index === selectedIndex
                  ? "bg-blue-600"
                  : "hover:bg-gray-700"
              }`}
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="w-6 h-6 rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-600 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-200 truncate">
                  {user.name || "Anonymous"}
                </div>
                {user.username && (
                  <div className="text-xs text-gray-400 truncate">
                    @{user.username}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper hook to manage mention state in a text input
export function useMentions(sessionId?: string) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);

  const handleInputChange = useCallback(
    (
      value: string,
      selectionStart: number,
      inputElement: HTMLTextAreaElement | HTMLInputElement
    ) => {
      // Find if we're in a mention (@ followed by non-space chars)
      const textBeforeCursor = value.slice(0, selectionStart);
      const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

      if (mentionMatch) {
        setMentionQuery(mentionMatch[1]);
        setMentionStartIndex(selectionStart - mentionMatch[0].length);

        // Calculate position for autocomplete dropdown
        const rect = inputElement.getBoundingClientRect();
        const lineHeight = parseInt(getComputedStyle(inputElement).lineHeight) || 20;

        // Estimate cursor position (simplified - assumes single line for now)
        setMentionPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      } else {
        setMentionQuery(null);
        setMentionStartIndex(-1);
      }
    },
    []
  );

  const insertMention = useCallback(
    (
      user: { id: string; name: string | null; username: string | null },
      currentValue: string,
      setValueCallback: (value: string) => void
    ): number => {
      // Replace @query with @[Name](userId) format
      const displayName = user.username || user.name || "User";
      const mention = `@[${displayName}](${user.id}) `;

      const before = currentValue.slice(0, mentionStartIndex);
      const after = currentValue.slice(
        mentionStartIndex + (mentionQuery?.length || 0) + 1 // +1 for @
      );

      const newValue = before + mention + after;
      setValueCallback(newValue);

      // Return new cursor position
      const newCursorPos = before.length + mention.length;
      setMentionQuery(null);
      setMentionStartIndex(-1);

      return newCursorPos;
    },
    [mentionQuery, mentionStartIndex]
  );

  const closeMentions = useCallback(() => {
    setMentionQuery(null);
    setMentionStartIndex(-1);
  }, []);

  return {
    mentionQuery,
    mentionPosition,
    handleInputChange,
    insertMention,
    closeMentions,
    isMentioning: mentionQuery !== null,
  };
}

// Parse mentions from content for display
export function parseMentionsForDisplay(content: string): React.ReactNode[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    // Add mention as styled span
    const [, displayName, userId] = match;
    parts.push(
      <span
        key={match.index}
        className="text-blue-400 hover:underline cursor-pointer"
        data-user-id={userId}
      >
        @{displayName}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
}

// Extract mention user IDs from content
export function extractMentionIds(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const ids: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    ids.push(match[2]);
  }

  return ids;
}
