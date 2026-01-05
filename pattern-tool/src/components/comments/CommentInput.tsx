"use client";

import { useState } from "react";

interface CommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  showCancel?: boolean;
}

export function CommentInput({
  onSubmit,
  placeholder = "Add a comment...",
  autoFocus = false,
  onCancel,
  showCancel = false,
}: CommentInputProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent("");
    } catch (err) {
      console.error("Error submitting comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === "Escape" && onCancel) {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                 text-white text-sm placeholder-gray-500 focus:outline-none
                 focus:border-blue-500 resize-none"
        rows={2}
        disabled={isSubmitting}
      />
      <div className="flex items-center justify-end gap-2">
        {showCancel && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!content.trim() || isSubmitting}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg
                   hover:bg-blue-700 transition-colors disabled:opacity-50
                   flex items-center gap-1"
        >
          {isSubmitting ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending...
            </>
          ) : (
            "Comment"
          )}
        </button>
      </div>
    </form>
  );
}
