/**
 * Pattern Tool Type Definitions
 */

// ============================================================================
// ENUMS
// ============================================================================

// All pattern types available in the system
export type PatternType =
  // Price Action Patterns
  | "swings"
  | "bos"
  | "msb"
  | "choch"
  | "range"
  | "false_breakout"
  | "liquidity_sweep"
  | "liquidity_grab"
  | "stop_hunt"
  // Support/Resistance
  | "support_resistance"
  | "pivot_points"
  | "psychological_levels"
  // Order Blocks
  | "order_block"
  | "breaker_block"
  | "mitigation_block"
  | "rejection_block"
  // Fair Value Gaps
  | "fvg"
  | "bisi"
  | "sibi"
  // Supply/Demand
  | "supply_zone"
  | "demand_zone"
  | "imbalance"
  // Fibonacci
  | "fibonacci_retracement"
  | "fibonacci_extension"
  | "fibonacci_time"
  // Trend Analysis
  | "trend_lines"
  | "channels"
  | "wedges"
  | "triangles"
  // Classic Patterns
  | "head_shoulders"
  | "double_top"
  | "double_bottom"
  | "triple_top"
  | "triple_bottom"
  | "cup_handle"
  | "flags"
  | "pennants"
  // Candlestick Patterns
  | "engulfing"
  | "doji"
  | "hammer"
  | "shooting_star"
  | "morning_star"
  | "evening_star"
  | "three_white_soldiers"
  | "three_black_crows"
  | "harami"
  | "piercing_line"
  | "dark_cloud_cover"
  // Volume Analysis
  | "volume_profile"
  | "volume_divergence"
  | "volume_climax"
  // Indicators
  | "ma_crossover"
  | "rsi_divergence"
  | "macd_signal"
  | "bollinger_bands"
  | "vwap";

// Timeframe now supports custom values
export type Timeframe = string;

// Standard timeframes - only native Hyperliquid intervals
export const STANDARD_TIMEFRAMES = [
  "1m", "5m", "15m", "30m",
  "1h", "4h",
  "1d", "1w", "1M"
] as const;

// ============================================================================
// PATTERN SETTINGS CONFIGURATION
// ============================================================================

export interface PatternSettingOption {
  value: string | number | boolean;
  label: string;
}

export interface PatternSetting {
  key: string;
  label: string;
  description?: string;
  type: "select" | "number" | "boolean" | "range";
  default: string | number | boolean;
  options?: PatternSettingOption[];
  min?: number;
  max?: number;
  step?: number;
}

export interface PatternConfig {
  value: PatternType;
  label: string;
  description: string;
  category: "price_action" | "support_resistance" | "order_flow" | "fvg" | "supply_demand" | "fibonacci" | "trend" | "classic" | "candlestick" | "volume" | "indicators";
  settings?: PatternSetting[];
  detectionTypes: string[];
  status?: "validated" | "in_review" | "beta" | "coming_soon"; // Implementation status
}

// Comprehensive pattern configurations with settings
export const PATTERN_CONFIGS: Record<PatternType, PatternConfig> = {
  // Price Action Patterns
  swings: {
    value: "swings",
    label: "Swing Points",
    description: "Detect swing highs and swing lows",
    category: "price_action",
    detectionTypes: ["swing_high", "swing_low"],
    status: "in_review",
    settings: [
      {
        key: "detection_mode",
        label: "Detection Mode",
        description: "Use wicks (high/low) or candle bodies (open/close)",
        type: "select",
        default: "wicks",
        options: [
          { value: "wicks", label: "Wicks (High/Low)" },
          { value: "closes", label: "Candle Bodies (Open/Close)" },
        ],
      },
    ],
  },
  bos: {
    value: "bos",
    label: "Break of Structure",
    description: "Detect bullish and bearish structure breaks",
    category: "price_action",
    detectionTypes: ["bos_bullish", "bos_bearish"],
    status: "beta",
    settings: [
      {
        key: "confirmation",
        label: "Confirmation Type",
        type: "select",
        default: "close",
        options: [
          { value: "close", label: "Candle Close" },
          { value: "wick", label: "Wick Touch" },
        ],
      },
      {
        key: "swing_lookback",
        label: "Swing Lookback",
        type: "number",
        default: 5,
        min: 3,
        max: 50,
      },
    ],
  },
  msb: {
    value: "msb",
    label: "Market Structure Break",
    description: "Identify market structure shifts",
    category: "price_action",
    detectionTypes: ["msb_bullish", "msb_bearish"],
    status: "beta",
    settings: [
      {
        key: "require_impulse",
        label: "Require Impulse Move",
        type: "boolean",
        default: true,
      },
      {
        key: "min_break_pct",
        label: "Min Break Size (%)",
        type: "number",
        default: 0.5,
        min: 0,
        max: 5,
        step: 0.1,
      },
    ],
  },
  choch: {
    value: "choch",
    label: "Change of Character",
    description: "Detect trend reversal signals",
    category: "price_action",
    detectionTypes: ["choch_bullish", "choch_bearish"],
    settings: [
      {
        key: "confirmation_candles",
        label: "Confirmation Candles",
        type: "number",
        default: 2,
        min: 1,
        max: 10,
      },
    ],
  },
  range: {
    value: "range",
    label: "Trading Range",
    description: "Identify consolidation ranges",
    category: "price_action",
    detectionTypes: ["range_high", "range_low", "range_mid"],
    settings: [
      {
        key: "min_touches",
        label: "Min Level Touches",
        type: "number",
        default: 2,
        min: 2,
        max: 10,
      },
      {
        key: "tolerance_pct",
        label: "Tolerance (%)",
        type: "number",
        default: 0.5,
        min: 0.1,
        max: 3,
        step: 0.1,
      },
    ],
  },
  false_breakout: {
    value: "false_breakout",
    label: "False Breakout",
    description: "Detect failed breakout attempts",
    category: "price_action",
    detectionTypes: ["false_breakout_high", "false_breakout_low"],
    settings: [
      {
        key: "min_break_candles",
        label: "Min Break Candles",
        type: "number",
        default: 1,
        min: 1,
        max: 5,
      },
      {
        key: "reclaim_candles",
        label: "Reclaim Window",
        type: "number",
        default: 3,
        min: 1,
        max: 10,
      },
    ],
  },
  liquidity_sweep: {
    value: "liquidity_sweep",
    label: "Liquidity Sweep",
    description: "Detect liquidity hunts at highs/lows",
    category: "price_action",
    detectionTypes: ["liquidity_sweep_high", "liquidity_sweep_low"],
    settings: [
      {
        key: "min_wick_ratio",
        label: "Min Wick Ratio",
        type: "number",
        default: 0.5,
        min: 0.1,
        max: 1,
        step: 0.1,
      },
    ],
  },
  liquidity_grab: {
    value: "liquidity_grab",
    label: "Liquidity Grab",
    description: "Aggressive liquidity taking moves",
    category: "price_action",
    detectionTypes: ["liquidity_grab_up", "liquidity_grab_down"],
    settings: [],
  },
  stop_hunt: {
    value: "stop_hunt",
    label: "Stop Hunt",
    description: "Identify stop loss hunting patterns",
    category: "price_action",
    detectionTypes: ["stop_hunt_above", "stop_hunt_below"],
    settings: [
      {
        key: "reversal_confirmation",
        label: "Reversal Confirmation",
        type: "boolean",
        default: true,
      },
    ],
  },

  // Support/Resistance
  support_resistance: {
    value: "support_resistance",
    label: "Support & Resistance",
    description: "Key support and resistance levels",
    category: "support_resistance",
    detectionTypes: ["support_level", "resistance_level"],
    settings: [
      {
        key: "method",
        label: "Detection Method",
        type: "select",
        default: "swing",
        options: [
          { value: "swing", label: "Swing Points" },
          { value: "volume", label: "Volume Profile" },
          { value: "cluster", label: "Price Clusters" },
        ],
      },
      {
        key: "min_touches",
        label: "Min Touches",
        type: "number",
        default: 2,
        min: 1,
        max: 10,
      },
    ],
  },
  pivot_points: {
    value: "pivot_points",
    label: "Pivot Points",
    description: "Classic pivot point levels",
    category: "support_resistance",
    detectionTypes: ["pivot", "r1", "r2", "r3", "s1", "s2", "s3"],
    settings: [
      {
        key: "type",
        label: "Pivot Type",
        type: "select",
        default: "standard",
        options: [
          { value: "standard", label: "Standard" },
          { value: "fibonacci", label: "Fibonacci" },
          { value: "camarilla", label: "Camarilla" },
          { value: "woodie", label: "Woodie" },
        ],
      },
    ],
  },
  psychological_levels: {
    value: "psychological_levels",
    label: "Psychological Levels",
    description: "Round number levels",
    category: "support_resistance",
    detectionTypes: ["psych_level"],
    settings: [
      {
        key: "round_to",
        label: "Round To",
        type: "select",
        default: "1000",
        options: [
          { value: "100", label: "100s" },
          { value: "500", label: "500s" },
          { value: "1000", label: "1000s" },
          { value: "5000", label: "5000s" },
          { value: "10000", label: "10000s" },
        ],
      },
    ],
  },

  // Order Blocks
  order_block: {
    value: "order_block",
    label: "Order Block",
    description: "Institutional order block zones",
    category: "order_flow",
    detectionTypes: ["order_block_bullish", "order_block_bearish"],
    settings: [
      {
        key: "require_fvg",
        label: "Require FVG",
        type: "boolean",
        default: false,
      },
      {
        key: "valid_until_mitigated",
        label: "Valid Until Mitigated",
        type: "boolean",
        default: true,
      },
    ],
  },
  breaker_block: {
    value: "breaker_block",
    label: "Breaker Block",
    description: "Failed order blocks that become support/resistance",
    category: "order_flow",
    detectionTypes: ["breaker_bullish", "breaker_bearish"],
    settings: [],
  },
  mitigation_block: {
    value: "mitigation_block",
    label: "Mitigation Block",
    description: "Zones where orders get filled",
    category: "order_flow",
    detectionTypes: ["mitigation_zone"],
    settings: [],
  },
  rejection_block: {
    value: "rejection_block",
    label: "Rejection Block",
    description: "Strong rejection zones",
    category: "order_flow",
    detectionTypes: ["rejection_zone"],
    settings: [],
  },

  // Fair Value Gaps
  fvg: {
    value: "fvg",
    label: "Fair Value Gap",
    description: "Price inefficiencies (imbalances)",
    category: "fvg",
    detectionTypes: ["fvg_bullish", "fvg_bearish"],
    settings: [
      {
        key: "min_gap_pct",
        label: "Min Gap Size (%)",
        type: "number",
        default: 0.1,
        min: 0,
        max: 2,
        step: 0.05,
      },
      {
        key: "show_mitigated",
        label: "Show Mitigated",
        type: "boolean",
        default: false,
      },
    ],
  },
  bisi: {
    value: "bisi",
    label: "BISI (Buyside Imbalance)",
    description: "Buyside Imbalance Sellside Inefficiency",
    category: "fvg",
    detectionTypes: ["bisi"],
    settings: [],
  },
  sibi: {
    value: "sibi",
    label: "SIBI (Sellside Imbalance)",
    description: "Sellside Imbalance Buyside Inefficiency",
    category: "fvg",
    detectionTypes: ["sibi"],
    settings: [],
  },

  // Supply/Demand
  supply_zone: {
    value: "supply_zone",
    label: "Supply Zone",
    description: "Areas of selling pressure",
    category: "supply_demand",
    detectionTypes: ["supply"],
    settings: [
      {
        key: "detection_type",
        label: "Zone Type",
        type: "select",
        default: "rally_base_drop",
        options: [
          { value: "rally_base_drop", label: "Rally-Base-Drop" },
          { value: "drop_base_drop", label: "Drop-Base-Drop" },
        ],
      },
    ],
  },
  demand_zone: {
    value: "demand_zone",
    label: "Demand Zone",
    description: "Areas of buying pressure",
    category: "supply_demand",
    detectionTypes: ["demand"],
    settings: [
      {
        key: "detection_type",
        label: "Zone Type",
        type: "select",
        default: "drop_base_rally",
        options: [
          { value: "drop_base_rally", label: "Drop-Base-Rally" },
          { value: "rally_base_rally", label: "Rally-Base-Rally" },
        ],
      },
    ],
  },
  imbalance: {
    value: "imbalance",
    label: "Imbalance",
    description: "Supply/demand imbalance areas",
    category: "supply_demand",
    detectionTypes: ["imbalance_bullish", "imbalance_bearish"],
    settings: [],
  },

  // Fibonacci
  fibonacci_retracement: {
    value: "fibonacci_retracement",
    label: "Fibonacci Retracement",
    description: "Fibonacci retracement levels",
    category: "fibonacci",
    detectionTypes: ["fib_0", "fib_236", "fib_382", "fib_5", "fib_618", "fib_786", "fib_1"],
    settings: [
      {
        key: "auto_detect",
        label: "Auto-detect Swings",
        type: "boolean",
        default: true,
      },
      {
        key: "levels",
        label: "Show Levels",
        type: "select",
        default: "standard",
        options: [
          { value: "standard", label: "Standard (23.6, 38.2, 50, 61.8)" },
          { value: "extended", label: "Extended (all levels)" },
        ],
      },
    ],
  },
  fibonacci_extension: {
    value: "fibonacci_extension",
    label: "Fibonacci Extension",
    description: "Fibonacci extension levels",
    category: "fibonacci",
    detectionTypes: ["fib_ext_1", "fib_ext_1272", "fib_ext_1618", "fib_ext_2"],
    settings: [],
  },
  fibonacci_time: {
    value: "fibonacci_time",
    label: "Fibonacci Time Zones",
    description: "Time-based Fibonacci analysis",
    category: "fibonacci",
    detectionTypes: ["fib_time_zone"],
    settings: [],
  },

  // Trend Analysis
  trend_lines: {
    value: "trend_lines",
    label: "Trend Lines",
    description: "Auto-detected trend lines",
    category: "trend",
    detectionTypes: ["trendline_up", "trendline_down"],
    settings: [
      {
        key: "min_touches",
        label: "Min Touches",
        type: "number",
        default: 2,
        min: 2,
        max: 10,
      },
    ],
  },
  channels: {
    value: "channels",
    label: "Channels",
    description: "Price channels",
    category: "trend",
    detectionTypes: ["channel_upper", "channel_lower", "channel_mid"],
    settings: [],
  },
  wedges: {
    value: "wedges",
    label: "Wedges",
    description: "Rising and falling wedge patterns",
    category: "trend",
    detectionTypes: ["wedge_rising", "wedge_falling"],
    settings: [],
  },
  triangles: {
    value: "triangles",
    label: "Triangles",
    description: "Triangle patterns",
    category: "trend",
    detectionTypes: ["triangle_ascending", "triangle_descending", "triangle_symmetric"],
    settings: [],
  },

  // Classic Patterns
  head_shoulders: {
    value: "head_shoulders",
    label: "Head & Shoulders",
    description: "H&S reversal patterns",
    category: "classic",
    detectionTypes: ["head_shoulders_top", "head_shoulders_bottom"],
    settings: [
      {
        key: "symmetry_tolerance",
        label: "Symmetry Tolerance (%)",
        type: "number",
        default: 20,
        min: 5,
        max: 50,
      },
    ],
  },
  double_top: {
    value: "double_top",
    label: "Double Top",
    description: "Double top reversal",
    category: "classic",
    detectionTypes: ["double_top"],
    settings: [
      {
        key: "tolerance_pct",
        label: "Peak Tolerance (%)",
        type: "number",
        default: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
    ],
  },
  double_bottom: {
    value: "double_bottom",
    label: "Double Bottom",
    description: "Double bottom reversal",
    category: "classic",
    detectionTypes: ["double_bottom"],
    settings: [
      {
        key: "tolerance_pct",
        label: "Trough Tolerance (%)",
        type: "number",
        default: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
    ],
  },
  triple_top: {
    value: "triple_top",
    label: "Triple Top",
    description: "Triple top reversal",
    category: "classic",
    detectionTypes: ["triple_top"],
    settings: [],
  },
  triple_bottom: {
    value: "triple_bottom",
    label: "Triple Bottom",
    description: "Triple bottom reversal",
    category: "classic",
    detectionTypes: ["triple_bottom"],
    settings: [],
  },
  cup_handle: {
    value: "cup_handle",
    label: "Cup & Handle",
    description: "Cup and handle continuation",
    category: "classic",
    detectionTypes: ["cup_handle_bullish", "cup_handle_bearish"],
    settings: [],
  },
  flags: {
    value: "flags",
    label: "Flags",
    description: "Bull and bear flags",
    category: "classic",
    detectionTypes: ["flag_bullish", "flag_bearish"],
    settings: [],
  },
  pennants: {
    value: "pennants",
    label: "Pennants",
    description: "Bull and bear pennants",
    category: "classic",
    detectionTypes: ["pennant_bullish", "pennant_bearish"],
    settings: [],
  },

  // Candlestick Patterns
  engulfing: {
    value: "engulfing",
    label: "Engulfing",
    description: "Bullish and bearish engulfing",
    category: "candlestick",
    detectionTypes: ["engulfing_bullish", "engulfing_bearish"],
    settings: [],
  },
  doji: {
    value: "doji",
    label: "Doji",
    description: "Doji candlestick patterns",
    category: "candlestick",
    detectionTypes: ["doji", "doji_dragonfly", "doji_gravestone"],
    settings: [
      {
        key: "body_ratio",
        label: "Max Body Ratio",
        type: "number",
        default: 0.1,
        min: 0.01,
        max: 0.3,
        step: 0.01,
      },
    ],
  },
  hammer: {
    value: "hammer",
    label: "Hammer",
    description: "Hammer reversal pattern",
    category: "candlestick",
    detectionTypes: ["hammer", "inverted_hammer"],
    settings: [],
  },
  shooting_star: {
    value: "shooting_star",
    label: "Shooting Star",
    description: "Shooting star reversal",
    category: "candlestick",
    detectionTypes: ["shooting_star"],
    settings: [],
  },
  morning_star: {
    value: "morning_star",
    label: "Morning Star",
    description: "Morning star reversal",
    category: "candlestick",
    detectionTypes: ["morning_star"],
    settings: [],
  },
  evening_star: {
    value: "evening_star",
    label: "Evening Star",
    description: "Evening star reversal",
    category: "candlestick",
    detectionTypes: ["evening_star"],
    settings: [],
  },
  three_white_soldiers: {
    value: "three_white_soldiers",
    label: "Three White Soldiers",
    description: "Bullish continuation",
    category: "candlestick",
    detectionTypes: ["three_white_soldiers"],
    settings: [],
  },
  three_black_crows: {
    value: "three_black_crows",
    label: "Three Black Crows",
    description: "Bearish continuation",
    category: "candlestick",
    detectionTypes: ["three_black_crows"],
    settings: [],
  },
  harami: {
    value: "harami",
    label: "Harami",
    description: "Harami pattern",
    category: "candlestick",
    detectionTypes: ["harami_bullish", "harami_bearish"],
    settings: [],
  },
  piercing_line: {
    value: "piercing_line",
    label: "Piercing Line",
    description: "Bullish reversal pattern",
    category: "candlestick",
    detectionTypes: ["piercing_line"],
    settings: [],
  },
  dark_cloud_cover: {
    value: "dark_cloud_cover",
    label: "Dark Cloud Cover",
    description: "Bearish reversal pattern",
    category: "candlestick",
    detectionTypes: ["dark_cloud_cover"],
    settings: [],
  },

  // Volume Analysis
  volume_profile: {
    value: "volume_profile",
    label: "Volume Profile",
    description: "Volume at price analysis",
    category: "volume",
    detectionTypes: ["poc", "vah", "val", "hvn", "lvn"],
    settings: [
      {
        key: "row_size",
        label: "Row Size",
        type: "number",
        default: 24,
        min: 10,
        max: 100,
      },
    ],
  },
  volume_divergence: {
    value: "volume_divergence",
    label: "Volume Divergence",
    description: "Price/volume divergences",
    category: "volume",
    detectionTypes: ["volume_div_bullish", "volume_div_bearish"],
    settings: [],
  },
  volume_climax: {
    value: "volume_climax",
    label: "Volume Climax",
    description: "Extreme volume events",
    category: "volume",
    detectionTypes: ["volume_climax_buy", "volume_climax_sell"],
    settings: [
      {
        key: "std_multiplier",
        label: "Std Dev Multiplier",
        type: "number",
        default: 2,
        min: 1,
        max: 5,
        step: 0.5,
      },
    ],
  },

  // Indicators
  ma_crossover: {
    value: "ma_crossover",
    label: "MA Crossover",
    description: "Moving average crossovers",
    category: "indicators",
    detectionTypes: ["ma_cross_bullish", "ma_cross_bearish"],
    settings: [
      {
        key: "fast_period",
        label: "Fast MA Period",
        type: "number",
        default: 9,
        min: 1,
        max: 200,
      },
      {
        key: "slow_period",
        label: "Slow MA Period",
        type: "number",
        default: 21,
        min: 1,
        max: 200,
      },
      {
        key: "ma_type",
        label: "MA Type",
        type: "select",
        default: "ema",
        options: [
          { value: "sma", label: "SMA" },
          { value: "ema", label: "EMA" },
          { value: "wma", label: "WMA" },
        ],
      },
    ],
  },
  rsi_divergence: {
    value: "rsi_divergence",
    label: "RSI Divergence",
    description: "RSI divergence signals",
    category: "indicators",
    detectionTypes: ["rsi_div_bullish", "rsi_div_bearish", "rsi_div_hidden_bullish", "rsi_div_hidden_bearish"],
    settings: [
      {
        key: "period",
        label: "RSI Period",
        type: "number",
        default: 14,
        min: 2,
        max: 50,
      },
      {
        key: "overbought",
        label: "Overbought Level",
        type: "number",
        default: 70,
        min: 50,
        max: 90,
      },
      {
        key: "oversold",
        label: "Oversold Level",
        type: "number",
        default: 30,
        min: 10,
        max: 50,
      },
    ],
  },
  macd_signal: {
    value: "macd_signal",
    label: "MACD Signals",
    description: "MACD crossover and divergence",
    category: "indicators",
    detectionTypes: ["macd_cross_bullish", "macd_cross_bearish", "macd_div_bullish", "macd_div_bearish"],
    settings: [
      {
        key: "fast",
        label: "Fast Period",
        type: "number",
        default: 12,
        min: 1,
        max: 50,
      },
      {
        key: "slow",
        label: "Slow Period",
        type: "number",
        default: 26,
        min: 1,
        max: 100,
      },
      {
        key: "signal",
        label: "Signal Period",
        type: "number",
        default: 9,
        min: 1,
        max: 50,
      },
    ],
  },
  bollinger_bands: {
    value: "bollinger_bands",
    label: "Bollinger Bands",
    description: "BB signals and squeezes",
    category: "indicators",
    detectionTypes: ["bb_upper_touch", "bb_lower_touch", "bb_squeeze", "bb_expansion"],
    settings: [
      {
        key: "period",
        label: "Period",
        type: "number",
        default: 20,
        min: 5,
        max: 100,
      },
      {
        key: "std_dev",
        label: "Std Deviation",
        type: "number",
        default: 2,
        min: 0.5,
        max: 4,
        step: 0.5,
      },
    ],
  },
  vwap: {
    value: "vwap",
    label: "VWAP",
    description: "Volume Weighted Average Price",
    category: "indicators",
    detectionTypes: ["vwap_cross_above", "vwap_cross_below", "vwap_bounce"],
    settings: [
      {
        key: "show_bands",
        label: "Show Bands",
        type: "boolean",
        default: true,
      },
      {
        key: "band_multiplier",
        label: "Band Multiplier",
        type: "number",
        default: 1,
        min: 0.5,
        max: 3,
        step: 0.5,
      },
    ],
  },
};

// Pattern categories for UI grouping
export const PATTERN_CATEGORIES = {
  price_action: { label: "Price Action", color: "#3B82F6" },
  support_resistance: { label: "Support & Resistance", color: "#10B981" },
  order_flow: { label: "Order Flow / ICT", color: "#8B5CF6" },
  fvg: { label: "Fair Value Gaps", color: "#F59E0B" },
  supply_demand: { label: "Supply & Demand", color: "#EF4444" },
  fibonacci: { label: "Fibonacci", color: "#EC4899" },
  trend: { label: "Trend Analysis", color: "#6366F1" },
  classic: { label: "Classic Patterns", color: "#14B8A6" },
  candlestick: { label: "Candlestick", color: "#F97316" },
  volume: { label: "Volume", color: "#06B6D4" },
  indicators: { label: "Indicators", color: "#84CC16" },
};

export type DetectionType =
  // Swings
  | "swing_high"
  | "swing_low"
  // Structure breaks
  | "bos_bullish"
  | "bos_bearish"
  | "msb_bullish"
  | "msb_bearish"
  // Range
  | "range_high"
  | "range_low"
  | "range_mid"
  // Fibonacci
  | "fib_level"
  // False breakout
  | "false_breakout_high"
  | "false_breakout_low";

// Structure types for swings
// HH = Higher High, HL = Higher Low, LH = Lower High, LL = Lower Low
// H = First High (no previous high to compare), L = First Low (no previous low to compare)
export type StructureType = "HH" | "HL" | "LH" | "LL" | "H" | "L";

export type DetectionStatus = "pending" | "confirmed" | "rejected" | "moved";

export type CorrectionType = "move" | "delete" | "add" | "confirm";

export type CorrectionStatus = "pending" | "applied" | "disputed";

export type SessionStatus = "in_progress" | "resolved" | "archived";

export type EventType =
  | "session_created"
  | "session_updated"
  | "session_archived"
  | "detection_added"
  | "detection_confirmed"
  | "detection_rejected"
  | "detection_moved"
  | "correction_created"
  | "correction_updated"
  | "correction_resolved"
  | "comment_created"
  | "comment_updated"
  | "comment_resolved"
  | "comment_deleted"
  | "share_added"
  | "share_removed";

// ============================================================================
// CANDLE DATA
// ============================================================================

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandleWithIndex extends Candle {
  index: number;
}

// ============================================================================
// DETECTION
// ============================================================================

export interface Detection {
  id: string;
  sessionId: string;
  candleIndex: number;
  candleTime: Date;
  price: number;
  detectionType: DetectionType;
  structure?: StructureType;
  confidence?: number;
  metadata?: Record<string, unknown>;
  canvasX?: number;
  canvasY?: number;
  status: DetectionStatus;
  createdAt: Date;
}

export interface DetectionCreate {
  candleIndex: number;
  candleTime: Date;
  price: number;
  detectionType: DetectionType;
  structure?: StructureType;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CORRECTION
// ============================================================================

export interface Attachment {
  id: string;
  url: string;
  type: "image" | "file";
  name: string;
  size: number;
}

export interface Correction {
  id: string;
  sessionId: string;
  detectionId?: string;
  userId: string;
  correctionType: CorrectionType;
  originalIndex?: number;
  originalTime?: Date;
  originalPrice?: number;
  originalType?: DetectionType;
  correctedIndex?: number;
  correctedTime?: Date;
  correctedPrice?: number;
  correctedType?: DetectionType;
  correctedStructure?: StructureType;
  reason: string;
  attachments?: Attachment[];
  status: CorrectionStatus;
  resolvedAt?: Date;
  resolvedById?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CorrectionCreate {
  detectionId?: string;
  correctionType: CorrectionType;
  originalIndex?: number;
  originalTime?: Date;
  originalPrice?: number;
  originalType?: DetectionType;
  correctedIndex?: number;
  correctedTime?: Date;
  correctedPrice?: number;
  correctedType?: DetectionType;
  correctedStructure?: StructureType;
  reason: string;
  attachments?: Attachment[];
}

// ============================================================================
// COMMENT
// ============================================================================

export interface Comment {
  id: string;
  sessionId: string;
  userId: string;
  detectionId?: string;
  correctionId?: string;
  parentId?: string;
  content: string;
  attachments?: Attachment[];
  canvasX?: number;
  canvasY?: number;
  candleTime?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedById?: string;
  editedAt?: Date;
  editCount: number;
  originalContent?: string;
  createdAt: Date;
  updatedAt: Date;
  // Populated
  replies?: Comment[];
  user?: {
    id: string;
    name?: string;
    image?: string;
  };
}

export interface CommentCreate {
  detectionId?: string;
  correctionId?: string;
  parentId?: string;
  content: string;
  attachments?: Attachment[];
  canvasX?: number;
  canvasY?: number;
  candleTime?: Date;
}

// ============================================================================
// SESSION
// ============================================================================

export interface PatternSessionSummary {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  patternType: PatternType;
  status: SessionStatus;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  detectionCount: number;
  correctionCount: number;
  commentCount: number;
  createdBy: {
    id: string;
    name?: string;
    image?: string;
  };
}

export interface PatternSessionFull extends PatternSessionSummary {
  startTime: Date;
  endTime: Date;
  patternVersion: string;
  candleData?: Candle[];
  description?: string;
  isPublic: boolean;
  detections: Detection[];
  corrections: Correction[];
  comments: Comment[];
}

export interface PatternSessionCreate {
  symbol: string;
  timeframe: Timeframe;
  startTime: Date;
  endTime: Date;
  patternType: PatternType;
  patternVersion: string;
  candleData?: Candle[];
  title?: string;
  description?: string;
}

// ============================================================================
// EVENT (Audit Trail)
// ============================================================================

export interface PatternEventPayload {
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PatternEvent {
  id: string;
  sessionId: string;
  userId: string;
  eventType: EventType;
  entityType?: "session" | "detection" | "correction" | "comment";
  entityId?: string;
  payload: PatternEventPayload;
  canvasSnapshot?: unknown;
  createdAt: Date;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// EXPORT FORMAT (for Claude)
// ============================================================================

export interface ExportSession {
  session: {
    id: string;
    symbol: string;
    timeframe: Timeframe;
    patternType: PatternType;
    patternVersion: string;
    startTime: string;
    endTime: string;
  };
  corrections: Array<{
    id: string;
    type: CorrectionType;
    detection?: {
      id: string;
      type: DetectionType;
      candleTime: string;
      price: number;
      structure?: StructureType;
    };
    correctedTo?: {
      candleTime: string;
      price: number;
      type?: DetectionType;
      structure?: StructureType;
    };
    reason: string;
    author: string;
    createdAt: string;
  }>;
  comments: Array<{
    id: string;
    detectionId?: string;
    correctionId?: string;
    content: string;
    author: string;
    createdAt: string;
  }>;
}
