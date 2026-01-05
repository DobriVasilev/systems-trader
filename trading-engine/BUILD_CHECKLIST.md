# Trading Systems Engine - COMPLETE Build Checklist

**Started:** 2026-01-05
**Status:** In Progress
**Last Updated:** 2026-01-05

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Pattern Detectors | 24 | 0/24 |
| Indicators | 17 | 0/17 |
| Conditions | 8 | 0/8 |
| Trading Systems | 6 | 0/6 |

---

## Project Structure

```
trading-engine/
├── BUILD_CHECKLIST.md      # This file
├── requirements.txt        # Python dependencies
│
├── data/
│   ├── __init__.py
│   ├── models.py           # Core data models
│   ├── fetcher.py          # Hyperliquid API data fetching
│   └── storage.py          # SQLite storage
│
├── patterns/               # Pattern detectors (24 total)
│   ├── __init__.py
│   ├── swing.py            # Swing High/Low, HH/HL/LH/LL
│   ├── interim.py          # Interim High/Low
│   ├── structure.py        # BOS, MSB/CHOCH, Failed Retest
│   ├── range.py            # Range detection, Discount/Premium zones
│   ├── fib.py              # Fibonacci calculations
│   ├── breakout.py         # False Breakout, Impulse Candles
│   ├── liquidity.py        # Liquidity Sweep, Liquidity Zones
│   ├── candles.py          # Candle patterns (engulfing, etc.)
│   └── doubles.py          # Double Top/Bottom, Equal Highs/Lows
│
├── indicators/             # Technical indicators (17 total)
│   ├── __init__.py
│   ├── moving_averages.py  # SMA, EMA (all periods)
│   ├── vwap.py             # VWAP with bands and slope
│   ├── oscillators.py      # RSI, Stochastic, MACD
│   ├── volatility.py       # ATR, Bollinger Bands
│   ├── volume.py           # Volume SMA, Spike, Divergence, CVD, OI
│   ├── volume_profile.py   # VAH, VAL, POC
│   └── trend.py            # ADX, Supertrend
│
├── conditions/             # Condition evaluators (8 total)
│   ├── __init__.py
│   ├── comparisons.py      # Above/below, crossover
│   ├── divergence.py       # RSI/price, Volume divergence
│   ├── volume_confirm.py   # Volume confirmation rules
│   └── combinations.py     # AND/OR/NOT logic
│
├── systems/                # Pre-built trading systems (6 total)
│   ├── __init__.py
│   ├── breakout_bos.py     # System #1: Breakout Trading
│   ├── mean_reversion.py   # System #2: 75% Mean Reversion
│   ├── failed_retest.py    # System #3: Failed Retest of BOS
│   ├── volume_harmony.py   # System #4: Volume Harmony Breakout
│   ├── liquidity_sweep.py  # System #5: Liquidity Sweep Range Trade
│   └── vwap_fb.py          # System #6: 15M VWAP False Breakout
│
├── engine/                 # Core execution
│   ├── __init__.py
│   ├── parser.py           # YAML system parser
│   ├── backtest.py         # Backtest runner
│   ├── live.py             # Live trading runner
│   ├── signals.py          # Signal generation
│   └── position.py         # Position management
│
├── utils/
│   └── __init__.py
│
└── tests/
    └── __init__.py
```

---

## PHASE 1: FOUNDATION

### Setup
- [x] Create project structure
- [x] Create requirements.txt
- [x] Create base data models
- [ ] Set up SQLite storage
- [ ] Set up Hyperliquid data fetcher
- [ ] Test: Fetch BTC M30 candles for 1 year

---

## PHASE 2: PATTERN DETECTORS (24 Total) - THE HARD PART

### 2.1 Swing Detection
| # | Pattern | Status | File | Complexity | Notes |
|---|---------|--------|------|------------|-------|
| 1 | **Swing High** | [ ] | `patterns/swing.py` | HIGH | Multiple detection methods |
| 2 | **Swing Low** | [ ] | `patterns/swing.py` | HIGH | Multiple detection methods |
| 3 | **Higher High (HH)** | [ ] | `patterns/swing.py` | LOW | New high > previous high |
| 4 | **Higher Low (HL)** | [ ] | `patterns/swing.py` | LOW | New low > previous low |
| 5 | **Lower High (LH)** | [ ] | `patterns/swing.py` | LOW | New high < previous high |
| 6 | **Lower Low (LL)** | [ ] | `patterns/swing.py` | LOW | New low < previous low |

**Swing Detection Methods:**
```yaml
Method 1: Consecutive Candles + Touch
  consecutive_candles: 2+
  touch_count: 2
  touch_tolerance: 0.3%
  price_reference: "wick"

Method 2: N-Bar Highest/Lowest
  lookback: 100 bars
  price_reference: "wick"
```

### 2.2 Interim Points
| # | Pattern | Status | File | Complexity | Notes |
|---|---------|--------|------|------------|-------|
| 7 | **Interim High** | [ ] | `patterns/interim.py` | LOW | Last green close before BOS |
| 8 | **Interim Low** | [ ] | `patterns/interim.py` | LOW | Last red close before BOS |

**Interim Definition:**
- Interim Low = Last RED candle's CLOSE before a move UP
- Interim High = Last GREEN candle's CLOSE before a move DOWN
- Always use CANDLE CLOSE (not wick)

### 2.3 Structure Breaks
| # | Pattern | Status | File | Complexity | Notes |
|---|---------|--------|------|------------|-------|
| 9 | **BOS (Break of Structure)** | [ ] | `patterns/structure.py` | MEDIUM | Candle closes beyond swing |
| 10 | **MSB/CHOCH** | [ ] | `patterns/structure.py` | MEDIUM | Opposite side break = reversal |
| 11 | **Failed Retest** | [ ] | `patterns/structure.py` | MEDIUM | Wick beyond, close inside |

**BOS Definition:**
- Bullish BOS: Candle CLOSES above previous swing high
- Bearish BOS: Candle CLOSES below previous swing low

**MSB/CHOCH Definition:**
- In uptrend: Candle closes BELOW last higher low
- In downtrend: Candle closes ABOVE last lower high

### 2.4 Range Detection
| # | Pattern | Status | File | Complexity | Notes |
|---|---------|--------|------|------------|-------|
| 12 | **Range (75% Fib Method)** | [ ] | `patterns/range.py` | HIGH | Primary range detection |
| 13 | **Range (Touch Method)** | [ ] | `patterns/range.py` | MEDIUM | 3+ touches at level |
| 14 | **Range (MSB Confirmation)** | [ ] | `patterns/range.py` | MEDIUM | MSB confirms range high |
| 15 | **Discount Zone** | [ ] | `patterns/range.py` | LOW | 0 - 0.25 of range |
| 16 | **Premium Zone** | [ ] | `patterns/range.py` | LOW | 0.75 - 1.0 of range |

**75% Retracement Range Rules:**
```yaml
fib_levels: [0, 0.25, 0.5, 0.75, 1.0, 1.2, -0.2]
min_retracement: 0.75
max_retracement: 1.0
invalidation_level: 1.2 (up) / -0.2 (down)
range_high_source: "swing_high" OR "retracement_candle"
range_low_source: "swing_low" OR "retracement_candle_close"
```

### 2.5 Fibonacci
| # | Pattern | Status | File | Complexity | Notes |
|---|---------|--------|------|------------|-------|
| 17 | **Fib Retracement Levels** | [ ] | `patterns/fib.py` | LOW | Pure math calculation |

**Standard Levels:**
```
-0.2  = Liquidity sweep (below range)
0     = Range Low (0%)
0.236 = 23.6%
0.382 = 38.2%
0.5   = Midpoint (50%)
0.618 = Golden ratio (61.8%)
0.75  = Mean reversion trigger (75%)
0.786 = 78.6%
1.0   = Range High (100%)
1.2   = Liquidity sweep (above range)
```

### 2.6 Breakout Patterns
| # | Pattern | Status | File | Complexity | Notes |
|---|---------|--------|------|------------|-------|
| 18 | **False Breakout/Fakeout** | [ ] | `patterns/breakout.py` | MEDIUM | Wick beyond, body inside |
| 19 | **Impulse Candle** | [ ] | `patterns/breakout.py` | LOW | Large body, small wicks |

**False Breakout Rules:**
```yaml
# For LONG (at range low):
- wick_below_level: true
- body_closes_above_level: true

# For SHORT (at range high):
- wick_above_level: true
- body_closes_below_level: true

entry_timing: "next_candle_open"  # NOT the false breakout candle
```

### 2.7 Liquidity Patterns
| # | Pattern | Status | File | Complexity | Notes |
|---|---------|--------|------|------------|-------|
| 20 | **Liquidity Sweep** | [ ] | `patterns/liquidity.py` | HIGH | Sweep + rejection |
| 21 | **Liquidity Zones** | [ ] | `patterns/liquidity.py` | MEDIUM | Wick clusters outside range |

**Liquidity Sweep Detection:**
```yaml
sweep_levels: [-0.2, 1.2]  # Fib extensions
requirements:
  - wick_touches_sweep_level: true
  - candle_closes_inside_range: true
  - strong_rejection_candle: true
  - ltf_msb_confirmation: true  # 1m or 5m timeframe
```

### 2.8 Reversal Patterns
| # | Pattern | Status | File | Complexity | Notes |
|---|---------|--------|------|------------|-------|
| 22 | **Double Top** | [ ] | `patterns/doubles.py` | MEDIUM | Two similar highs |
| 23 | **Double Bottom** | [ ] | `patterns/doubles.py` | MEDIUM | Two similar lows |
| 24 | **Equal Highs/Lows** | [ ] | `patterns/doubles.py` | LOW | Multiple touches at same level |

### 2.9 Candle Patterns (Future)
| # | Pattern | Status | File | Complexity | Notes |
|---|---------|--------|------|------------|-------|
| 25 | **Bearish Engulfing** | [ ] | `patterns/candles.py` | LOW | Second candle engulfs first |
| 26 | **Bullish Engulfing** | [ ] | `patterns/candles.py` | LOW | Second candle engulfs first |
| 27 | **Flat Candle** | [ ] | `patterns/candles.py` | LOW | Flat body with wick |

---

## PHASE 3: INDICATORS (17 Total) - EASY (mostly ta-lib)

### 3.1 Moving Averages
| # | Indicator | Status | File | Periods | Notes |
|---|-----------|--------|------|---------|-------|
| 1 | **SMA** | [ ] | `indicators/moving_averages.py` | 20, 50, 100, 200 | `talib.SMA()` |
| 2 | **EMA** | [ ] | `indicators/moving_averages.py` | 12, 21, 50, 100, 200, 300 | `talib.EMA()` |
| 3 | **WMA** | [ ] | `indicators/moving_averages.py` | Configurable | `talib.WMA()` |
| 4 | **HMA** | [ ] | `indicators/moving_averages.py` | Configurable | Custom formula |

**EMA Period Usage:**
| Period | Usage |
|--------|-------|
| 12 | 12/21 cross system (short-term) |
| 21 | 12/21 cross system (short-term) |
| 50 | Medium-term (1D 50 = H4 300) |
| 100 | Medium-term |
| 200 | Long-term trend |
| 300 | H4 only (equivalent to 1D 50) |

### 3.2 VWAP
| # | Indicator | Status | File | Notes |
|---|-----------|--------|------|-------|
| 5 | **VWAP** | [ ] | `indicators/vwap.py` | 2-Day VWAP with bands |
| 6 | **VWAP Slope** | [ ] | `indicators/vwap.py` | Slope filter <= 0.25% over 15 candles |

**VWAP Configuration:**
```yaml
period: "2D"  # 2-Day VWAP
bands: true
slope_filter:
  lookback: 15  # candles
  max_deviation: 0.25%  # VWAP must be "flat"
```

### 3.3 Oscillators
| # | Indicator | Status | File | Notes |
|---|-----------|--------|------|-------|
| 7 | **RSI** | [ ] | `indicators/oscillators.py` | `talib.RSI()`, divergence detection |
| 8 | **Stochastic** | [ ] | `indicators/oscillators.py` | `talib.STOCH()` |
| 9 | **MACD** | [ ] | `indicators/oscillators.py` | `talib.MACD()` |

### 3.4 Volatility
| # | Indicator | Status | File | Notes |
|---|-----------|--------|------|-------|
| 10 | **ATR** | [ ] | `indicators/volatility.py` | `talib.ATR()`, 1x multiplier for SL |
| 11 | **Bollinger Bands** | [ ] | `indicators/volatility.py` | `talib.BBANDS()` |

**ATR Usage:**
```yaml
period: 14
multiplier: 1.0  # Stop loss = 1 x ATR from entry
```

### 3.5 Volume Indicators
| # | Indicator | Status | File | Notes |
|---|-----------|--------|------|-------|
| 12 | **Volume SMA** | [ ] | `indicators/volume.py` | Moving average of volume |
| 13 | **Volume Spike** | [ ] | `indicators/volume.py` | Volume > avg * multiplier |
| 14 | **CVD** | [ ] | `indicators/volume.py` | Cumulative Volume Delta |
| 15 | **OI** | [ ] | `indicators/volume.py` | Open Interest (if available) |

**Volume Confirmation Rule:**
```yaml
lookback: 5  # candles
confirmation: bos_volume > average_volume
```

### 3.6 Volume Profile
| # | Indicator | Status | File | Notes |
|---|-----------|--------|------|-------|
| 16 | **Volume Profile** | [ ] | `indicators/volume_profile.py` | VAH, VAL, POC |

### 3.7 Trend Indicators
| # | Indicator | Status | File | Notes |
|---|-----------|--------|------|-------|
| 17 | **ADX** | [ ] | `indicators/trend.py` | `talib.ADX()` |
| 18 | **Supertrend** | [ ] | `indicators/trend.py` | Custom (ATR-based) |

---

## PHASE 4: CONDITIONS (8 Total)

| # | Condition | Status | File | Notes |
|---|-----------|--------|------|-------|
| 1 | **price_above** | [ ] | `conditions/comparisons.py` | Price > indicator/level |
| 2 | **price_below** | [ ] | `conditions/comparisons.py` | Price < indicator/level |
| 3 | **crossover** | [ ] | `conditions/comparisons.py` | A crosses above B (e.g., EMA 12/21) |
| 4 | **crossunder** | [ ] | `conditions/comparisons.py` | A crosses below B |
| 5 | **rsi_divergence** | [ ] | `conditions/divergence.py` | Price vs RSI divergence |
| 6 | **volume_divergence** | [ ] | `conditions/divergence.py` | Price vs Volume divergence |
| 7 | **volume_confirmation** | [ ] | `conditions/volume_confirm.py` | BOS volume > 5-candle avg |
| 8 | **all/any/not** | [ ] | `conditions/combinations.py` | Logic combinations |

**EMA 12/21 Cross:**
```yaml
crossover:
  source_a: "ema_12"
  source_b: "ema_21"
  direction: "above"  # Green cross = bullish
```

**Volume Divergence:**
```yaml
# Bearish divergence:
- price: new_high
- volume: lower_than_previous_high_volume
# = Weakness, potential reversal
```

---

## PHASE 5: TRADING SYSTEMS (6 Pre-Built)

| # | System | Status | File | Type |
|---|--------|--------|------|------|
| 1 | **Breakout Trading (BOS)** | [ ] | `systems/breakout_bos.py` | Trend continuation |
| 2 | **75% Mean Reversion** | [ ] | `systems/mean_reversion.py` | Range trading |
| 3 | **Failed Retest of BOS** | [ ] | `systems/failed_retest.py` | Trend pullback |
| 4 | **Volume Harmony Breakout** | [ ] | `systems/volume_harmony.py` | Volume-confirmed breakout |
| 5 | **Liquidity Sweep Range** | [ ] | `systems/liquidity_sweep.py` | Range with sweep entry |
| 6 | **15M VWAP False Breakout** | [ ] | `systems/vwap_fb.py` | VWAP mean reversion |

### System Configuration Examples

**System #1: Breakout Trading (BOS)**
```yaml
name: "Breakout Trading"
type: trend_continuation

entry:
  trigger: "bos"
  timing: "next_candle_open"  # Or "immediate" for momentum

stop_loss:
  reference: "interim_high_low"

take_profit:
  method: "fixed_r"
  value: 1.5
  # OR
  method: "msb_exit"

continuation:
  enabled: true
  rule: "if win + next 2 candles in direction -> re-enter"
```

**System #2: 75% Mean Reversion**
```yaml
name: "75% Mean Reversion"
type: mean_reversion

patterns:
  swing: { method: "combined", touches: 2 }
  range: { method: "fib_75", min: 0.75, max: 1.0 }

entry:
  trigger: "false_breakout"
  timing: "next_candle_open"
  zone_filter: true  # Must be in discount (long) or premium (short)

stop_loss:
  method: "false_breakout_wick"
  offset: 1  # tick

take_profit:
  reference: "range_opposite"
```

**System #5: Liquidity Sweep Range**
```yaml
name: "Liquidity Sweep Range Trade"
type: mean_reversion

patterns:
  range: { method: "fib_75", msb_confirmation: true }
  liquidity_zones: { mark_wicks: true }

entry:
  trigger: "liquidity_sweep"
  requirements:
    - wick_to_sweep_level: true  # -0.2 or 1.2
    - close_inside_range: true
    - strong_rejection: true
    - ltf_msb: { timeframe: "5m" }
  timing: "ltf_msb_candle_open"

stop_loss:
  reference: "sweep_wick"
  offset: 1  # tick

take_profit:
  reference: "range_opposite"
  # OR: "zone_level" (0.25 or 0.75)
```

---

## PHASE 6: ENGINE

| Component | Status | File | Notes |
|-----------|--------|------|-------|
| YAML Parser | [ ] | `engine/parser.py` | Parse system configs |
| Signal Generator | [ ] | `engine/signals.py` | Generate entry signals |
| Position Manager | [ ] | `engine/position.py` | Track positions |
| Backtest Runner | [ ] | `engine/backtest.py` | Replay historical data |
| Results Calculator | [ ] | `engine/backtest.py` | Win rate, R, etc. |
| Live Runner | [ ] | `engine/live.py` | Real-time execution |

---

## PHASE 7: TESTING & VERIFICATION

| Test | Status | Notes |
|------|--------|-------|
| Indicators match TradingView | [ ] | Compare RSI, EMA, ATR |
| Swing detection vs manual | [ ] | 50+ chart examples |
| Range detection vs manual | [ ] | 30+ chart examples |
| False breakout vs manual | [ ] | 40+ chart examples |
| BOS/MSB detection vs manual | [ ] | 30+ chart examples |
| Full backtest comparison | [ ] | Compare to manual backtest |

---

## BUILD ORDER (Recommended)

### Week 1: Foundation + Core Indicators
1. [x] Project structure
2. [ ] Data fetcher (Hyperliquid API)
3. [ ] SQLite storage
4. [ ] SMA, EMA (all periods)
5. [ ] ATR
6. [ ] Volume SMA

### Week 2: Core Patterns (Swings)
7. [ ] Swing High (all methods)
8. [ ] Swing Low (all methods)
9. [ ] HH/HL/LH/LL detection
10. [ ] Visual verification tool
11. [ ] Test against manual analysis

### Week 3: Structure Patterns
12. [ ] Interim High/Low
13. [ ] BOS detection
14. [ ] MSB/CHOCH detection
15. [ ] Failed Retest detection

### Week 4: Range Patterns
16. [ ] Fibonacci calculator
17. [ ] Range detection (75% method)
18. [ ] Discount/Premium zones
19. [ ] False Breakout detection

### Week 5: Advanced Patterns
20. [ ] Liquidity Zones
21. [ ] Liquidity Sweep detection
22. [ ] Double Top/Bottom
23. [ ] Equal Highs/Lows

### Week 6: Remaining Indicators
24. [ ] RSI
25. [ ] MACD
26. [ ] VWAP + slope
27. [ ] Volume Profile
28. [ ] Bollinger Bands

### Week 7: Conditions + Engine
29. [ ] All conditions
30. [ ] YAML parser
31. [ ] Signal generator
32. [ ] Position manager

### Week 8: Backtest + Systems
33. [ ] Backtest runner
34. [ ] Results calculator
35. [ ] System #2: 75% Mean Reversion
36. [ ] Full verification

### Week 9+: Remaining Systems + Polish
37. [ ] All 6 pre-built systems
38. [ ] Live trading engine
39. [ ] Web dashboard
40. [ ] Deploy to Dell Wyse

---

## KEY PARAMETERS REFERENCE

### Fibonacci Levels
| Level | Name | Usage |
|-------|------|-------|
| -0.2 | Sweep Low | Liquidity sweep zone |
| 0 | Range Low | 0% |
| 0.25 | Discount Top | Discount zone boundary |
| 0.5 | Midpoint | Equilibrium |
| 0.75 | Premium Bottom | Premium zone / 75% trigger |
| 1.0 | Range High | 100% |
| 1.2 | Sweep High | Liquidity sweep zone |

### Stop Loss Multipliers
| Context | Multiplier |
|---------|------------|
| ATR-based | 1.0x ATR |
| Tick-based | 1 tick beyond level |

### Risk Management
| Parameter | Value |
|-----------|-------|
| Risk per trade | 1% of account |
| Fixed R targets | 1.5R or 2R |

### Entry Timing
| Timing | Description |
|--------|-------------|
| next_candle_open | Enter on NEXT candle after signal (preferred) |
| immediate | Enter on signal candle close |
| limit_order | Set limit at specific level |

---

## NOTES

- **ta-lib installation**: Requires C library
  - Mac: `brew install ta-lib && pip install TA-Lib`
  - Linux: `apt-get install ta-lib && pip install TA-Lib`

- **Testing approach**: Every pattern needs manual verification

- **Priority**: Patterns > Indicators (patterns are the hard part)

- **Key principle**: "Reason to enter = Reason to exit"

---

*Total Build Items: 24 patterns + 17 indicators + 8 conditions + 6 systems = 55 modules*

*Last updated: 2026-01-05*
