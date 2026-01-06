// Telegram Dark Theme - Exact Color Values
// These colors are extracted from Telegram's official dark theme

export const TELEGRAM_COLORS = {
  // Primary/Accent
  primary: "#0088CC",           // Lochmara - main interactive elements
  primaryGradient: "#229ED9",   // Gradient accent
  accent: "#6ab2f2",            // Accent text color

  // Backgrounds
  bgColor: "#17212b",           // Main background
  secondaryBg: "#232e3c",       // Secondary background (input fields, cards)
  sectionBg: "#17212b",         // Section background
  headerBg: "#17212b",          // Header background

  // Buttons
  button: "#5288c1",            // Button background
  buttonText: "#ffffff",        // Button text
  buttonHover: "#4a7ab3",       // Button hover state

  // Text
  text: "#f5f5f5",              // Primary text
  textSecondary: "#aaaaaa",     // Secondary text
  hint: "#708499",              // Hint/subtitle text
  link: "#6ab3f3",              // Link color

  // Status
  online: "#4DCA4D",            // Online indicator green
  destructive: "#ec3942",       // Error/delete red
  warning: "#f5a623",           // Warning orange

  // Message Bubbles
  outgoingBubble: "#2b5278",    // Outgoing message background
  outgoingBubbleGradient: "#1e3a52", // Gradient for outgoing
  incomingBubble: "#182533",    // Incoming message background

  // Borders & Dividers
  border: "#2b3e50",            // Border color
  divider: "#1c2836",           // Divider lines

  // Input
  inputBg: "#242f3d",           // Input field background
  inputBorder: "#3a4a5c",       // Input border
  inputFocus: "#5288c1",        // Input focus border

  // Reactions
  reactionBg: "#2b3e50",        // Reaction button background
  reactionBgSelected: "#3a5068", // Selected reaction

  // Selection
  selection: "#2b5278",         // Selected item background
  hover: "#1e2c3a",             // Hover state background

  // Scrollbar
  scrollbar: "#3a4a5c",
  scrollbarHover: "#4a5a6c",
} as const;

// Message bubble styles
export const BUBBLE_STYLES = {
  // Border radius for message bubbles (Telegram uses slightly asymmetric)
  borderRadius: {
    default: "18px",
    tail: "4px",        // Corner with tail
    grouped: "8px",     // Grouped messages
  },

  // Spacing
  spacing: {
    betweenMessages: "2px",      // Same sender consecutive
    betweenGroups: "8px",        // Different sender
    bubblePadding: "8px 12px",   // Inside bubble
  },

  // Tail SVG paths for bubble tails
  tailPaths: {
    outgoing: "M 0,0 Q 0,10 10,10 L 0,10 Z",
    incoming: "M 10,0 Q 10,10 0,10 L 10,10 Z",
  },
} as const;

// Read receipt states
export const READ_RECEIPT_STATES = {
  sending: "clock",      // Clock icon while sending
  sent: "check",         // Single gray checkmark
  delivered: "check-check", // Double gray checkmarks
  read: "check-check-blue", // Double blue checkmarks
} as const;

// Online status labels
export const ONLINE_STATUS_LABELS = {
  online: "online",
  recentlyOnline: "last seen recently",           // 1 sec - 3 days
  withinWeek: "last seen within a week",          // 3-7 days
  withinMonth: "last seen within a month",        // 7-30 days
  longTimeAgo: "last seen a long time ago",       // 30+ days
} as const;

// Get last seen text based on timestamp
export function getLastSeenText(lastSeen: Date | string | null): string {
  if (!lastSeen) return ONLINE_STATUS_LABELS.longTimeAgo;

  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Within 2 minutes = online
  if (diffMs < 2 * 60 * 1000) {
    return ONLINE_STATUS_LABELS.online;
  }

  // Within 3 days
  if (diffDays < 3) {
    // Show exact time for today
    if (date.toDateString() === now.toDateString()) {
      return `last seen today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `last seen yesterday at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return ONLINE_STATUS_LABELS.recentlyOnline;
  }

  // Within a week
  if (diffDays < 7) {
    return ONLINE_STATUS_LABELS.withinWeek;
  }

  // Within a month
  if (diffDays < 30) {
    return ONLINE_STATUS_LABELS.withinMonth;
  }

  return ONLINE_STATUS_LABELS.longTimeAgo;
}

// Typing indicator animation timing
export const TYPING_ANIMATION = {
  dotDelay: 200,        // ms between each dot animation
  timeout: 5000,        // ms before clearing typing indicator
} as const;

// Emoji categories for picker
export const EMOJI_CATEGORIES = [
  { id: "recent", label: "Recent", icon: "🕐" },
  { id: "smileys", label: "Smileys & Emotion", icon: "😀" },
  { id: "people", label: "People & Body", icon: "👋" },
  { id: "animals", label: "Animals & Nature", icon: "🐶" },
  { id: "food", label: "Food & Drink", icon: "🍔" },
  { id: "activities", label: "Activities", icon: "⚽" },
  { id: "travel", label: "Travel & Places", icon: "🚗" },
  { id: "objects", label: "Objects", icon: "💡" },
  { id: "symbols", label: "Symbols", icon: "❤️" },
  { id: "flags", label: "Flags", icon: "🏳️" },
] as const;

// Default reactions (Telegram style)
export const DEFAULT_REACTIONS = [
  { emoji: "👍", label: "Like" },
  { emoji: "❤️", label: "Love" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "😢", label: "Sad" },
  { emoji: "😱", label: "Shocked" },
  { emoji: "🤔", label: "Thinking" },
  { emoji: "👎", label: "Dislike" },
] as const;

// Animation durations
export const ANIMATIONS = {
  springConfig: {
    tension: 300,
    friction: 20,
  },
  slideUp: 300,       // Emoji picker slide up
  fadeIn: 150,        // Quick fade in
  reaction: 400,      // Reaction animation
  messageSend: 200,   // Message send animation
} as const;

// Voice message settings
export const VOICE_MESSAGE = {
  slideToCancel: 100,    // px to slide left to cancel
  slideToLock: 80,       // px to slide up to lock
  maxDuration: 60 * 60,  // 1 hour max
  playbackSpeeds: [1, 1.5, 2],
  waveformBars: 50,      // Number of bars in waveform
} as const;
