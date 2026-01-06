"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  MentionAutocomplete,
  useMentions,
  parseMentionsForDisplay,
} from "./MentionAutocomplete";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  sessionId?: string;
  minRows?: number;
  maxRows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  showToolbar?: boolean;
  showPreview?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  onSubmit,
  placeholder = "Write a comment...",
  sessionId,
  minRows = 3,
  maxRows = 10,
  disabled = false,
  autoFocus = false,
  showToolbar = true,
  showPreview = true,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPreview, setIsPreview] = useState(false);

  const {
    mentionQuery,
    mentionPosition,
    handleInputChange,
    insertMention,
    closeMentions,
    isMentioning,
  } = useMentions(sessionId);

  // Handle text change with mention detection
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      // Check for mentions
      if (textareaRef.current) {
        handleInputChange(
          newValue,
          e.target.selectionStart,
          textareaRef.current
        );
      }
    },
    [onChange, handleInputChange]
  );

  // Handle mention selection
  const handleMentionSelect = useCallback(
    (user: { id: string; name: string | null; username: string | null }) => {
      const newCursorPos = insertMention(user, value, onChange);

      // Restore focus and cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [value, onChange, insertMention]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Don't handle if mention autocomplete is open
      if (isMentioning) return;

      // Submit on Ctrl/Cmd + Enter
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        onSubmit?.();
        return;
      }

      // Format shortcuts
      if (e.ctrlKey || e.metaKey) {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const { selectionStart, selectionEnd } = textarea;
        const selectedText = value.slice(selectionStart, selectionEnd);

        let wrapper = "";
        switch (e.key) {
          case "b": // Bold
            wrapper = "**";
            break;
          case "i": // Italic
            wrapper = "*";
            break;
          case "k": // Link
            e.preventDefault();
            const url = prompt("Enter URL:");
            if (url) {
              const linkText = selectedText || "link text";
              const before = value.slice(0, selectionStart);
              const after = value.slice(selectionEnd);
              onChange(`${before}[${linkText}](${url})${after}`);
            }
            return;
          default:
            return;
        }

        if (wrapper) {
          e.preventDefault();
          const before = value.slice(0, selectionStart);
          const after = value.slice(selectionEnd);
          const newText = `${before}${wrapper}${selectedText}${wrapper}${after}`;
          onChange(newText);

          // Move cursor appropriately
          setTimeout(() => {
            if (textarea) {
              const newPos = selectedText
                ? selectionEnd + wrapper.length * 2
                : selectionStart + wrapper.length;
              textarea.setSelectionRange(newPos, newPos);
              textarea.focus();
            }
          }, 0);
        }
      }
    },
    [value, onChange, onSubmit, isMentioning]
  );

  // Insert formatting
  const insertFormatting = useCallback(
    (format: "bold" | "italic" | "code" | "quote" | "link" | "list") => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart, selectionEnd } = textarea;
      const selectedText = value.slice(selectionStart, selectionEnd);
      const before = value.slice(0, selectionStart);
      const after = value.slice(selectionEnd);

      let newText = "";
      let cursorOffset = 0;

      switch (format) {
        case "bold":
          newText = `${before}**${selectedText || "bold text"}**${after}`;
          cursorOffset = selectedText ? 4 : 2;
          break;
        case "italic":
          newText = `${before}*${selectedText || "italic text"}*${after}`;
          cursorOffset = selectedText ? 2 : 1;
          break;
        case "code":
          if (selectedText.includes("\n")) {
            newText = `${before}\n\`\`\`\n${selectedText}\n\`\`\`\n${after}`;
          } else {
            newText = `${before}\`${selectedText || "code"}\`${after}`;
          }
          cursorOffset = selectedText ? 2 : 1;
          break;
        case "quote":
          const lines = (selectedText || "quoted text").split("\n");
          const quotedLines = lines.map((l) => `> ${l}`).join("\n");
          newText = `${before}${quotedLines}${after}`;
          cursorOffset = 2;
          break;
        case "link":
          const url = prompt("Enter URL:");
          if (url) {
            newText = `${before}[${selectedText || "link text"}](${url})${after}`;
            cursorOffset = selectedText ? url.length + 4 : 1;
          } else {
            return;
          }
          break;
        case "list":
          const listLines = (selectedText || "item").split("\n");
          const listedLines = listLines.map((l) => `- ${l}`).join("\n");
          newText = `${before}${listedLines}${after}`;
          cursorOffset = 2;
          break;
      }

      onChange(newText);

      // Restore focus
      setTimeout(() => {
        textarea.focus();
        const newPos = selectionStart + cursorOffset + (selectedText?.length || 0);
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [value, onChange]
  );

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const minHeight = lineHeight * minRows;
    const maxHeight = lineHeight * maxRows;
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [value, minRows, maxRows]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="relative">
      {/* Toolbar */}
      {showToolbar && !isPreview && (
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 border-b-0 rounded-t-lg">
          <button
            type="button"
            onClick={() => insertFormatting("bold")}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="Bold (Ctrl+B)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("italic")}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="Italic (Ctrl+I)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4m-2 0v16m0 0h-4m4 0h4M7 4l5 16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("link")}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="Link (Ctrl+K)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
          <div className="w-px h-4 bg-gray-700 mx-1" />
          <button
            type="button"
            onClick={() => insertFormatting("code")}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="Code"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("quote")}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="Quote"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("list")}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="List"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          {showPreview && (
            <>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setIsPreview(!isPreview)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  isPreview
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                }`}
              >
                Preview
              </button>
            </>
          )}
        </div>
      )}

      {/* Editor or Preview */}
      {isPreview ? (
        <div
          className={`px-3 py-2 bg-gray-900 border border-gray-700 ${
            showToolbar ? "rounded-b-lg" : "rounded-lg"
          } min-h-[80px] text-sm text-gray-300 whitespace-pre-wrap`}
        >
          <MarkdownPreview content={value} />
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 bg-gray-900 border border-gray-700 ${
            showToolbar ? "rounded-b-lg" : "rounded-lg"
          } text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50`}
          style={{ minHeight: `${minRows * 20}px` }}
        />
      )}

      {/* Mention Autocomplete */}
      {isMentioning && mentionQuery !== null && (
        <MentionAutocomplete
          query={mentionQuery}
          sessionId={sessionId}
          position={mentionPosition}
          onSelect={handleMentionSelect}
          onClose={closeMentions}
        />
      )}

      {/* Keyboard hints */}
      <div className="text-xs text-gray-500 mt-1">
        <span>Ctrl+Enter to submit</span>
        <span className="mx-2">|</span>
        <span>@ to mention</span>
      </div>
    </div>
  );
}

// Simple markdown preview
function MarkdownPreview({ content }: { content: string }) {
  // Parse mentions first
  const withMentions = parseMentionsForDisplay(content);

  // For now, just render with basic formatting
  // A full implementation would use a markdown library
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      {typeof withMentions === "string" ? (
        <SimpleMarkdown text={withMentions} />
      ) : (
        withMentions.map((part, i) =>
          typeof part === "string" ? (
            <SimpleMarkdown key={i} text={part} />
          ) : (
            part
          )
        )
      )}
    </div>
  );
}

// Very basic markdown rendering (in production, use a proper library)
function SimpleMarkdown({ text }: { text: string }) {
  // Bold
  let parsed = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  parsed = parsed.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Inline code
  parsed = parsed.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 rounded">$1</code>');
  // Links
  parsed = parsed.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" class="text-blue-400 hover:underline" target="_blank" rel="noopener">$1</a>'
  );
  // Line breaks
  parsed = parsed.replace(/\n/g, "<br />");

  return <span dangerouslySetInnerHTML={{ __html: parsed }} />;
}
