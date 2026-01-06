"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { TELEGRAM_COLORS, EMOJI_CATEGORIES, ANIMATIONS } from "@/lib/telegram-theme";

// Common emoji data - simplified set for performance
const EMOJI_DATA: Record<string, string[]> = {
  smileys: ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "😮", "🤯", "😳", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖"],
  people: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄"],
  animals: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞", "🐜", "🪰", "🪲", "🪳", "🦟", "🦗", "🕷️", "🕸️", "🦂", "🐢", "🐍"],
  food: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟", "🍕"],
  activities: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂", "🏋️", "🤼", "🤸", "⛹️", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗", "🚵", "🚴", "🏆"],
  travel: ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🏍️", "🛵", "🚲", "🛴", "🛹", "🛼", "🚁", "🛶", "⛵", "🚤", "🛥️", "🛳️", "⛴️", "🚢", "✈️", "🛫", "🛬", "🪂", "💺", "🚀", "🛸", "🚁", "🛶", "⛵", "🚤", "🗽", "🗼", "🏰", "🏯", "🏟️", "🎡", "🎢", "🎠", "⛲", "⛱️", "🏖️", "🏝️", "🏜️"],
  objects: ["💡", "🔦", "🏮", "🪔", "📱", "💻", "🖥️", "🖨️", "⌨️", "🖱️", "🖲️", "💽", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🎚️", "🎛️", "🧭", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳", "📡", "🔋", "🔌", "💰", "💵", "💴", "💶", "💷", "💸", "💳", "🧾", "💹"],
  symbols: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓", "🆔", "⚛️", "✅", "❌", "❓", "❕", "‼️", "⁉️"],
  flags: ["🏳️", "🏴", "🏁", "🚩", "🏳️‍🌈", "🏳️‍⚧️", "🇺🇳", "🇺🇸", "🇬🇧", "🇨🇦", "🇦🇺", "🇩🇪", "🇫🇷", "🇮🇹", "🇪🇸", "🇯🇵", "🇰🇷", "🇨🇳", "🇷🇺", "🇧🇷", "🇮🇳", "🇲🇽", "🇳🇱", "🇸🇪", "🇳🇴", "🇩🇰", "🇫🇮", "🇵🇱", "🇺🇦", "🇹🇷", "🇪🇬", "🇿🇦", "🇳🇬", "🇰🇪", "🇦🇷", "🇨🇴", "🇻🇪", "🇨🇱", "🇵🇪", "🇮🇩", "🇹🇭", "🇻🇳", "🇵🇭", "🇲🇾", "🇸🇬", "🇳🇿", "🇮🇪", "🇨🇭", "🇦🇹", "🇧🇪"],
};

// GIF categories
const GIF_CATEGORIES = [
  { keyword: "trending", label: "Trending" },
  { keyword: "happy", label: "Happy" },
  { keyword: "sad", label: "Sad" },
  { keyword: "love", label: "Love" },
  { keyword: "angry", label: "Angry" },
  { keyword: "dance", label: "Dance" },
  { keyword: "yes", label: "Yes" },
  { keyword: "no", label: "No" },
];

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  onGifSelect?: (gifUrl: string) => void;
  onStickerSelect?: (stickerUrl: string) => void;
  recentEmojis?: string[];
}

type TabType = "emoji" | "stickers" | "gifs";

export function EmojiPicker({
  isOpen,
  onClose,
  onEmojiSelect,
  onGifSelect,
  onStickerSelect,
  recentEmojis = [],
}: EmojiPickerProps) {
  const [activeTab, setActiveTab] = useState<TabType>("emoji");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("smileys");
  const [gifs, setGifs] = useState<Array<{ url: string; preview: string }>>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedCategory("smileys");
    }
  }, [isOpen]);

  // Filter emojis based on search
  const filteredEmojis = useMemo(() => {
    if (!searchQuery) return EMOJI_DATA[selectedCategory] || [];

    const query = searchQuery.toLowerCase();
    const results: string[] = [];

    // Simple search - just check if category name contains query
    Object.entries(EMOJI_DATA).forEach(([category, emojis]) => {
      if (category.includes(query)) {
        results.push(...emojis.slice(0, 10));
      }
    });

    // If no category match, return first few emojis from each category
    if (results.length === 0) {
      Object.values(EMOJI_DATA).forEach((emojis) => {
        results.push(...emojis.slice(0, 5));
      });
    }

    return results.slice(0, 50);
  }, [searchQuery, selectedCategory]);

  // Fetch GIFs (mock for now - would integrate with Giphy/Tenor)
  const fetchGifs = useCallback(async (query: string) => {
    setIsLoadingGifs(true);
    // Mock GIF data - in production, integrate with Giphy/Tenor API
    setTimeout(() => {
      setGifs([
        { url: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyO/giphy.gif", preview: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyO/200w.gif" },
        { url: "https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif", preview: "https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/200w.gif" },
        { url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", preview: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif" },
      ]);
      setIsLoadingGifs(false);
    }, 500);
  }, []);

  useEffect(() => {
    if (activeTab === "gifs") {
      fetchGifs("trending");
    }
  }, [activeTab, fetchGifs]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 w-80 rounded-lg shadow-xl overflow-hidden z-50"
      style={{
        backgroundColor: TELEGRAM_COLORS.secondaryBg,
        border: `1px solid ${TELEGRAM_COLORS.border}`,
        animation: `slideUp ${ANIMATIONS.slideUp}ms ease-out`,
      }}
    >
      {/* Tabs */}
      <div
        className="flex border-b"
        style={{ borderColor: TELEGRAM_COLORS.border }}
      >
        {(["emoji", "stickers", "gifs"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors capitalize"
            style={{
              color: activeTab === tab ? TELEGRAM_COLORS.primary : TELEGRAM_COLORS.hint,
              borderBottom: activeTab === tab ? `2px solid ${TELEGRAM_COLORS.primary}` : "none",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="p-2">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ backgroundColor: TELEGRAM_COLORS.inputBg }}
        >
          <svg
            className="w-4 h-4"
            style={{ color: TELEGRAM_COLORS.hint }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === "emoji"
                ? "Search emoji..."
                : activeTab === "gifs"
                ? "Search GIFs..."
                : "Search stickers..."
            }
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: TELEGRAM_COLORS.text }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="h-64 overflow-y-auto">
        {activeTab === "emoji" && (
          <>
            {/* Category icons */}
            {!searchQuery && (
              <div
                className="flex gap-1 px-2 py-1 sticky top-0 z-10"
                style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
              >
                {EMOJI_CATEGORIES.filter((c) => c.id !== "recent").map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className="p-1.5 rounded transition-colors text-lg"
                    style={{
                      backgroundColor:
                        selectedCategory === category.id
                          ? TELEGRAM_COLORS.reactionBgSelected
                          : "transparent",
                    }}
                    title={category.label}
                  >
                    {category.icon}
                  </button>
                ))}
              </div>
            )}

            {/* Recent emojis */}
            {recentEmojis.length > 0 && !searchQuery && (
              <div className="px-2 py-1">
                <div
                  className="text-xs font-medium mb-1"
                  style={{ color: TELEGRAM_COLORS.hint }}
                >
                  Recently Used
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {recentEmojis.slice(0, 30).map((emoji, i) => (
                    <button
                      key={`recent-${i}`}
                      onClick={() => onEmojiSelect(emoji)}
                      className="w-8 h-8 flex items-center justify-center text-xl hover:bg-white/10 rounded transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Emoji grid */}
            <div className="px-2 py-1">
              {!searchQuery && (
                <div
                  className="text-xs font-medium mb-1 capitalize"
                  style={{ color: TELEGRAM_COLORS.hint }}
                >
                  {selectedCategory}
                </div>
              )}
              <div className="flex flex-wrap gap-0.5">
                {filteredEmojis.map((emoji, i) => (
                  <button
                    key={`${emoji}-${i}`}
                    onClick={() => onEmojiSelect(emoji)}
                    onMouseEnter={() => setHoveredEmoji(emoji)}
                    onMouseLeave={() => setHoveredEmoji(null)}
                    className="w-8 h-8 flex items-center justify-center rounded transition-all"
                    style={{
                      fontSize: hoveredEmoji === emoji ? "28px" : "20px",
                      backgroundColor: hoveredEmoji === emoji ? "rgba(255,255,255,0.1)" : "transparent",
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "stickers" && (
          <div className="p-4 text-center" style={{ color: TELEGRAM_COLORS.hint }}>
            <svg
              className="w-12 h-12 mx-auto mb-2 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">Stickers coming soon</p>
          </div>
        )}

        {activeTab === "gifs" && (
          <>
            {/* GIF categories */}
            <div
              className="flex gap-1 px-2 py-1 overflow-x-auto sticky top-0 z-10"
              style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
            >
              {GIF_CATEGORIES.map((category) => (
                <button
                  key={category.keyword}
                  onClick={() => fetchGifs(category.keyword)}
                  className="px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: TELEGRAM_COLORS.reactionBg,
                    color: TELEGRAM_COLORS.text,
                  }}
                >
                  {category.label}
                </button>
              ))}
            </div>

            {/* GIF grid */}
            <div className="p-2 grid grid-cols-2 gap-1">
              {isLoadingGifs ? (
                <div
                  className="col-span-2 py-8 text-center"
                  style={{ color: TELEGRAM_COLORS.hint }}
                >
                  <div
                    className="w-6 h-6 mx-auto mb-2 border-2 rounded-full animate-spin"
                    style={{
                      borderColor: TELEGRAM_COLORS.primary,
                      borderTopColor: "transparent",
                    }}
                  />
                  Loading GIFs...
                </div>
              ) : (
                gifs.map((gif, i) => (
                  <button
                    key={i}
                    onClick={() => onGifSelect?.(gif.url)}
                    className="aspect-video rounded overflow-hidden hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: TELEGRAM_COLORS.bgColor }}
                  >
                    <img
                      src={gif.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Hovered emoji preview */}
      {hoveredEmoji && (
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 p-2 rounded-lg shadow-xl"
          style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
        >
          <span className="text-4xl">{hoveredEmoji}</span>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
