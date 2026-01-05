# Trading Systems Engine - Complete Specification

**Version:** 1.0.0-draft
**Last Updated:** 2026-01-05
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Architecture Overview](#3-architecture-overview)
4. [Data Layer](#4-data-layer)
5. [Pattern Detection Library](#5-pattern-detection-library)
6. [Indicator Library](#6-indicator-library)
7. [Condition Library](#7-condition-library)
8. [System Definition Format](#8-system-definition-format)
9. [Execution Engine](#9-execution-engine)
10. [Backtesting Engine](#10-backtesting-engine)
11. [Live Trading Engine](#11-live-trading-engine)
12. [Results & Analytics](#12-results--analytics)
13. [User Interface](#13-user-interface)
14. [Implementation Roadmap](#14-implementation-roadmap)
15. [Known Challenges & Edge Cases](#15-known-challenges--edge-cases)
16. [Appendix: Previous Automation Failure Analysis](#16-appendix-previous-automation-failure-analysis)

---

## 1. Executive Summary

### 1.1 What This Is

A **deterministic, rule-based trading systems engine** integrated into the Hyperliquid Trader app that enables:

- **Rapid system creation**: Define new trading systems in minutes using pre-built, tested pattern modules
- **Accurate backtesting**: Run 100+ backtests per system with guaranteed consistency
- **Seamless live trading**: Same code, same logic - backtest results = live results
- **Mass system testing**: Test 10+ different systems per day to find high-R strategies

### 1.2 What This Is NOT

- Not machine learning / AI (no probabilistic outputs)
- Not a black box (every decision is traceable to explicit rules)
- Not a "set and forget" system (requires validated, backtested strategies)

### 1.3 Core Principle

> **The investment is in the PATTERN LIBRARY, not per-system.**

Once `swing_detector()` works correctly, it works for ALL systems that use swings. The upfront work is building and testing ~30 modules. After that, creating new systems is configuration, not coding.

### 1.4 Success Criteria

| Metric | Target |
|--------|--------|
| Time to create new system | < 10 minutes |
| Time to backtest 100 trades | < 30 seconds |
| Pattern detection accuracy | 100% match to manual analysis |
| Backtest vs Live consistency | Identical signals |

---

## 2. Problem Statement

### 2.1 The Manual Trading Bottleneck

Current workflow:
1. Develop trading idea
2. Manually backtest 100 trades (4-8 hours)
3. Analyze results
4. If profitable, manually trade live
5. Repeat for each system variation

**Problem**: Can only test ~1-2 systems per day. Finding a 3-4R system requires testing dozens of variations.

### 2.2 Previous Automation Failure

A previous attempt to automate the "75% Mean Reversion V-Shape Strategy" in Pine Script failed catastrophically:

| Metric | Manual | Automated |
|--------|--------|-----------|
| Win Rate | 40-60% | 9.76% |
| Avg R | 1.5 | Negative |
| Trades Found | ~50-100 | 1,558 |
| Direction Split | ~50/50 | 94% short |
| P&L | Profitable | -77% |

**Root Causes:**
1. **Early Exit Logic**: Code closed on "range ended" instead of SL/TP
2. **Same-Candle Entry**: Entered on detection candle, not next candle
3. **Wrong Price Reference**: Used open instead of close[1]
4. **No Trade Validation**: Allowed TP in wrong direction
5. **Multiple Entries**: 6 trades at same time/price
6. **Loose Swing Detection**: Fired constantly due to ambiguous rules

**Key Insight**: The bugs came from **under-specified rules**, not wrong strategy logic.

### 2.3 Requirements

| Requirement | Description |
|-------------|-------------|
| Binary/Objective | Every decision is yes/no, never "probably" |
| 100% Reproducible | Same data + same config = same results always |
| Configurable | Users can tune parameters without coding |
| Fast Creation | New system in minutes, not hours |
| Visual Verification | See what the code "sees" on charts |
| Integrated | Lives in Hyperliquid Trader app |

---

## 3. Architecture Overview

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         HYPERLIQUID TRADER APP                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      TRADING SYSTEMS ENGINE                      │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │  DATA LAYER  │  │   PATTERN    │  │  INDICATOR   │          │   │
│  │  │              │  │   LIBRARY    │  │   LIBRARY    │          │   │
│  │  │ • OHLCV      │  │              │  │              │          │   │
│  │  │ • Historical │  │ • Swings     │  │ • SMA/EMA    │          │   │
│  │  │ • Real-time  │  │ • Ranges     │  │ • RSI        │          │   │
│  │  │ • Multi-TF   │  │ • BOS/MSB    │  │ • MACD       │          │   │
│  │  │ • Multi-Asset│  │ • Fibs       │  │ • BB         │          │   │
│  │  └──────┬───────┘  │ • Breakouts  │  │ • ATR        │          │   │
│  │         │          └──────┬───────┘  └──────┬───────┘          │   │
│  │         │                 │                 │                   │   │
│  │         └────────────────┬┴─────────────────┘                   │   │
│  │                          │                                      │   │
│  │                          ▼                                      │   │
│  │              ┌───────────────────────┐                          │   │
│  │              │   CONDITION LIBRARY   │                          │   │
│  │              │                       │                          │   │
│  │              │ • Crossovers          │                          │   │
│  │              │ • Divergences         │                          │   │
│  │              │ • Comparisons         │                          │   │
│  │              │ • Combinations        │                          │   │
│  │              └───────────┬───────────┘                          │   │
│  │                          │                                      │   │
│  │                          ▼                                      │   │
│  │              ┌───────────────────────┐                          │   │
│  │              │   SYSTEM DEFINITION   │                          │   │
│  │              │      (YAML/JSON)      │                          │   │
│  │              │                       │                          │   │
│  │              │ • Entry rules         │                          │   │
│  │              │ • Exit rules          │                          │   │
│  │              │ • Filters             │                          │   │
│  │              │ • Parameters          │                          │   │
│  │              └───────────┬───────────┘                          │   │
│  │                          │                                      │   │
│  │         ┌────────────────┴────────────────┐                     │   │
│  │         │                                 │                     │   │
│  │         ▼                                 ▼                     │   │
│  │  ┌─────────────────┐            ┌─────────────────┐            │   │
│  │  │    BACKTEST     │            │   LIVE TRADING  │            │   │
│  │  │     ENGINE      │            │     ENGINE      │            │   │
│  │  │                 │            │                 │            │   │
│  │  │ • Simulate      │            │ • Real orders   │            │   │
│  │  │ • No real $     │            │ • Real money    │            │   │
│  │  │ • Fast replay   │            │ • Real-time     │            │   │
│  │  └────────┬────────┘            └────────┬────────┘            │   │
│  │           │                              │                      │   │
│  │           └──────────────┬───────────────┘                      │   │
│  │                          │                                      │   │
│  │                          ▼                                      │   │
│  │              ┌───────────────────────┐                          │   │
│  │              │   RESULTS & ANALYTICS │                          │   │
│  │              │                       │                          │   │
│  │              │ • Win rate            │                          │   │
│  │              │ • R metrics           │                          │   │
│  │              │ • Trade log           │                          │   │
│  │              │ • Chart visualization │                          │   │
│  │              └───────────────────────┘                          │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Pattern Detection | Python | Industry standard, ta-lib available |
| Indicator Calculations | Python + ta-lib | 200+ indicators, C-speed via wrapper |
| System Parser | Python | YAML parsing, easy to modify |
| Backtest Engine | Python + pandas | Fast enough for 1000s of trades |
| Live Execution | Python + hyperliquid-python-sdk | Official SDK, battle-tested |
| Chart Rendering | React + charting lib | TradingView-style visuals |
| Configuration UI | React | In-app system builder |
| Data Storage | SQLite | Local, fast, portable |
| Desktop App Shell | Tauri (Rust) | Only for packaging, auto-update |

**Why Python over Rust?**
- Official Hyperliquid SDK is Python
- ta-lib provides 200+ pre-built indicators (verified against TradingView)
- pandas/numpy are industry standard for trading
- Faster development iteration
- Easier to read and modify
- Performance is sufficient (backtesting 100 trades takes <1 second)

### 3.3 Data Flow

```
Historical Data (Hyperliquid API)
         │
         ▼
┌─────────────────┐
│   Data Layer    │ ──► Stores OHLCV in SQLite
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Pattern Library │ ──► Detects swings, ranges, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Indicator Library│ ──► Calculates RSI, MA, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Condition Library│ ──► Evaluates entry/exit conditions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ System Engine   │ ──► Generates signals based on config
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
Backtest    Live
 Engine    Engine
    │         │
    ▼         ▼
 Results   Orders
```

---

## 4. Data Layer

### 4.1 OHLCV Data Structure

```python
import pandas as pd
from dataclasses import dataclass
from enum import Enum

class Timeframe(Enum):
    M1 = "1m"
    M5 = "5m"
    M15 = "15m"
    M30 = "30m"
    H1 = "1h"
    H4 = "4h"
    D1 = "1d"
    W1 = "1w"

# Candles stored as pandas DataFrame with columns:
# timestamp (int64), open, high, low, close, volume (all float64)
# Index is timestamp for fast lookups

@dataclass
class CandleData:
    asset: str              # "BTC", "ETH", etc.
    timeframe: Timeframe
    candles: pd.DataFrame   # OHLCV DataFrame
```

### 4.2 Supported Timeframes

| Code | Duration | Use Case |
|------|----------|----------|
| M1 | 1 minute | Scalping, LTF confirmation |
| M5 | 5 minutes | Short-term, LTF entries |
| M15 | 15 minutes | Intraday |
| M30 | 30 minutes | Primary trading TF |
| H1 | 1 hour | Swing setups |
| H4 | 4 hours | HTF trend |
| D1 | 1 day | HTF context |
| W1 | 1 week | Macro context |

### 4.3 Supported Assets

All perpetual futures available on Hyperliquid:
- BTC, ETH, SOL, AVAX, ARB, OP, MATIC, etc.
- Full list fetched from Hyperliquid API on startup

### 4.4 Data Fetching

```python
from hyperliquid.info import Info
from datetime import datetime
import pandas as pd

class DataFetcher:
    def __init__(self, info: Info):
        self.info = info

    async def fetch_historical(
        self,
        asset: str,
        timeframe: Timeframe,
        start: datetime,
        end: datetime,
    ) -> pd.DataFrame:
        """Fetch historical candles from Hyperliquid API"""
        # Uses official hyperliquid-python-sdk
        candles = self.info.candles_snapshot(asset, timeframe.value, start, end)
        return pd.DataFrame(candles)

    def subscribe_realtime(
        self,
        asset: str,
        timeframe: Timeframe,
        callback: callable,
    ):
        """Subscribe to real-time candle updates via WebSocket"""
        # Uses official SDK WebSocket connection
        pass
```

### 4.5 Data Storage

SQLite database for local caching:

```sql
CREATE TABLE candles (
    id INTEGER PRIMARY KEY,
    asset TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume REAL NOT NULL,
    UNIQUE(asset, timeframe, timestamp)
);

CREATE INDEX idx_candles_lookup
ON candles(asset, timeframe, timestamp);
```

### 4.6 Data Requirements

| Timeframe | Minimum History | Recommended |
|-----------|-----------------|-------------|
| M1 | 7 days | 30 days |
| M5 | 30 days | 90 days |
| M15 | 90 days | 180 days |
| M30 | 180 days | 365 days |
| H1 | 365 days | 2 years |
| H4 | 2 years | 3 years |
| D1 | 3 years | 5 years |

---

## 5. Pattern Detection Library

### 5.1 Overview

Each pattern detector is a **configurable module** that:
1. Takes candle data as input
2. Returns detected pattern instances with precise bar indices and prices
3. Has extensive configuration options to match user's trading style
4. Is thoroughly tested against manual analysis

### 5.2 Swing High Detector

#### 5.2.1 Purpose
Identifies significant price peaks that may act as resistance or mark trend structure.

#### 5.2.2 Configuration

```yaml
swing_high:
  # DETECTION METHOD
  method: "consecutive_candles" | "highest_in_lookback" | "touches" | "combined"

  # --- Method: consecutive_candles ---
  # Requires N consecutive candles of same direction before the high
  consecutive_candles:
    count: 2                    # Minimum consecutive candles (default: 2)
    direction: "green"          # "green" (close > open) | "up" (close > prev_close)
    allow_doji: true            # Treat doji as continuation of previous direction
    doji_threshold: 0.1         # % body size relative to range to count as doji

  # --- Method: highest_in_lookback ---
  # Simply the highest point in the last N bars
  highest_in_lookback:
    bars: 50                    # Lookback period (default: 50)

  # --- Method: touches ---
  # Requires price to test the level multiple times
  touches:
    min_touches: 2              # Minimum touches required (default: 2)
    touch_tolerance: 0.3        # % tolerance for what counts as a "touch"
    touch_tolerance_type: "percent" | "atr"  # Tolerance calculation method
    touch_atr_multiplier: 0.3   # If using ATR: tolerance = ATR * multiplier
    max_bars_between_touches: 50 # Maximum bars between touches

  # --- Method: combined ---
  # Requires BOTH consecutive candles AND touches
  combined:
    consecutive_candles: { count: 2, direction: "green" }
    touches: { min_touches: 2, touch_tolerance: 0.3 }

  # PRICE REFERENCE
  price_reference: "wick" | "close"  # What price marks the swing? (default: "wick")

  # VALIDATION
  validation:
    min_swing_size: 0           # Minimum size in % or ATR (0 = disabled)
    min_swing_size_type: "percent" | "atr"
    min_swing_atr_multiplier: 1.0
    require_preceding_move: false  # Require significant move before swing
    preceding_move_bars: 5
    preceding_move_size: 1.0    # In % or ATR

  # INVALIDATION
  invalidation:
    break_type: "wick" | "close"  # What constitutes breaking the swing?
    break_direction: "above"      # "above" for swing high

  # CONFIRMATION
  confirmation:
    require_pullback: false      # Wait for price to pull back before confirming
    pullback_bars: 3             # Bars to wait for pullback
    pullback_size: 0.5           # Minimum pullback in % or ATR
```

#### 5.2.3 Output

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class SwingHigh:
    bar_index: int              # Which candle is the swing high
    price: float                # The swing high price
    timestamp: int              # Timestamp of the swing candle
    touches: list[int]          # Bar indices of all touches
    confirmed_at: int           # Bar index when swing was confirmed
    invalidated_at: Optional[int] = None  # Bar index when swing was broken (if any)
```

#### 5.2.4 Examples

**Example 1: Simple 2-candle swing**
```
Config: { method: "consecutive_candles", consecutive_candles: { count: 2 } }

Bar 1: Green (close > open)
Bar 2: Green (close > open)
Bar 3: Red, high is lower than Bar 2 high
       ↑ Swing high detected at Bar 2
```

**Example 2: 2-touch requirement**
```
Config: { method: "touches", touches: { min_touches: 2, touch_tolerance: 0.3 } }

Bar 10: Price hits 50,000 (Touch 1)
Bar 15: Price hits 49,900 (within 0.3% = Touch 2)
Bar 16: Price moves away
        ↑ Swing high confirmed at Bar 10, price = 50,000
```

### 5.3 Swing Low Detector

#### 5.3.1 Purpose
Identifies significant price troughs that may act as support or mark trend structure.

#### 5.3.2 Configuration

```yaml
swing_low:
  # DETECTION METHOD
  method: "consecutive_candles" | "lowest_in_lookback" | "touches" | "combined"

  # --- Method: consecutive_candles ---
  consecutive_candles:
    count: 2                    # Minimum consecutive candles (default: 2)
    direction: "red"            # "red" (close < open) | "down" (close < prev_close)
    allow_doji: true
    doji_threshold: 0.1

  # --- Method: lowest_in_lookback ---
  lowest_in_lookback:
    bars: 50

  # --- Method: touches ---
  touches:
    min_touches: 2
    touch_tolerance: 0.3
    touch_tolerance_type: "percent" | "atr"
    touch_atr_multiplier: 0.3
    max_bars_between_touches: 50

  # --- Method: combined ---
  combined:
    consecutive_candles: { count: 2, direction: "red" }
    touches: { min_touches: 2, touch_tolerance: 0.3 }

  # PRICE REFERENCE
  price_reference: "wick" | "close"

  # VALIDATION
  validation:
    min_swing_size: 0
    min_swing_size_type: "percent" | "atr"
    min_swing_atr_multiplier: 1.0
    require_preceding_move: false
    preceding_move_bars: 5
    preceding_move_size: 1.0

  # INVALIDATION
  invalidation:
    break_type: "wick" | "close"
    break_direction: "below"

  # CONFIRMATION
  confirmation:
    require_pullback: false
    pullback_bars: 3
    pullback_size: 0.5
```

#### 5.3.3 Output

```python
@dataclass
class SwingLow:
    bar_index: int
    price: float
    timestamp: int
    touches: list[int]
    confirmed_at: int
    invalidated_at: Optional[int] = None
```

### 5.4 Range Detector

#### 5.4.1 Purpose
Identifies horizontal consolidation zones where price moves sideways between defined high and low boundaries.

#### 5.4.2 Configuration

```yaml
range:
  # DETECTION METHOD
  method: "fib_retracement" | "touch_based" | "volatility_contraction"

  # --- Method: fib_retracement ---
  # Range forms when price retraces to a fib level after a move
  fib_retracement:
    # Source swing points
    swing_high_config: { ... }  # Nested swing high config
    swing_low_config: { ... }   # Nested swing low config

    # Retracement requirements
    min_retracement: 0.70       # Minimum fib level (e.g., 0.70 = 70%)
    max_retracement: 1.00       # Maximum fib level (e.g., 1.00 = 100%)
    retracement_price: "close"  # What price must reach the level? "wick" | "close"

    # Range boundary definitions
    range_high_source: "swing_high" | "retracement_candle_high"
    range_low_source: "retracement_candle_close" | "retracement_candle_low"

  # --- Method: touch_based ---
  # Range forms when price touches both high and low multiple times
  touch_based:
    min_touches_high: 3         # Minimum touches on range high
    min_touches_low: 3          # Minimum touches on range low
    touch_tolerance: 0.3        # % tolerance for touches
    touch_tolerance_type: "percent" | "atr"
    min_range_bars: 10          # Minimum bars for range to form
    max_range_height: 5.0       # Maximum range height in % (filters out trends)
    max_range_height_type: "percent" | "atr"

  # --- Method: volatility_contraction ---
  # Range detected via ATR contraction
  volatility_contraction:
    atr_period: 14
    contraction_threshold: 0.5  # ATR must be below X% of recent average
    lookback_for_average: 50
    min_contraction_bars: 5

  # RANGE UPDATES
  updates:
    allow_expansion: true       # Can range expand if price pushes but returns?
    expansion_tolerance: 0.2    # How far beyond range before it's a breakout? (fib level)
    update_on_new_high: true    # Update range high if price makes higher high but returns
    update_on_new_low: true     # Update range low if price makes lower low but returns

  # RANGE INVALIDATION
  invalidation:
    break_type: "close"         # "wick" | "close" - what breaks the range?
    break_threshold: 1.2        # Fib level that invalidates range (e.g., 1.2 = 120%)
    break_threshold_low: -0.2   # Fib level for downside invalidation
    min_break_bars: 1           # Consecutive bars beyond threshold to confirm break
```

#### 5.4.3 Output

```python
from enum import Enum

class RangeStatus(Enum):
    ACTIVE = "active"
    BROKEN_UP = "broken_up"
    BROKEN_DOWN = "broken_down"
    EXPIRED = "expired"

@dataclass
class FibLevels:
    level_0: float              # Range low (0%)
    level_25: float             # 25% - discount zone boundary
    level_50: float             # 50% - midpoint
    level_75: float             # 75% - premium zone boundary
    level_100: float            # Range high (100%)
    level_neg_20: float         # -20% (below range)
    level_120: float            # 120% (above range)

@dataclass
class Range:
    start_bar: int              # First bar of range
    end_bar: Optional[int]      # Last bar (None if still active)
    high: float                 # Range high price
    low: float                  # Range low price
    high_bar: int               # Bar that set the high
    low_bar: int                # Bar that set the low
    touches_high: list[int]     # Bars that touched the high
    touches_low: list[int]      # Bars that touched the low
    status: RangeStatus         # Active | BrokenUp | BrokenDown | Expired
    fib_levels: FibLevels       # Pre-calculated fib levels
```

### 5.5 Fibonacci Retracement Calculator

#### 5.5.1 Purpose
Calculates Fibonacci retracement levels between two price points.

#### 5.5.2 Configuration

```yaml
fib_retracement:
  # SOURCE POINTS
  from_point: "swing_low" | "candle_close" | "candle_low" | "custom"
  to_point: "swing_high" | "candle_close" | "candle_high" | "custom"

  # For custom points
  from_bar: 0                   # Bar index (if custom)
  from_price: 0.0               # Price (if custom)
  to_bar: 0
  to_price: 0.0

  # LEVELS TO CALCULATE
  levels: [0, 0.236, 0.382, 0.5, 0.618, 0.75, 0.786, 1.0, 1.272, 1.618]

  # Additional custom levels
  custom_levels: [-0.2, 1.2]    # For range invalidation zones

  # DIRECTION
  direction: "auto" | "up" | "down"  # Auto detects from price
```

#### 5.5.3 Output

```rust
struct FibRetracement {
    from_bar: usize,
    from_price: f64,
    to_bar: usize,
    to_price: f64,
    direction: Direction,       // Up (low to high) or Down (high to low)
    levels: HashMap<String, f64>, // "0.75" => 48500.00
}
```

### 5.6 Break of Structure (BOS) Detector

#### 5.6.1 Purpose
Detects when price breaks beyond a swing high/low, confirming trend continuation.

#### 5.6.2 Configuration

```yaml
bos:
  # SOURCE SWING
  swing_config: { ... }         # Which swing definition to use

  # BREAK REQUIREMENTS
  break_type: "wick" | "close"  # What constitutes a break?

  # For "close" type:
  close_requirements:
    full_body: false            # Require entire body beyond swing?
    # If false: just candle close beyond swing
    # If true: both open and close beyond swing

  # CONFIRMATION
  confirmation:
    require_follow_through: false  # Require next candle to continue?
    follow_through_bars: 1

  # OUTPUT
  mark_candle: "break" | "close"  # Which candle to mark as BOS?
  # "break" = the candle that first broke
  # "close" = the candle that confirmed with close
```

#### 5.6.3 Output

```rust
struct BOS {
    swing_bar: usize,           // The swing that was broken
    swing_price: f64,
    break_bar: usize,           // The candle that broke it
    break_price: f64,           // Price at break
    direction: Direction,       // Bullish (broke swing high) or Bearish (broke swing low)
    confirmed: bool,            // Whether confirmation requirements met
}
```

### 5.7 Market Structure Break (MSB) Detector

#### 5.7.1 Purpose
Detects when price breaks structure in the opposite direction of the current trend, signaling potential reversal.

#### 5.7.2 Configuration

```yaml
msb:
  # This is essentially a BOS in the opposite direction of the trend

  # TREND DETERMINATION
  trend_method: "swing_sequence" | "ma_direction" | "higher_highs_lows"

  # --- Method: swing_sequence ---
  swing_sequence:
    swing_config: { ... }
    # Uptrend = higher highs and higher lows
    # Downtrend = lower highs and lower lows

  # --- Method: ma_direction ---
  ma_direction:
    ma_type: "sma" | "ema"
    ma_period: 50
    # Uptrend = price above MA and MA rising
    # Downtrend = price below MA and MA falling

  # BREAK REQUIREMENTS
  break_type: "wick" | "close"

  # In uptrend: MSB = break below swing low
  # In downtrend: MSB = break above swing high
```

#### 5.7.3 Output

```rust
struct MSB {
    previous_trend: Trend,      // The trend before the break
    swing_bar: usize,           // The swing that was broken
    swing_price: f64,
    break_bar: usize,
    break_price: f64,
    new_trend: Trend,           // The implied new trend
}
```

### 5.8 False Breakout Detector

#### 5.8.1 Purpose
Detects when price wicks beyond a level but closes back inside, indicating a failed breakout / liquidity grab.

#### 5.8.2 Configuration

```yaml
false_breakout:
  # BOUNDARY SOURCE
  boundary_type: "range" | "swing" | "custom_level"

  # For range boundary
  range_config: { ... }
  boundary_side: "high" | "low" | "both"

  # For swing boundary
  swing_config: { ... }

  # For custom level
  custom_level: 50000.0

  # BREAK REQUIREMENTS
  break_requirements:
    min_break_distance: 0       # Minimum wick beyond level (% or ATR)
    min_break_distance_type: "percent" | "atr" | "ticks"
    max_break_distance: 999     # Maximum wick beyond (filters out real breakouts)

  # CLOSE REQUIREMENTS
  close_requirements:
    close_inside: true          # Body must close inside the range/level
    close_tolerance: 0          # How far inside? (0 = exactly inside)
    close_tolerance_type: "percent" | "atr"

  # CANDLE SHAPE (optional validation)
  candle_validation:
    require_rejection_wick: false  # Wick must be longer than body?
    min_wick_body_ratio: 1.5    # Wick length / body length
    require_close_in_range: true # Close must be in upper/lower % of candle
    close_range_percent: 50     # Close in upper 50% for bullish rejection
```

#### 5.8.3 Output

```rust
struct FalseBreakout {
    bar_index: usize,           // The false breakout candle
    boundary_price: f64,        // The level that was broken
    wick_extreme: f64,          // How far the wick went
    close_price: f64,           // Where the candle closed
    direction: Direction,       // Bullish (wick below, closed inside) or Bearish
    break_distance: f64,        // How far beyond the level
}
```

### 5.9 Liquidity Sweep Detector

#### 5.9.1 Purpose
Detects when price sweeps beyond a liquidity zone (cluster of wicks/stops) and reverses.

#### 5.9.2 Configuration

```yaml
liquidity_sweep:
  # LIQUIDITY ZONE DETECTION
  zone_detection:
    method: "wick_cluster" | "swing_wicks" | "custom_levels"

    # --- Method: wick_cluster ---
    wick_cluster:
      lookback_bars: 50
      min_wicks: 3              # Minimum wicks in cluster
      cluster_tolerance: 0.2    # % range for wicks to be considered clustered

    # --- Method: swing_wicks ---
    swing_wicks:
      swing_config: { ... }
      # Uses swing high/low wicks as liquidity zones

  # SWEEP REQUIREMENTS
  sweep_requirements:
    min_sweep_distance: 0.1     # Minimum distance beyond zone
    sweep_distance_type: "percent" | "atr"
    max_sweep_distance: 2.0     # Maximum (or it's a real breakout)

  # REVERSAL REQUIREMENTS
  reversal_requirements:
    must_close_inside: true     # Candle must close back inside
    reversal_candle_type: "same" | "next"  # Same candle or next candle reversal?

    # For next candle reversal
    next_candle:
      direction: "opposite"     # Must be opposite color
      min_size: 0.5             # Minimum candle size (% of sweep candle)

  # CONFIRMATION
  confirmation:
    require_ltf_msb: false      # Require MSB on lower timeframe?
    ltf_timeframe: "M5"
    ltf_msb_config: { ... }
```

#### 5.9.3 Output

```rust
struct LiquiditySweep {
    zone_price: f64,            // The liquidity zone that was swept
    zone_type: ZoneType,        // Highs | Lows
    sweep_bar: usize,           // The candle that swept
    sweep_extreme: f64,         // How far the sweep went
    reversal_bar: usize,        // The candle that confirmed reversal
    sweep_origin: Option<SweepOrigin>, // For LTF entry
}

struct SweepOrigin {
    bar_index: usize,           // Bar before MSB on LTF
    price: f64,                 // Entry level for retest
}
```

### 5.10 Interim High/Low Detector

#### 5.10.1 Purpose
Identifies the last candle of a particular direction before a move in the opposite direction.

#### 5.10.2 Configuration

```yaml
interim:
  # For interim high (last green before move down)
  interim_high:
    candle_color: "green"       # "green" (close > open) | "up" (close > prev_close)
    # Detected when: green candle followed by red candle

  # For interim low (last red before move up)
  interim_low:
    candle_color: "red"         # "red" (close < open) | "down" (close < prev_close)

  # PRICE REFERENCE
  price_reference: "close"      # Always use close for interim points

  # VALIDATION
  validation:
    min_follow_through: 1       # Minimum candles in new direction
    min_move_size: 0            # Minimum move size after interim (0 = disabled)
    move_size_type: "percent" | "atr"
```

#### 5.10.3 Output

```rust
struct InterimPoint {
    bar_index: usize,
    price: f64,                 // Close price
    point_type: InterimType,    // High | Low
}
```

---

## 6. Indicator Library

### 6.1 Overview

Indicators are mathematical calculations on price/volume data. Unlike patterns, they have **no ambiguity** - they're pure math.

### 6.2 Moving Averages

#### 6.2.1 Simple Moving Average (SMA)

```yaml
sma:
  period: 20                    # Number of bars
  source: "close"               # "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4"

  # hl2 = (high + low) / 2
  # hlc3 = (high + low + close) / 3
  # ohlc4 = (open + high + low + close) / 4
```

**Formula:** `SMA = sum(source, period) / period`

#### 6.2.2 Exponential Moving Average (EMA)

```yaml
ema:
  period: 20
  source: "close"
```

**Formula:**
```
k = 2 / (period + 1)
EMA = close * k + EMA_prev * (1 - k)
```

#### 6.2.3 Weighted Moving Average (WMA)

```yaml
wma:
  period: 20
  source: "close"
```

**Formula:** `WMA = sum(source[i] * weight[i]) / sum(weights)` where weight decreases linearly

#### 6.2.4 Hull Moving Average (HMA)

```yaml
hma:
  period: 20
  source: "close"
```

**Formula:** `HMA = WMA(2 * WMA(n/2) - WMA(n), sqrt(n))`

### 6.3 Oscillators

#### 6.3.1 Relative Strength Index (RSI)

```yaml
rsi:
  period: 14
  source: "close"

  # Overbought/Oversold levels (for conditions)
  overbought: 70
  oversold: 30
```

**Formula:**
```
RS = avg_gain(period) / avg_loss(period)
RSI = 100 - (100 / (1 + RS))
```

#### 6.3.2 Stochastic Oscillator

```yaml
stochastic:
  k_period: 14                  # %K period
  k_smoothing: 3                # %K smoothing
  d_period: 3                   # %D period (signal line)

  overbought: 80
  oversold: 20
```

**Formula:**
```
%K = 100 * (close - lowest_low(k_period)) / (highest_high(k_period) - lowest_low(k_period))
%D = SMA(%K, d_period)
```

#### 6.3.3 MACD

```yaml
macd:
  fast_period: 12
  slow_period: 26
  signal_period: 9
  source: "close"
```

**Outputs:**
- `macd_line` = EMA(fast) - EMA(slow)
- `signal_line` = EMA(macd_line, signal_period)
- `histogram` = macd_line - signal_line

### 6.4 Volatility Indicators

#### 6.4.1 Average True Range (ATR)

```yaml
atr:
  period: 14
```

**Formula:**
```
TR = max(high - low, abs(high - prev_close), abs(low - prev_close))
ATR = SMA(TR, period)  # or EMA depending on implementation
```

#### 6.4.2 Bollinger Bands

```yaml
bollinger_bands:
  period: 20
  std_dev: 2.0
  source: "close"
```

**Outputs:**
- `middle` = SMA(source, period)
- `upper` = middle + std_dev * stddev(source, period)
- `lower` = middle - std_dev * stddev(source, period)
- `width` = (upper - lower) / middle
- `percent_b` = (source - lower) / (upper - lower)

#### 6.4.3 Keltner Channels

```yaml
keltner:
  ema_period: 20
  atr_period: 10
  atr_multiplier: 2.0
```

**Outputs:**
- `middle` = EMA(close, ema_period)
- `upper` = middle + ATR * atr_multiplier
- `lower` = middle - ATR * atr_multiplier

### 6.5 Volume Indicators

#### 6.5.1 Volume SMA

```yaml
volume_sma:
  period: 20
```

**Formula:** `Volume_SMA = SMA(volume, period)`

#### 6.5.2 Volume Spike Detector

```yaml
volume_spike:
  lookback: 20                  # Period for average volume
  multiplier: 2.0               # Spike = volume > avg * multiplier
```

**Output:** Boolean - is current volume a spike?

#### 6.5.3 On-Balance Volume (OBV)

```yaml
obv: {}                         # No parameters
```

**Formula:**
```
if close > prev_close: OBV = OBV_prev + volume
if close < prev_close: OBV = OBV_prev - volume
if close == prev_close: OBV = OBV_prev
```

### 6.6 Trend Indicators

#### 6.6.1 ADX (Average Directional Index)

```yaml
adx:
  period: 14

  # Trend strength levels
  no_trend: 20
  trending: 25
  strong_trend: 50
```

**Outputs:**
- `adx` = trend strength (0-100)
- `plus_di` = positive directional indicator
- `minus_di` = negative directional indicator

#### 6.6.2 Supertrend

```yaml
supertrend:
  period: 10
  multiplier: 3.0
```

**Outputs:**
- `value` = supertrend line value
- `direction` = 1 (bullish) or -1 (bearish)

---

## 7. Condition Library

### 7.1 Overview

Conditions combine patterns and indicators into boolean (true/false) signals.

### 7.2 Comparison Conditions

```yaml
# Price above/below indicator
price_above:
  source: "close"               # What to compare
  target: "sma_20"              # Compare to what

price_below:
  source: "close"
  target: "sma_20"

# Indicator above/below value
indicator_above:
  indicator: "rsi_14"
  value: 70

indicator_below:
  indicator: "rsi_14"
  value: 30

# Indicator above/below another indicator
indicator_cross_above:
  indicator_a: "ema_12"
  indicator_b: "ema_26"
```

### 7.3 Crossover Conditions

```yaml
# A crosses above B
crossover:
  source_a: "ema_12"
  source_b: "ema_26"
  direction: "above"            # "above" | "below"

  # Optional: require confirmation
  confirmation:
    bars: 1                     # Must stay crossed for N bars
```

### 7.4 Divergence Conditions

```yaml
# Price makes lower low, indicator makes higher low (bullish divergence)
divergence:
  type: "bullish" | "bearish" | "hidden_bullish" | "hidden_bearish"
  price_source: "low"           # For bullish: compare lows
  indicator: "rsi_14"
  lookback: 20                  # Bars to look back for divergence
  min_swing_distance: 5         # Minimum bars between swings

  # Bullish: price lower low, indicator higher low
  # Bearish: price higher high, indicator lower high
  # Hidden bullish: price higher low, indicator lower low
  # Hidden bearish: price lower high, indicator higher high
```

### 7.5 Pattern Conditions

```yaml
# Check if a pattern exists
pattern_exists:
  pattern: "false_breakout"
  direction: "bullish"
  max_bars_ago: 3               # Pattern must have occurred within N bars

# Check if inside a pattern
inside_pattern:
  pattern: "range"
  zone: "discount"              # "discount" | "premium" | "any"
```

### 7.6 Combination Conditions

```yaml
# All conditions must be true
all:
  - pattern_exists: { pattern: "range" }
  - indicator_below: { indicator: "rsi_14", value: 30 }
  - price_above: { source: "close", target: "sma_200" }

# Any condition must be true
any:
  - crossover: { source_a: "ema_12", source_b: "ema_26", direction: "above" }
  - pattern_exists: { pattern: "false_breakout", direction: "bullish" }

# Condition must NOT be true
not:
  indicator_above: { indicator: "rsi_14", value: 70 }
```

### 7.7 Time/Bar Conditions

```yaml
# Bars since event
bars_since:
  event: "last_trade"           # "last_trade" | "last_signal" | "pattern_start"
  comparison: "greater_than"
  value: 10

# Time of day filter (for live trading)
time_filter:
  start_hour: 8
  end_hour: 16
  timezone: "UTC"
```

---

## 8. System Definition Format

### 8.1 Overview

A trading system is defined in YAML format, combining patterns, indicators, and conditions into a complete strategy.

### 8.2 Complete System Schema

```yaml
# ==============================================================================
# SYSTEM METADATA
# ==============================================================================
system:
  name: "System Name"
  version: "1.0.0"
  description: "Brief description of the strategy"
  author: "Your Name"
  created: "2026-01-05"

  # Tags for organization
  tags:
    - "mean_reversion"
    - "range_trading"
    - "M30"

# ==============================================================================
# MARKET CONFIGURATION
# ==============================================================================
market:
  # Assets to trade (can be multiple)
  assets:
    - "BTC"
    # - "ETH"
    # - "SOL"

  # Timeframe for signals
  timeframe: "M30"

  # Higher timeframe for context (optional)
  htf_context:
    enabled: false
    timeframe: "H4"

  # Lower timeframe for entries (optional)
  ltf_entry:
    enabled: false
    timeframe: "M5"

# ==============================================================================
# INDICATORS
# ==============================================================================
indicators:
  # Each indicator gets a unique ID for reference
  sma_200:
    type: "sma"
    period: 200
    source: "close"

  rsi_14:
    type: "rsi"
    period: 14

  atr_14:
    type: "atr"
    period: 14

  volume_avg:
    type: "volume_sma"
    period: 20

# ==============================================================================
# PATTERN DETECTORS
# ==============================================================================
patterns:
  # Swing detection
  swing_high:
    type: "swing_high"
    method: "combined"
    combined:
      consecutive_candles:
        count: 2
        direction: "green"
      touches:
        min_touches: 2
        touch_tolerance: 0.3
        touch_tolerance_type: "percent"
    price_reference: "wick"

  swing_low:
    type: "swing_low"
    method: "combined"
    combined:
      consecutive_candles:
        count: 2
        direction: "red"
      touches:
        min_touches: 2
        touch_tolerance: 0.3
        touch_tolerance_type: "percent"
    price_reference: "wick"

  # Range detection
  main_range:
    type: "range"
    method: "fib_retracement"
    fib_retracement:
      swing_high_config:
        $ref: "#/patterns/swing_high"
      swing_low_config:
        $ref: "#/patterns/swing_low"
      min_retracement: 0.75
      max_retracement: 1.00
      retracement_price: "close"
      range_high_source: "swing_high"
      range_low_source: "retracement_candle_close"
    updates:
      allow_expansion: true
      expansion_tolerance: 0.2
    invalidation:
      break_type: "close"
      break_threshold: 1.2
      break_threshold_low: -0.2

  # False breakout detection
  false_breakout:
    type: "false_breakout"
    boundary_type: "range"
    range_config:
      $ref: "#/patterns/main_range"
    boundary_side: "both"
    break_requirements:
      min_break_distance: 0
    close_requirements:
      close_inside: true

# ==============================================================================
# ENTRY RULES
# ==============================================================================
entry:
  # LONG ENTRY
  long:
    # All conditions must be true
    conditions:
      - pattern_exists:
          pattern: "main_range"

      - pattern_exists:
          pattern: "false_breakout"
          direction: "bullish"
          max_bars_ago: 0       # Must be current bar

      # Optional filters
      # - price_above:
      #     source: "close"
      #     target: "sma_200"

    # Entry timing
    timing:
      type: "next_candle_open"  # "current_candle_close" | "next_candle_open" | "limit_order"

      # For limit orders
      # limit_config:
      #   reference: "false_breakout_close"
      #   offset: 0

  # SHORT ENTRY
  short:
    conditions:
      - pattern_exists:
          pattern: "main_range"

      - pattern_exists:
          pattern: "false_breakout"
          direction: "bearish"
          max_bars_ago: 0

    timing:
      type: "next_candle_open"

# ==============================================================================
# EXIT RULES
# ==============================================================================
exit:
  # STOP LOSS
  stop_loss:
    # Method for calculating stop loss
    method: "pattern_based"     # "fixed_r" | "atr_based" | "pattern_based" | "swing_based"

    # --- Method: pattern_based ---
    pattern_based:
      reference: "false_breakout_wick"  # Use the wick of the false breakout
      offset: 1                  # Offset in ticks beyond the reference
      offset_type: "ticks"       # "ticks" | "percent" | "atr"

    # --- Method: atr_based ---
    # atr_based:
    #   atr_indicator: "atr_14"
    #   multiplier: 1.5
    #   from: "entry_price"

    # --- Method: swing_based ---
    # swing_based:
    #   swing_pattern: "swing_low"  # For longs
    #   offset: 1
    #   offset_type: "ticks"

    # --- Method: fixed ---
    # fixed:
    #   percent: 2.0              # 2% from entry

  # TAKE PROFIT
  take_profit:
    method: "pattern_based"     # "fixed_r" | "pattern_based" | "indicator_based"

    # --- Method: pattern_based ---
    pattern_based:
      reference: "range_high"    # For longs: range high
      # reference: "range_low"   # For shorts: range low
      offset: 0

    # --- Method: fixed_r ---
    # fixed_r:
    #   r_multiple: 2.0          # 2R take profit

    # --- Method: indicator_based ---
    # indicator_based:
    #   indicator: "bollinger_upper"  # Exit at upper BB

  # TRAILING STOP (optional)
  trailing_stop:
    enabled: false
    method: "atr"               # "atr" | "percent" | "swing"

    # atr_config:
    #   multiplier: 2.0
    #   activation_r: 1.0       # Activate after 1R profit

  # TIME-BASED EXIT (optional)
  time_exit:
    enabled: false
    max_bars: 20                # Exit after 20 bars if not hit SL/TP

# ==============================================================================
# FILTERS (Optional conditions that must be true for any trade)
# ==============================================================================
filters:
  # Global filters applied to all trades
  global:
    # Only trade when range is valid
    - pattern_exists:
        pattern: "main_range"

  # Long-only filters
  long:
    # Example: only long above 200 SMA
    # - price_above:
    #     source: "close"
    #     target: "sma_200"

  # Short-only filters
  short:
    # Example: only short below 200 SMA
    # - price_below:
    #     source: "close"
    #     target: "sma_200"

# ==============================================================================
# POSITION MANAGEMENT
# ==============================================================================
position:
  # Prevent multiple entries
  max_concurrent_trades: 1

  # Allow re-entry after exit?
  allow_reentry: true
  min_bars_between_trades: 1

  # Position sizing (for live trading)
  sizing:
    method: "fixed_risk"        # "fixed_risk" | "fixed_size" | "kelly"

    # --- Method: fixed_risk ---
    fixed_risk:
      risk_percent: 1.0         # Risk 1% of account per trade

    # --- Method: fixed_size ---
    # fixed_size:
    #   size_usd: 1000          # Always trade $1000

  # Leverage (for live trading)
  leverage:
    method: "auto"              # "auto" | "fixed"
    # Auto calculates required leverage based on position size and stop loss

    # fixed:
    #   value: 10               # Always use 10x

# ==============================================================================
# BACKTEST CONFIGURATION
# ==============================================================================
backtest:
  # Date range
  start_date: "2024-01-01"
  end_date: "2025-01-01"

  # Starting capital (for P&L calculation)
  initial_capital: 10000

  # Commission/fees
  commission:
    type: "percent"
    value: 0.05                 # 0.05% per trade (round trip = 0.1%)

  # Slippage simulation
  slippage:
    enabled: true
    type: "ticks"
    value: 1                    # 1 tick slippage per entry/exit
```

### 8.3 Reference Syntax

Systems can reference other parts of the config using `$ref`:

```yaml
patterns:
  swing_high:
    type: "swing_high"
    # ... config ...

  main_range:
    type: "range"
    fib_retracement:
      swing_high_config:
        $ref: "#/patterns/swing_high"  # References the swing_high config above
```

### 8.4 System Examples

#### 8.4.1 Simple 75% Mean Reversion

```yaml
system:
  name: "75% Mean Reversion"
  version: "1.0.0"
  description: "Enter on false breakout of 75% retracement range"

market:
  assets: ["BTC"]
  timeframe: "M30"

indicators:
  atr_14:
    type: "atr"
    period: 14

patterns:
  swing_high:
    type: "swing_high"
    method: "combined"
    combined:
      consecutive_candles: { count: 2, direction: "green" }
      touches: { min_touches: 2, touch_tolerance: 0.3 }
    price_reference: "wick"

  swing_low:
    type: "swing_low"
    method: "combined"
    combined:
      consecutive_candles: { count: 2, direction: "red" }
      touches: { min_touches: 2, touch_tolerance: 0.3 }
    price_reference: "wick"

  main_range:
    type: "range"
    method: "fib_retracement"
    fib_retracement:
      swing_high_config: { $ref: "#/patterns/swing_high" }
      swing_low_config: { $ref: "#/patterns/swing_low" }
      min_retracement: 0.75
      max_retracement: 1.00
      retracement_price: "close"
    invalidation:
      break_type: "close"
      break_threshold: 1.2
      break_threshold_low: -0.2

  false_breakout:
    type: "false_breakout"
    boundary_type: "range"
    range_config: { $ref: "#/patterns/main_range" }
    boundary_side: "both"

entry:
  long:
    conditions:
      - pattern_exists: { pattern: "main_range" }
      - pattern_exists: { pattern: "false_breakout", direction: "bullish", max_bars_ago: 0 }
    timing: { type: "next_candle_open" }

  short:
    conditions:
      - pattern_exists: { pattern: "main_range" }
      - pattern_exists: { pattern: "false_breakout", direction: "bearish", max_bars_ago: 0 }
    timing: { type: "next_candle_open" }

exit:
  stop_loss:
    method: "pattern_based"
    pattern_based:
      reference: "false_breakout_wick"
      offset: 1
      offset_type: "ticks"

  take_profit:
    method: "pattern_based"
    pattern_based:
      reference: "range_opposite"  # range_high for longs, range_low for shorts

position:
  max_concurrent_trades: 1
  sizing:
    method: "fixed_risk"
    fixed_risk: { risk_percent: 1.0 }

backtest:
  start_date: "2024-01-01"
  end_date: "2025-01-01"
  initial_capital: 10000
```

#### 8.4.2 Volume Breakout System

```yaml
system:
  name: "Volume Harmony Breakout"
  version: "1.0.0"
  description: "Trade breakouts with volume confirmation"

market:
  assets: ["BTC"]
  timeframe: "H1"

indicators:
  volume_avg:
    type: "volume_sma"
    period: 5

patterns:
  range:
    type: "range"
    method: "touch_based"
    touch_based:
      min_touches_high: 3
      min_touches_low: 3
      touch_tolerance: 0.5

  bos:
    type: "bos"
    swing_config: { $ref: "#/patterns/range" }
    break_type: "close"

entry:
  long:
    conditions:
      - pattern_exists: { pattern: "range" }
      - pattern_exists: { pattern: "bos", direction: "bullish", max_bars_ago: 0 }
      - indicator_above:
          indicator: "current_volume"
          target: "volume_avg"
    timing: { type: "next_candle_open" }

  short:
    conditions:
      - pattern_exists: { pattern: "range" }
      - pattern_exists: { pattern: "bos", direction: "bearish", max_bars_ago: 0 }
      - indicator_above:
          indicator: "current_volume"
          target: "volume_avg"
    timing: { type: "next_candle_open" }

exit:
  stop_loss:
    method: "pattern_based"
    pattern_based:
      reference: "range_opposite"  # Opposite side of range

  take_profit:
    method: "fixed_r"
    fixed_r: { r_multiple: 2.0 }

position:
  max_concurrent_trades: 1
```

---

## 9. Execution Engine

### 9.1 Signal Generation

The execution engine processes candle data and generates trading signals.

```python
from dataclasses import dataclass
from typing import Optional
from enum import Enum

class Direction(Enum):
    LONG = "long"
    SHORT = "short"

@dataclass
class Signal:
    direction: Optional[Direction]  # None = no signal
    entry_price: float = 0
    stop_loss: float = 0
    take_profit: float = 0
    bar_index: int = 0

def process_bar(
    candles: pd.DataFrame,
    current_index: int,
    system: dict,  # Parsed YAML config
    state: dict,   # Engine state (indicators, patterns, position)
) -> Signal:
    """
    Process a single bar and return any trading signal.

    1. Update all indicators
    2. Update all pattern detectors
    3. Check entry conditions
    4. If entry conditions met, calculate entry/SL/TP
    5. Return signal
    """
    # Update indicators (ta-lib)
    state['indicators'] = update_indicators(candles, system['indicators'])

    # Update pattern detectors
    state['patterns'] = update_patterns(candles, current_index, system['patterns'])

    # Check entry conditions
    if check_entry_conditions(state, system['entry']['long']):
        return calculate_long_signal(candles, current_index, state, system)
    elif check_entry_conditions(state, system['entry']['short']):
        return calculate_short_signal(candles, current_index, state, system)

    return Signal(direction=None)  # No signal
```

### 9.2 Position State Machine

```
                    ┌─────────────┐
                    │   NO_POS    │
                    └──────┬──────┘
                           │
                    Entry Signal
                           │
                           ▼
                    ┌─────────────┐
          ┌────────│   IN_POS    │────────┐
          │        └──────┬──────┘        │
          │               │               │
      SL Hit          TP Hit         Time Exit
          │               │               │
          ▼               ▼               ▼
    ┌─────────┐     ┌─────────┐     ┌─────────┐
    │  LOSS   │     │   WIN   │     │ TIMEOUT │
    └────┬────┘     └────┬────┘     └────┬────┘
         │               │               │
         └───────────────┴───────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │   NO_POS    │ (ready for next trade)
                  └─────────────┘
```

### 9.3 Entry Price Calculation

```rust
fn calculate_entry_price(
    timing: &EntryTiming,
    signal_bar: &Candle,
    next_bar: Option<&Candle>,
) -> f64 {
    match timing.type {
        "current_candle_close" => signal_bar.close,
        "next_candle_open" => next_bar.unwrap().open,
        "limit_order" => calculate_limit_price(timing.limit_config),
    }
}
```

### 9.4 Stop Loss Calculation

```rust
fn calculate_stop_loss(
    config: &StopLossConfig,
    entry_price: f64,
    direction: Direction,
    patterns: &PatternState,
    indicators: &IndicatorState,
) -> f64 {
    match config.method {
        "pattern_based" => {
            let reference_price = get_pattern_reference(
                config.pattern_based.reference,
                patterns,
            );
            apply_offset(reference_price, config.pattern_based.offset, direction)
        },
        "atr_based" => {
            let atr = indicators.get(config.atr_based.atr_indicator);
            match direction {
                Long => entry_price - (atr * config.atr_based.multiplier),
                Short => entry_price + (atr * config.atr_based.multiplier),
            }
        },
        "fixed" => {
            let offset = entry_price * (config.fixed.percent / 100.0);
            match direction {
                Long => entry_price - offset,
                Short => entry_price + offset,
            }
        },
    }
}
```

### 9.5 Take Profit Calculation

```rust
fn calculate_take_profit(
    config: &TakeProfitConfig,
    entry_price: f64,
    stop_loss: f64,
    direction: Direction,
    patterns: &PatternState,
) -> f64 {
    match config.method {
        "pattern_based" => {
            get_pattern_reference(config.pattern_based.reference, patterns)
        },
        "fixed_r" => {
            let risk = (entry_price - stop_loss).abs();
            let reward = risk * config.fixed_r.r_multiple;
            match direction {
                Long => entry_price + reward,
                Short => entry_price - reward,
            }
        },
    }
}
```

---

## 10. Backtesting Engine

### 10.1 Overview

The backtesting engine replays historical data and simulates trade execution.

### 10.2 Backtest Flow

```
Load Historical Data
        │
        ▼
Initialize Engine State
        │
        ▼
┌───────────────────┐
│ For each candle:  │◄─────────────────┐
├───────────────────┤                  │
│ 1. Update indicators                 │
│ 2. Update patterns                   │
│ 3. Check for SL/TP hit (if in pos)   │
│ 4. Check entry conditions            │
│ 5. Record results                    │
└───────────┬───────┘                  │
            │                          │
            └──────────────────────────┘
            │
            ▼
    Calculate Statistics
            │
            ▼
    Generate Report
```

### 10.3 Trade Recording

```rust
struct Trade {
    id: u64,
    direction: Direction,

    // Entry
    entry_bar: usize,
    entry_time: DateTime,
    entry_price: f64,
    entry_reason: String,       // "false_breakout_long", etc.

    // Exit
    exit_bar: usize,
    exit_time: DateTime,
    exit_price: f64,
    exit_reason: ExitReason,    // StopLoss | TakeProfit | TimeExit | Manual

    // Results
    pnl_percent: f64,
    pnl_r: f64,                 // P&L in R multiples

    // Context
    stop_loss: f64,
    take_profit: f64,
    risk_amount: f64,
    position_size: f64,
}

enum ExitReason {
    StopLoss,
    TakeProfit,
    TimeExit,
    TrailingStop,
    Manual,
}
```

### 10.4 SL/TP Hit Detection

**Important**: Must check if SL/TP was hit WITHIN the candle, not just at close.

```rust
fn check_exit(
    position: &Position,
    candle: &Candle,
) -> Option<ExitReason> {
    match position.direction {
        Long => {
            // For longs: check if low hit SL or high hit TP
            if candle.low <= position.stop_loss {
                // Check which was hit first if both could have hit
                if candle.high >= position.take_profit {
                    // Both SL and TP could have been hit
                    // Assume worst case: SL hit first (conservative)
                    // Or use candle open to determine likely order
                    determine_exit_order(position, candle)
                } else {
                    Some(ExitReason::StopLoss)
                }
            } else if candle.high >= position.take_profit {
                Some(ExitReason::TakeProfit)
            } else {
                None
            }
        },
        Short => {
            // For shorts: check if high hit SL or low hit TP
            if candle.high >= position.stop_loss {
                if candle.low <= position.take_profit {
                    determine_exit_order(position, candle)
                } else {
                    Some(ExitReason::StopLoss)
                }
            } else if candle.low <= position.take_profit {
                Some(ExitReason::TakeProfit)
            } else {
                None
            }
        },
    }
}

fn determine_exit_order(position: &Position, candle: &Candle) -> ExitReason {
    // If candle opened closer to SL, likely SL hit first
    // This is an approximation - real tick data would be needed for certainty
    let distance_to_sl = (candle.open - position.stop_loss).abs();
    let distance_to_tp = (candle.open - position.take_profit).abs();

    if distance_to_sl < distance_to_tp {
        ExitReason::StopLoss  // SL was closer, likely hit first
    } else {
        ExitReason::TakeProfit
    }
}
```

### 10.5 Slippage & Commission

```rust
fn apply_slippage(price: f64, direction: Direction, is_entry: bool) -> f64 {
    // Slippage works against us
    match (direction, is_entry) {
        (Long, true) => price + slippage,   // Enter long at worse price
        (Long, false) => price - slippage,  // Exit long at worse price
        (Short, true) => price - slippage,  // Enter short at worse price
        (Short, false) => price + slippage, // Exit short at worse price
    }
}

fn apply_commission(pnl: f64, position_size: f64, commission_percent: f64) -> f64 {
    let commission = position_size * (commission_percent / 100.0) * 2.0; // Round trip
    pnl - commission
}
```

---

## 11. Live Trading Engine

### 11.1 Overview

The live trading engine uses the SAME signal generation logic as backtesting, but executes real orders on Hyperliquid.

### 11.2 Live Trading Flow

```
Subscribe to Real-Time Data
            │
            ▼
┌───────────────────────┐
│  On New Candle Close: │◄────────────────┐
├───────────────────────┤                 │
│ 1. Update indicators                    │
│ 2. Update patterns                      │
│ 3. Check for signals                    │
│ 4. If signal & no position:             │
│    → Calculate size                     │
│    → Place entry order                  │
│    → Place SL/TP orders                 │
│ 5. If in position:                      │
│    → Monitor SL/TP                      │
│    → Update trailing stop if needed     │
└───────────┬───────────┘                 │
            │                             │
            └─────────────────────────────┘
```

### 11.3 Order Management

```rust
struct LivePosition {
    entry_order_id: String,
    stop_loss_order_id: String,
    take_profit_order_id: String,

    entry_filled: bool,
    entry_fill_price: f64,

    // Calculated from risk management
    position_size: f64,
    leverage: f64,
}

async fn execute_entry_signal(
    signal: &Signal,
    account: &HyperliquidAccount,
    config: &PositionConfig,
) -> Result<LivePosition> {
    // 1. Calculate position size based on risk
    let risk_amount = account.equity * (config.risk_percent / 100.0);
    let stop_distance = (signal.entry_price - signal.stop_loss).abs();
    let position_size = risk_amount / stop_distance;

    // 2. Calculate required leverage
    let notional = position_size * signal.entry_price;
    let leverage = notional / account.available_margin;

    // 3. Place entry order
    let entry_order = place_market_order(
        signal.direction,
        position_size,
        leverage,
    ).await?;

    // 4. Place stop loss order
    let sl_order = place_stop_order(
        signal.direction.opposite(),
        position_size,
        signal.stop_loss,
    ).await?;

    // 5. Place take profit order
    let tp_order = place_limit_order(
        signal.direction.opposite(),
        position_size,
        signal.take_profit,
    ).await?;

    Ok(LivePosition {
        entry_order_id: entry_order.id,
        stop_loss_order_id: sl_order.id,
        take_profit_order_id: tp_order.id,
        // ...
    })
}
```

### 11.4 Integration with Existing App

The live trading engine integrates with the existing Hyperliquid Trader app:

```rust
// In lib.rs, add new commands:

#[tauri::command]
async fn start_live_system(
    system_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Load system config
    // Start live trading loop
    // Store reference in app state
}

#[tauri::command]
async fn stop_live_system(
    system_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Stop live trading loop
    // Close any open positions (optional)
}

#[tauri::command]
async fn get_live_system_status(
    system_id: String,
    state: State<'_, AppState>,
) -> Result<SystemStatus, String> {
    // Return current state, position info, etc.
}
```

---

## 12. Results & Analytics

### 12.1 Core Metrics

```rust
struct BacktestResults {
    // Trade counts
    total_trades: u32,
    winning_trades: u32,
    losing_trades: u32,

    // Win rate
    win_rate: f64,              // winning_trades / total_trades

    // R metrics
    total_r: f64,               // Sum of all R
    average_r: f64,             // total_r / total_trades
    average_winner_r: f64,      // Average R of winners
    average_loser_r: f64,       // Average R of losers (negative)
    largest_winner_r: f64,
    largest_loser_r: f64,

    // Expectancy
    expectancy: f64,            // (win_rate * avg_winner) + ((1 - win_rate) * avg_loser)

    // P&L
    total_pnl_percent: f64,
    total_pnl_usd: f64,

    // Drawdown
    max_drawdown_percent: f64,
    max_drawdown_r: f64,

    // Streaks
    max_consecutive_wins: u32,
    max_consecutive_losses: u32,

    // Time
    average_trade_duration_bars: f64,
    average_winner_duration_bars: f64,
    average_loser_duration_bars: f64,

    // Distribution
    long_trades: u32,
    short_trades: u32,
    long_win_rate: f64,
    short_win_rate: f64,
}
```

### 12.2 Equity Curve

```rust
struct EquityPoint {
    bar_index: usize,
    timestamp: DateTime,
    equity: f64,
    drawdown_percent: f64,
    trade_id: Option<u64>,      // If this point corresponds to a trade
}

fn calculate_equity_curve(
    trades: &[Trade],
    initial_capital: f64,
) -> Vec<EquityPoint> {
    // Calculate running equity after each trade
}
```

### 12.3 Trade Distribution Analysis

```rust
struct TradeDistribution {
    // R distribution
    r_histogram: Vec<(f64, u32)>,  // (R value bucket, count)

    // Time distribution
    by_hour: HashMap<u8, TradeStats>,    // Performance by hour of day
    by_day: HashMap<Weekday, TradeStats>, // Performance by day of week
    by_month: HashMap<u8, TradeStats>,   // Performance by month

    // Duration distribution
    duration_histogram: Vec<(u32, u32)>,  // (duration in bars, count)
}
```

### 12.4 Report Generation

```rust
struct BacktestReport {
    // Summary
    results: BacktestResults,

    // Trades
    trades: Vec<Trade>,

    // Equity curve data
    equity_curve: Vec<EquityPoint>,

    // Charts data
    trade_distribution: TradeDistribution,

    // System config (for reproducibility)
    system_config: SystemConfig,

    // Data info
    asset: String,
    timeframe: String,
    start_date: DateTime,
    end_date: DateTime,
    total_bars: usize,
}
```

---

## 13. User Interface

### 13.1 Systems Tab Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Hyperliquid Trader                                        [—][□][×]   │
├─────────────────────────────────────────────────────────────────────────┤
│  [Dashboard]  [Trade]  [Withdraw]  [Systems]  [Settings]               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │ MY SYSTEMS          │  │                                         │  │
│  │                     │  │  System: 75% Mean Reversion             │  │
│  │ ┌─────────────────┐ │  │  Asset: BTC  |  Timeframe: M30          │  │
│  │ │ 75% Mean Rev    │ │  │                                         │  │
│  │ │ ✓ Backtested    │ │  │  ┌─────────────────────────────────┐   │  │
│  │ │ Win: 52% | 1.4R │ │  │  │     BACKTEST RESULTS            │   │  │
│  │ └─────────────────┘ │  │  ├─────────────────────────────────┤   │  │
│  │                     │  │  │ Total Trades:     127            │   │  │
│  │ ┌─────────────────┐ │  │  │ Win Rate:         52.0%          │   │  │
│  │ │ BOS Breakout    │ │  │  │ Avg Winner:       2.1R           │   │  │
│  │ │ ○ Not tested    │ │  │  │ Avg Loser:       -1.0R           │   │  │
│  │ └─────────────────┘ │  │  │ Expectancy:      +0.54R          │   │  │
│  │                     │  │  │ Max Drawdown:    -12.3%          │   │  │
│  │ ┌─────────────────┐ │  │  └─────────────────────────────────┘   │  │
│  │ │ Liquidity Sweep │ │  │                                         │  │
│  │ │ ● LIVE          │ │  │  [Run Backtest]  [Go Live]  [Edit]      │  │
│  │ └─────────────────┘ │  │                                         │  │
│  │                     │  │  ─────────────────────────────────────  │  │
│  │ [+ New System]      │  │                                         │  │
│  │ [Import YAML]       │  │  EQUITY CURVE                           │  │
│  │                     │  │  ┌─────────────────────────────────┐   │  │
│  └─────────────────────┘  │  │    ╱╲                            │   │  │
│                           │  │   ╱  ╲   ╱╲    ╱╲                │   │  │
│                           │  │  ╱    ╲_╱  ╲__╱  ╲___╱╲__        │   │  │
│                           │  │ ╱                        ╲       │   │  │
│                           │  └─────────────────────────────────┘   │  │
│                           │                                         │  │
│                           │  RECENT TRADES                          │  │
│                           │  ┌─────────────────────────────────┐   │  │
│                           │  │ #127 LONG  +1.8R  Entry: 97,450 │   │  │
│                           │  │ #126 SHORT -1.0R  Entry: 98,200 │   │  │
│                           │  │ #125 LONG  +2.1R  Entry: 96,800 │   │  │
│                           │  │ [View All Trades]                │   │  │
│                           │  └─────────────────────────────────┘   │  │
│                           └─────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 13.2 System Editor

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Edit System: 75% Mean Reversion                              [×]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [General] [Patterns] [Indicators] [Entry] [Exit] [Filters] [YAML]     │
│  ─────────────────────────────────────────────────────────────────     │
│                                                                         │
│  PATTERNS TAB:                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Swing High Detection                                      [?]   │   │
│  │ ┌───────────────────────────────────────────────────────────┐   │   │
│  │ │ Method:        [Combined                          ▼]      │   │   │
│  │ │                                                           │   │   │
│  │ │ Consecutive Candles:                                      │   │   │
│  │ │   Count:       [2    ]  Direction: [Green           ▼]   │   │   │
│  │ │   Allow Doji:  [✓]     Doji Threshold: [0.1  ]%          │   │   │
│  │ │                                                           │   │   │
│  │ │ Touch Requirements:                                       │   │   │
│  │ │   Min Touches: [2    ]  Tolerance: [0.3  ]%              │   │   │
│  │ │   Max Bars Between: [50   ]                              │   │   │
│  │ │                                                           │   │   │
│  │ │ Price Reference: [Wick                            ▼]      │   │   │
│  │ └───────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │ Range Detection                                           [?]   │   │
│  │ ┌───────────────────────────────────────────────────────────┐   │   │
│  │ │ Method:        [Fib Retracement                   ▼]      │   │   │
│  │ │                                                           │   │   │
│  │ │ Retracement Level:                                        │   │   │
│  │ │   Min: [0.75 ]  Max: [1.00 ]                             │   │   │
│  │ │   Price Type: [Close                              ▼]      │   │   │
│  │ │                                                           │   │   │
│  │ │ Invalidation:                                             │   │   │
│  │ │   Break Type: [Close                              ▼]      │   │   │
│  │ │   Upper Threshold: [1.2  ]  Lower: [-0.2 ]               │   │   │
│  │ └───────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                        [Cancel]  [Save]  [Save & Test] │
└─────────────────────────────────────────────────────────────────────────┘
```

### 13.3 Trade Viewer / Chart

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Trade #127 - LONG BTC                                        [×]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Entry: $97,450 @ 2024-12-15 14:30                                     │
│  Exit:  $98,230 @ 2024-12-15 18:00  (TP Hit)                          │
│  Result: +1.8R (+$156.40)                                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  99000 ─┼─────────────────────────────────────────────────────  │   │
│  │         │                     ┌──── TP: 98,230                  │   │
│  │  98500 ─┼───────────────────▓▓────────────────────────────────  │   │
│  │         │              ╱▓▓▓▓                                    │   │
│  │  98000 ─┼────────────▓▓──────────────────────────────────────  │   │
│  │         │          ╱▓                                           │   │
│  │  97500 ─┼────────▓◄─────── Entry: 97,450                       │   │
│  │         │      ▓▓│                                              │   │
│  │  97000 ─┼────▓▓──┼────────────────────────────────────────────  │   │
│  │         │   ▓    └──── Range Low (false breakout)               │   │
│  │  96500 ─┼──╳─────────── SL: 96,820                             │   │
│  │         │                                                        │   │
│  │  96000 ─┼─────────────────────────────────────────────────────  │   │
│  │         │    │    │    │    │    │    │    │    │    │         │   │
│  │         └────┴────┴────┴────┴────┴────┴────┴────┴────┴────     │   │
│  │              14:00      15:00      16:00      17:00      18:00   │   │
│  │                                                                  │   │
│  │  Legend: ▓ Price  ◄ Entry  ╳ Stop Loss  ─ Range/Levels          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [◄ Prev Trade]                                        [Next Trade ►]  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 13.4 Live System Monitor

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LIVE: 75% Mean Reversion - BTC M30                           [×]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Status: ● RUNNING                           [Pause]  [Stop]           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ CURRENT POSITION                                                 │   │
│  │ Direction: LONG                                                  │   │
│  │ Entry: $97,450                                                   │   │
│  │ Current: $97,890 (+0.45%)                                       │   │
│  │ SL: $96,820 (-0.65%)                                            │   │
│  │ TP: $98,650 (+1.23%)                                            │   │
│  │                                                                  │   │
│  │ Unrealized P&L: +$88.00 (+0.44R)                                │   │
│  │ Time in Trade: 2h 15m                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  SESSION STATS                                                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐           │
│  │ Trades: 3       │ │ Win Rate: 66%   │ │ Total R: +2.4   │           │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘           │
│                                                                         │
│  ACTIVITY LOG                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 14:30  Signal: LONG detected                                    │   │
│  │ 14:30  Order placed: Market buy 0.5 BTC @ ~97,450               │   │
│  │ 14:30  Order filled: 0.5 BTC @ 97,452                           │   │
│  │ 14:30  SL order placed: Stop sell @ 96,820                      │   │
│  │ 14:30  TP order placed: Limit sell @ 98,650                     │   │
│  │ 14:31  Position opened successfully                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal**: Core infrastructure and data layer

- [ ] Set up Rust module structure for systems engine
- [ ] Implement OHLCV data structures
- [ ] Implement Hyperliquid historical data fetching
- [ ] Implement local SQLite caching
- [ ] Implement candle aggregation (M1 → M5 → M15 → etc.)
- [ ] Write unit tests for data layer

**Deliverable**: Can fetch and store historical BTC data for all timeframes

### Phase 2: Indicators (Week 2-3)

**Goal**: Complete indicator library

- [ ] Implement SMA, EMA, WMA, HMA
- [ ] Implement RSI
- [ ] Implement MACD
- [ ] Implement Bollinger Bands
- [ ] Implement ATR
- [ ] Implement Volume indicators
- [ ] Implement Stochastic
- [ ] Write unit tests with known values

**Deliverable**: All indicators calculating correctly, verified against TradingView

### Phase 3: Pattern Detectors (Week 3-5)

**Goal**: Core pattern detection library

- [ ] Implement Swing High detector (all methods)
- [ ] Implement Swing Low detector (all methods)
- [ ] Implement Range detector (all methods)
- [ ] Implement Fibonacci calculator
- [ ] Implement BOS detector
- [ ] Implement MSB detector
- [ ] Implement False Breakout detector
- [ ] Implement Interim High/Low detector
- [ ] Write extensive tests with manual chart examples
- [ ] Build visual verification tool

**Deliverable**: All patterns detecting correctly, visually verified against manual analysis

### Phase 4: System Engine (Week 5-6)

**Goal**: System definition and execution

- [ ] Implement YAML parser for system configs
- [ ] Implement condition evaluator
- [ ] Implement signal generator
- [ ] Implement position state machine
- [ ] Implement entry/exit price calculations
- [ ] Write integration tests

**Deliverable**: Can load a system config and generate signals from candle data

### Phase 5: Backtesting (Week 6-7)

**Goal**: Complete backtesting engine

- [ ] Implement backtest runner
- [ ] Implement trade recording
- [ ] Implement SL/TP hit detection
- [ ] Implement slippage/commission
- [ ] Implement results calculator
- [ ] Implement equity curve calculation
- [ ] Write backtest tests with known outcomes

**Deliverable**: Can run backtests and get accurate results

### Phase 6: UI Integration (Week 7-8)

**Goal**: Systems tab in Hyperliquid Trader app

- [ ] Create Systems tab in React UI
- [ ] Implement system list view
- [ ] Implement system editor UI
- [ ] Implement backtest results view
- [ ] Implement trade list view
- [ ] Implement equity curve chart
- [ ] Implement trade detail chart

**Deliverable**: Can create, edit, backtest systems from the app UI

### Phase 7: Live Trading (Week 8-9)

**Goal**: Live trading integration

- [ ] Implement real-time data subscription
- [ ] Implement live signal generation
- [ ] Implement order execution (using existing code)
- [ ] Implement position monitoring
- [ ] Implement live system UI
- [ ] Implement activity logging

**Deliverable**: Can run systems live on Hyperliquid

### Phase 8: Polish & Testing (Week 9-10)

**Goal**: Production ready

- [ ] Comprehensive testing with multiple systems
- [ ] Performance optimization
- [ ] Error handling and recovery
- [ ] Documentation
- [ ] User testing and feedback
- [ ] Bug fixes

**Deliverable**: Stable, production-ready systems engine

---

## 15. Known Challenges & Edge Cases

### 15.1 Pattern Detection Challenges

#### Swing Detection Ambiguity

**Problem**: "2 consecutive green candles" has edge cases
- What if there's a doji?
- What counts as "green"? close > open or close > prev_close?

**Solution**: Make it configurable:
```yaml
consecutive_candles:
  direction: "green"  # close > open
  # OR
  direction: "up"     # close > prev_close
  allow_doji: true
  doji_threshold: 0.1  # Body must be < 0.1% of range to count as doji
```

#### Range Boundary Updates

**Problem**: Price pushes beyond range but comes back - is it still a range?

**Solution**: Configurable expansion tolerance:
```yaml
updates:
  allow_expansion: true
  expansion_tolerance: 0.2  # Can go to 1.2 or -0.2 and still be valid range
```

### 15.2 Execution Challenges

#### Same-Bar Entry

**Problem**: If signal fires on bar N, do we enter on bar N close or bar N+1 open?

**Solution**: Explicit configuration:
```yaml
timing:
  type: "next_candle_open"  # Always enter on next bar
  # OR
  type: "current_candle_close"  # Enter on signal bar
```

#### SL/TP Within Same Bar

**Problem**: If a bar's range encompasses both SL and TP, which triggered first?

**Solution**:
1. Use candle open to estimate which was hit first
2. For conservative backtesting, assume SL hit first
3. Make this configurable:
```yaml
backtest:
  sl_tp_same_bar: "assume_sl"  # Conservative
  # OR
  sl_tp_same_bar: "use_open_proximity"  # Use distance from open
```

### 15.3 Live Trading Challenges

#### Order Execution Latency

**Problem**: Market moves between signal and order fill

**Solution**:
1. Include slippage estimation in backtest
2. Use limit orders where possible
3. Validate fill price vs expected price
4. Alert if slippage exceeds threshold

#### API Failures

**Problem**: Order placement can fail

**Solution**:
1. Retry logic with exponential backoff
2. Store pending orders for recovery
3. Alert user on persistent failures
4. Never leave position without SL

### 15.4 Data Challenges

#### Missing Candles

**Problem**: Historical data may have gaps

**Solution**:
1. Detect gaps on data load
2. Option to interpolate or skip
3. Log warnings for significant gaps

#### Timeframe Aggregation

**Problem**: M1 candles may not align perfectly to M30 boundaries

**Solution**:
1. Use timestamp-based aggregation
2. Handle incomplete current candle separately
3. Validate aggregated candles match exchange data

---

## 16. Appendix: Previous Automation Failure Analysis

### 16.1 The Failed System

**Strategy**: 75% Mean Reversion V-Shape
**Asset**: BTC
**Timeframe**: M30
**Implementation**: Pine Script (~574 lines)

### 16.2 Bug-by-Bug Analysis

#### Bug 1: Early Exit Logic

**What happened**: Code closed positions when "Range Ended" (price invalidated the range) instead of letting trades run to SL/TP.

**Manual behavior**: Hold through range invalidation - exit only on SL or TP.

**Fix in new system**:
```yaml
exit:
  # Only these exit methods - no "range_ended" condition
  stop_loss: { ... }
  take_profit: { ... }
```

#### Bug 2: Same-Candle Entry

**What happened**: Code entered on the same candle as false breakout detection.

**Manual behavior**: Enter on NEXT candle after false breakout.

**Fix in new system**:
```yaml
entry:
  timing:
    type: "next_candle_open"  # Explicit: always next candle
```

#### Bug 3: Entry Price Reference

**What happened**: Used `open` of entry candle instead of `close[1]` of false breakout candle.

**Manual behavior**: Entry price is the open of the candle after false breakout.

**Fix in new system**:
```yaml
# Entry timing handles this - "next_candle_open" uses the open of the next candle
# The false breakout reference is only for SL calculation
```

#### Bug 4: No Trade Validation

**What happened**: Allowed trades where TP was in wrong direction (below entry for longs).

**Manual behavior**: TP must be above entry for longs, below for shorts.

**Fix in new system**:
```rust
// In execution engine:
fn validate_trade(signal: &Signal) -> bool {
    match signal.direction {
        Long => signal.take_profit > signal.entry_price,
        Short => signal.take_profit < signal.entry_price,
    }
}
```

#### Bug 5: Multiple Simultaneous Entries

**What happened**: 6 trades opened at exact same time and price.

**Manual behavior**: One position at a time.

**Fix in new system**:
```yaml
position:
  max_concurrent_trades: 1  # Enforced by state machine
```

#### Bug 6: Swing Detection Too Loose

**What happened**: 1,558 trades found vs ~50-100 expected. 94% shorts.

**Manual behavior**: Swings require 2+ consecutive candles AND 2 touches.

**Fix in new system**:
```yaml
swing_high:
  method: "combined"  # Requires BOTH conditions
  combined:
    consecutive_candles: { count: 2 }
    touches: { min_touches: 2 }
```

### 16.3 Lessons Learned

1. **Every rule must be explicit** - No "obvious" behavior assumed
2. **Entry timing is critical** - "next candle" vs "current candle" changes everything
3. **State management** - Must track position state properly
4. **Validation at every step** - Check that SL/TP make sense before entering
5. **Configurable everything** - What works for one system may not work for another

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-draft | 2026-01-05 | Initial specification |

---

## Next Steps

1. Review this specification
2. Clarify any ambiguous pattern definitions
3. Prioritize which patterns to implement first
4. Begin Phase 1 implementation

---

*This document is the single source of truth for the Trading Systems Engine. All implementation decisions should reference this specification.*
