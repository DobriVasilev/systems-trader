# Automated Trading Systems - Feature Plan

## Overview

"Automated Systems" are pre-configured trading strategies that run automatically based on TradingView alerts. Users can create, manage, and monitor multiple systems simultaneously.

---

## What Is A "System"?

A system is a saved trading configuration that:
- Listens for TradingView alerts (specific ticker/strategy)
- Automatically executes trades when alerts fire
- Manages the full trade lifecycle (entry → TP/SL → exit)
- Runs 24/7 without manual intervention

---

## User Flow

```
1. User creates a system
   └── Names it: "BTC Scalper"
   └── Configures: asset, size, leverage, TP/SL rules
   └── Links to TradingView strategy/indicator

2. TradingView sends alert
   └── "BTC LONG" from Pine Script strategy

3. System receives alert
   └── Matches alert to correct system
   └── Validates signal

4. System executes trade
   └── Opens position with configured size
   └── Places TP and SL orders

5. System monitors position
   └── Updates dashboard in real-time
   └── Waits for TP/SL or next signal

6. Position closes
   └── Logs result
   └── Updates P&L
   └── Ready for next signal
```

---

## System Configuration

### Basic Settings

```typescript
interface TradingSystem {
  id: string;                    // Unique identifier
  name: string;                  // "BTC Scalper", "ETH Swing", etc.
  enabled: boolean;              // Is system active?
  createdAt: Date;

  // Asset Configuration
  asset: string;                 // "BTC", "ETH", "SOL", etc.

  // Position Sizing
  sizeType: "fixed" | "percentage" | "risk";
  sizeValue: number;             // Fixed: units, Percentage: % of balance, Risk: % risk per trade
  leverage: number;              // 1-50x

  // Entry Rules
  entryType: "market" | "limit";
  limitOffsetPercent?: number;   // For limit orders: offset from signal price

  // Exit Rules
  takeProfitEnabled: boolean;
  takeProfitPercent?: number;    // TP at X% profit

  stopLossEnabled: boolean;
  stopLossPercent?: number;      // SL at X% loss

  trailingStopEnabled: boolean;
  trailingStopPercent?: number;  // Trailing stop distance

  // Signal Matching
  signalSource: "tradingview_extension" | "webhook";
  alertKeyword?: string;         // Match alerts containing this keyword

  // Risk Management
  maxPositionsPerDay?: number;
  maxDrawdownPercent?: number;   // Pause system if drawdown exceeds
  cooldownMinutes?: number;      // Wait between trades

  // Statistics (updated automatically)
  stats: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
    currentStreak: number;       // Positive = wins, negative = losses
  };
}
```

### Example System Configurations

```typescript
// Conservative BTC System
const btcConservative: TradingSystem = {
  id: "sys_001",
  name: "BTC Conservative",
  enabled: true,
  asset: "BTC",
  sizeType: "risk",
  sizeValue: 1,                  // Risk 1% per trade
  leverage: 3,
  entryType: "market",
  takeProfitEnabled: true,
  takeProfitPercent: 2,          // 2% TP
  stopLossEnabled: true,
  stopLossPercent: 1,            // 1% SL (2:1 RR)
  trailingStopEnabled: false,
  signalSource: "tradingview_extension",
  maxPositionsPerDay: 5,
  cooldownMinutes: 30,
  // ...
};

// Aggressive Scalper
const ethScalper: TradingSystem = {
  id: "sys_002",
  name: "ETH Scalper",
  enabled: true,
  asset: "ETH",
  sizeType: "percentage",
  sizeValue: 25,                 // Use 25% of balance
  leverage: 10,
  entryType: "market",
  takeProfitEnabled: true,
  takeProfitPercent: 0.5,        // Quick 0.5% TP
  stopLossEnabled: true,
  stopLossPercent: 0.3,          // Tight 0.3% SL
  trailingStopEnabled: false,
  signalSource: "tradingview_extension",
  maxPositionsPerDay: 20,
  cooldownMinutes: 5,
  // ...
};
```

---

## UI Design

### Systems List (Dashboard)

```
┌─────────────────────────────────────────────────────────────────┐
│  AUTOMATED SYSTEMS                                    [+ New]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ● BTC Conservative          RUNNING         [Pause] [Edit] │ │
│  │   BTC | 3x | 1% risk | TP: 2% SL: 1%                       │ │
│  │   Today: 3 trades | +$127.50 (+1.2%)                       │ │
│  │   Win Rate: 67% | Current: No position                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ● ETH Scalper               RUNNING         [Pause] [Edit] │ │
│  │   ETH | 10x | 25% size | TP: 0.5% SL: 0.3%                 │ │
│  │   Today: 12 trades | +$89.20 (+0.8%)                       │ │
│  │   Win Rate: 58% | Current: LONG 2.5 ETH @ $3,420           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ○ SOL Momentum              PAUSED          [Start] [Edit] │ │
│  │   SOL | 5x | 2% risk | TP: 3% SL: 1.5%                     │ │
│  │   Last run: 2 days ago | Lifetime: +$450.00                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Create/Edit System Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Create New System                                    [× Close] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  BASIC INFO                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ System Name:  [BTC Scalper_______________]                 │ │
│  │ Asset:        [BTC ▼]                                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  POSITION SIZING                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Size Type:    ○ Fixed    ○ % of Balance    ● % Risk        │ │
│  │ Value:        [1___] %                                     │ │
│  │ Leverage:     [5___] x                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ENTRY                                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Entry Type:   ● Market    ○ Limit                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  EXIT RULES                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [✓] Take Profit:    [2___] %                               │ │
│  │ [✓] Stop Loss:      [1___] %                               │ │
│  │ [ ] Trailing Stop:  [____] %                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  RISK MANAGEMENT                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Max trades/day:     [10__]  (0 = unlimited)                │ │
│  │ Cooldown:           [5___]  minutes between trades         │ │
│  │ Max drawdown:       [10__]  % (pauses system)              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  SIGNAL SOURCE                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Source:       ● TradingView Extension    ○ Webhook         │ │
│  │ Alert Filter: [BTC_SCALPER_____________] (optional)        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              [Cancel]              [Create System]          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### System Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    BTC Conservative                    ● RUNNING        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  WIN RATE    │  │  TOTAL P&L   │  │  TRADES      │           │
│  │    67%       │  │   +$1,250    │  │    45        │           │
│  │  30W / 15L   │  │   +12.5%     │  │  This month  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  CURRENT POSITION                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  No active position - Waiting for signal                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  CONFIGURATION                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Asset: BTC    Leverage: 3x    Size: 1% risk               │ │
│  │  TP: 2%        SL: 1%          Entry: Market               │ │
│  │  Max/day: 5    Cooldown: 30min                             │ │
│  │                                              [Edit Settings]│ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  RECENT TRADES                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Jan 3, 14:32 │ LONG  │ 0.05 BTC │ +$45.20  │ TP Hit        │ │
│  │ Jan 3, 11:15 │ SHORT │ 0.05 BTC │ -$22.10  │ SL Hit        │ │
│  │ Jan 3, 09:45 │ LONG  │ 0.05 BTC │ +$38.50  │ TP Hit        │ │
│  │ Jan 2, 22:30 │ LONG  │ 0.04 BTC │ +$31.00  │ TP Hit        │ │
│  │ Jan 2, 18:20 │ SHORT │ 0.04 BTC │ -$18.50  │ SL Hit        │ │
│  │                                            [View All →]     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  PERFORMANCE CHART                                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │     $1,250 ──────────────────────────────────●             │ │
│  │                                         ●                   │ │
│  │     $1,000 ────────────────────────●                       │ │
│  │                              ●                              │ │
│  │       $750 ─────────────●                                  │ │
│  │                    ●                                        │ │
│  │       $500 ───●                                            │ │
│  │          ●                                                  │ │
│  │         Jan 1        Jan 15        Feb 1                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Pause System]  [Delete System]  [Export Trades]               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Signal Processing Flow

### How Signals Are Matched to Systems

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIGNAL PROCESSING                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Signal Received (from TradingView Extension or Webhook)      │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ {                                                    │     │
│     │   "ticker": "BTCUSDT.P",                            │     │
│     │   "action": "buy",                                  │     │
│     │   "price": 67250,                                   │     │
│     │   "message": "BTC_SCALPER LONG signal"              │     │
│     │ }                                                    │     │
│     └─────────────────────────────────────────────────────┘     │
│                              │                                   │
│                              ▼                                   │
│  2. Parse Signal                                                 │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ asset: "BTC"                                         │     │
│     │ direction: "LONG"                                    │     │
│     │ price: 67250                                         │     │
│     │ keyword: "BTC_SCALPER"                               │     │
│     └─────────────────────────────────────────────────────┘     │
│                              │                                   │
│                              ▼                                   │
│  3. Find Matching Systems                                        │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ For each enabled system:                             │     │
│     │   - Does asset match? (BTC == BTC) ✓                │     │
│     │   - Does keyword match? (BTC_SCALPER contains) ✓    │     │
│     │   - Is system enabled? ✓                            │     │
│     │   - Cooldown passed? ✓                              │     │
│     │   - Under daily limit? ✓                            │     │
│     │   → MATCH: "BTC Conservative" system                 │     │
│     └─────────────────────────────────────────────────────┘     │
│                              │                                   │
│                              ▼                                   │
│  4. Execute Trade                                                │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ System: "BTC Conservative"                           │     │
│     │ Action: Open LONG                                    │     │
│     │ Size: Calculate from 1% risk                         │     │
│     │ Leverage: 3x                                         │     │
│     │ Entry: Market order                                  │     │
│     │ TP: +2% from entry                                   │     │
│     │ SL: -1% from entry                                   │     │
│     └─────────────────────────────────────────────────────┘     │
│                              │                                   │
│                              ▼                                   │
│  5. Monitor & Update                                             │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ - Position opened, update UI                         │     │
│     │ - TP/SL orders placed                                │     │
│     │ - Watch for exit (TP hit, SL hit, or reverse signal)│     │
│     │ - Log trade result when closed                       │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Signal Matching Rules

```typescript
function findMatchingSystems(signal: Signal): TradingSystem[] {
  return enabledSystems.filter(system => {
    // 1. Asset must match
    if (system.asset !== signal.asset) return false;

    // 2. Keyword filter (if configured)
    if (system.alertKeyword) {
      if (!signal.message?.includes(system.alertKeyword)) return false;
    }

    // 3. Not in cooldown
    const lastTrade = getLastTradeTime(system.id);
    if (lastTrade && Date.now() - lastTrade < system.cooldownMinutes * 60000) {
      return false;
    }

    // 4. Under daily limit
    const todayTrades = getTodayTradeCount(system.id);
    if (system.maxPositionsPerDay && todayTrades >= system.maxPositionsPerDay) {
      return false;
    }

    // 5. Not over drawdown limit
    if (system.maxDrawdownPercent) {
      const drawdown = calculateDrawdown(system.id);
      if (drawdown > system.maxDrawdownPercent) return false;
    }

    return true;
  });
}
```

---

## Position Sizing Calculations

### Fixed Size
```typescript
// User wants to trade exactly 0.1 BTC per signal
size = system.sizeValue; // 0.1 BTC
```

### Percentage of Balance
```typescript
// User wants to use 25% of available balance
const balance = await getAvailableBalance(); // e.g., $10,000
const price = currentPrice; // e.g., $67,000
size = (balance * system.sizeValue / 100) / price;
// = ($10,000 * 25%) / $67,000 = 0.037 BTC
```

### Risk-Based (Recommended)
```typescript
// User wants to risk 1% of account per trade
const balance = await getAvailableBalance(); // e.g., $10,000
const riskAmount = balance * (system.sizeValue / 100); // $100
const stopLossPercent = system.stopLossPercent; // 1%
const price = currentPrice; // $67,000

// Position size where 1% SL = $100 risk
// If price drops 1%, we lose $100
// size * price * (stopLoss / 100) = riskAmount
size = riskAmount / (price * (stopLossPercent / 100));
// = $100 / ($67,000 * 0.01) = 0.149 BTC

// Apply leverage
effectiveSize = size * system.leverage;
marginRequired = (size * price) / system.leverage;
```

---

## Data Storage

### Systems Storage (JSON file or SQLite)

```typescript
// /data/systems.json
{
  "systems": [
    {
      "id": "sys_001",
      "name": "BTC Conservative",
      "enabled": true,
      "asset": "BTC",
      // ... full config
    },
    // ... more systems
  ]
}

// /data/trades.json (or SQLite for better querying)
{
  "trades": [
    {
      "id": "trade_001",
      "systemId": "sys_001",
      "systemName": "BTC Conservative",
      "asset": "BTC",
      "direction": "LONG",
      "entryPrice": 67250,
      "exitPrice": 68600,
      "size": 0.05,
      "leverage": 3,
      "pnl": 67.50,
      "pnlPercent": 2.01,
      "exitReason": "TP_HIT",
      "entryTime": "2025-01-03T14:32:00Z",
      "exitTime": "2025-01-03T16:45:00Z",
      "duration": 8100000 // ms
    },
    // ... more trades
  ]
}
```

---

## Implementation Phases

### Phase 1: Core System Management
- [ ] Create `TradingSystem` type definition
- [ ] Build system CRUD operations (create, read, update, delete)
- [ ] Store systems in persistent storage
- [ ] Load systems on app startup

### Phase 2: UI - Systems List
- [ ] Add "Systems" section to dashboard
- [ ] Display list of systems with status
- [ ] Enable/disable toggle for each system
- [ ] Quick stats (today's trades, P&L)

### Phase 3: UI - Create/Edit System
- [ ] Build create system modal
- [ ] Form validation
- [ ] Edit existing system
- [ ] Delete system with confirmation

### Phase 4: Signal Processing
- [ ] Integrate with existing TradingView extension handler
- [ ] Parse incoming signals
- [ ] Match signals to systems
- [ ] Apply filters (keyword, cooldown, daily limit)

### Phase 5: Trade Execution
- [ ] Calculate position size based on system config
- [ ] Execute entry order
- [ ] Place TP/SL orders
- [ ] Handle order failures gracefully

### Phase 6: Position Monitoring
- [ ] Track open positions per system
- [ ] Detect TP/SL hits
- [ ] Handle reverse signals (close and flip)
- [ ] Update system stats on close

### Phase 7: Statistics & History
- [ ] Log all trades to storage
- [ ] Calculate system statistics
- [ ] Build trade history view
- [ ] Performance charts

### Phase 8: Advanced Features
- [ ] Trailing stop loss
- [ ] Drawdown-based pause
- [ ] Export trades to CSV
- [ ] Duplicate system functionality

---

## Integration with Existing App

### Current Flow (Manual Trading)
```
TradingView Extension → App receives signal → Shows in UI → User clicks execute
```

### New Flow (Automated Systems)
```
TradingView Extension → App receives signal → Match to system(s) → Auto-execute
                                           ↓
                                    (if no match)
                                           ↓
                                    Show in UI for manual action
```

### Code Integration Points

1. **Signal Handler** (`App.tsx` - `handleExtensionTrade`)
   - Add system matching logic
   - Auto-execute if system matches
   - Fall back to manual UI if no match

2. **New Components**
   - `SystemsList.tsx` - Display all systems
   - `SystemCard.tsx` - Individual system display
   - `CreateSystemModal.tsx` - Create/edit form
   - `SystemDetail.tsx` - Full system view with stats

3. **New Stores**
   - `systemsStore.ts` - Zustand store for systems state
   - Persist to localStorage/file

4. **New Files**
   - `src/systems/types.ts` - Type definitions
   - `src/systems/matching.ts` - Signal matching logic
   - `src/systems/sizing.ts` - Position size calculations
   - `src/systems/stats.ts` - Statistics calculations

---

## Error Handling

### What Can Go Wrong

| Error | Handling |
|-------|----------|
| Signal received but no matching system | Log, show in manual queue |
| Order execution fails | Retry once, then alert user |
| Insufficient balance | Pause system, notify user |
| API rate limit | Queue orders, retry with backoff |
| Network error | Retry with exponential backoff |
| TP/SL order rejected | Retry, alert if persistent |

### User Notifications

- **Trade executed:** Brief toast notification
- **Trade closed:** Toast with P&L
- **System paused:** Alert banner
- **Error:** Red alert with details

---

## Future Enhancements

- [ ] Multiple TP levels (partial closes)
- [ ] Time-based exits (close after X hours)
- [ ] News filter (pause during high-impact news)
- [ ] Correlation limits (don't open too many correlated positions)
- [ ] Copy trading (follow another user's systems)
- [ ] Backtesting with historical data
- [ ] Paper trading mode
- [ ] Strategy marketplace (share/sell systems)

---

## Questions to Resolve

1. **Signal conflicts:** What if one signal matches multiple systems?
   - Option A: Execute all (could over-leverage)
   - Option B: Execute first match only
   - Option C: User configures priority

2. **Reverse signals:** LONG signal while SHORT position open?
   - Option A: Close SHORT, open LONG
   - Option B: Close SHORT only
   - Option C: Configurable per system

3. **Partial fills:** Entry order partially filled?
   - Scale TP/SL to actual fill size

4. **System vs Manual:** User manually trades same asset as a system?
   - Keep separate? Merge? Alert?

---

*Document created: January 2026*
*Status: PLANNING - Ready for implementation*
