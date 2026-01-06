"use client";

import { useState, useCallback } from "react";

interface VoteButtonsProps {
  itemType: "comment" | "correction";
  itemId: string;
  sessionId: string;
  upvotes: number;
  downvotes: number;
  score: number;
  userVote: number | null;
  vertical?: boolean;
  size?: "sm" | "md";
  onVoteChange?: (newScore: number, newUserVote: number | null) => void;
}

export function VoteButtons({
  itemType,
  itemId,
  sessionId,
  upvotes,
  downvotes,
  score,
  userVote,
  vertical = true,
  size = "sm",
  onVoteChange,
}: VoteButtonsProps) {
  const [currentVote, setCurrentVote] = useState(userVote);
  const [currentScore, setCurrentScore] = useState(score);
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = useCallback(
    async (value: 1 | -1) => {
      if (isVoting) return;

      // Determine new vote value
      const newValue = currentVote === value ? 0 : value;

      // Optimistic update
      const oldVote = currentVote;
      const oldScore = currentScore;

      // Calculate new score
      let newScore = oldScore;
      if (oldVote === 1) newScore -= 1;
      if (oldVote === -1) newScore += 1;
      if (newValue === 1) newScore += 1;
      if (newValue === -1) newScore -= 1;

      setCurrentVote(newValue === 0 ? null : newValue);
      setCurrentScore(newScore);
      onVoteChange?.(newScore, newValue === 0 ? null : newValue);

      setIsVoting(true);
      try {
        const endpoint =
          itemType === "comment"
            ? `/api/sessions/${sessionId}/comments/${itemId}/vote`
            : `/api/sessions/${sessionId}/corrections/${itemId}/vote`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: newValue }),
        });

        const data = await response.json();

        if (!data.success) {
          // Rollback on error
          setCurrentVote(oldVote);
          setCurrentScore(oldScore);
          onVoteChange?.(oldScore, oldVote);
          console.error("Vote failed:", data.error);
        } else {
          // Use server values for consistency
          setCurrentScore(data.data.score);
          setCurrentVote(data.data.userVote);
          onVoteChange?.(data.data.score, data.data.userVote);
        }
      } catch (error) {
        // Rollback on error
        setCurrentVote(oldVote);
        setCurrentScore(oldScore);
        onVoteChange?.(oldScore, oldVote);
        console.error("Vote error:", error);
      } finally {
        setIsVoting(false);
      }
    },
    [itemType, itemId, sessionId, currentVote, currentScore, isVoting, onVoteChange]
  );

  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const buttonPadding = size === "sm" ? "p-1" : "p-1.5";
  const fontSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div
      className={`flex ${vertical ? "flex-col" : "flex-row"} items-center gap-0.5`}
    >
      {/* Upvote button */}
      <button
        onClick={() => handleVote(1)}
        disabled={isVoting}
        className={`${buttonPadding} rounded transition-colors ${
          currentVote === 1
            ? "text-orange-500 hover:text-orange-400"
            : "text-gray-500 hover:text-orange-400"
        } disabled:opacity-50`}
        title="Upvote"
      >
        <svg
          className={iconSize}
          fill={currentVote === 1 ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 15l7-7 7 7"
          />
        </svg>
      </button>

      {/* Score */}
      <span
        className={`${fontSize} font-medium min-w-[2ch] text-center ${
          currentScore > 0
            ? "text-orange-400"
            : currentScore < 0
            ? "text-blue-400"
            : "text-gray-400"
        }`}
      >
        {currentScore}
      </span>

      {/* Downvote button */}
      <button
        onClick={() => handleVote(-1)}
        disabled={isVoting}
        className={`${buttonPadding} rounded transition-colors ${
          currentVote === -1
            ? "text-blue-500 hover:text-blue-400"
            : "text-gray-500 hover:text-blue-400"
        } disabled:opacity-50`}
        title="Downvote"
      >
        <svg
          className={iconSize}
          fill={currentVote === -1 ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    </div>
  );
}
