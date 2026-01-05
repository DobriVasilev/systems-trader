// ============================================================================
// PATTERN TOOL DESIGN SYSTEM
// Linear.app / Dobri Lab inspired - Glass morphism
// ============================================================================

export const COLORS = {
  // Backgrounds - near black like Linear
  bg0: '#0F0F10',
  bg1: '#151516',
  bg2: '#1C1C1E',
  bg3: '#222326',

  // Text - white to grays
  textPrimary: '#EEEFF1',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',

  // Accent - emerald green (for bullish/positive)
  accent: '#10B981',
  accentHover: '#059669',
  accentGlow: 'rgba(16, 185, 129, 0.3)',
  accentSubtle: 'rgba(16, 185, 129, 0.1)',

  // Secondary accent - cyan (for info)
  cyan: '#06b6d4',
  cyanGlow: 'rgba(6, 182, 212, 0.3)',

  // Warning/bearish - red
  red: '#ef4444',
  redGlow: 'rgba(239, 68, 68, 0.3)',
  redSubtle: 'rgba(239, 68, 68, 0.1)',

  // Pending/neutral - yellow
  yellow: '#f59e0b',
  yellowGlow: 'rgba(245, 158, 11, 0.3)',

  // Purple for special actions
  purple: '#8b5cf6',
  purpleGlow: 'rgba(139, 92, 246, 0.3)',

  // Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(255, 255, 255, 0.15)',
  borderAccent: 'rgba(16, 185, 129, 0.3)',
} as const;

// ============================================================================
// GLASS MORPHISM PRESETS
// ============================================================================

export const GLASS = {
  // Card backgrounds
  card: {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(20px)',
    border: `1px solid ${COLORS.border}`,
    boxShadow: `
      0 0 0 1px rgba(255, 255, 255, 0.03),
      0 25px 60px -15px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.05)
    `,
  },

  // Modal/overlay backgrounds
  modal: {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(20px)',
    border: `1px solid ${COLORS.border}`,
    boxShadow: `
      0 25px 50px -12px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.1)
    `,
  },

  // Button presets
  button: {
    primary: {
      background: `linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))`,
      border: `1px solid ${COLORS.borderAccent}`,
      boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)',
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.03)',
      border: `1px solid ${COLORS.border}`,
    },
    danger: {
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      boxShadow: '0 0 20px rgba(239, 68, 68, 0.1)',
    },
  },

  // Input fields
  input: {
    background: 'rgba(0, 0, 0, 0.3)',
    border: `1px solid ${COLORS.border}`,
    focusBorder: `1px solid ${COLORS.borderAccent}`,
  },
} as const;

// ============================================================================
// TAILWIND-COMPATIBLE CSS CLASSES
// ============================================================================

export const THEME_CLASSES = {
  // Glass card
  glassCard: `
    bg-white/[0.03] backdrop-blur-xl
    border border-white/[0.08]
    shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_25px_60px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]
    rounded-2xl
  `,

  // Glass button
  glassButton: `
    bg-gradient-to-br from-emerald-500/15 to-emerald-500/5
    border border-emerald-500/30
    shadow-[0_0_20px_rgba(16,185,129,0.1)]
    hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]
    hover:border-emerald-500/50
    transition-all duration-200
  `,

  // Glass input
  glassInput: `
    bg-black/30 border border-white/[0.08]
    focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20
    placeholder:text-gray-500
    transition-all duration-200
  `,
} as const;
