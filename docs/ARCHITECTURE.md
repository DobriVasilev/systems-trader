# Hyperliquid Trading Platform - Technical Architecture

## Decision: Tauri Desktop App

After evaluating options, **Tauri** is the best fit for:
- You + friends sharing a trading bot
- Nice UI without web hosting complexity
- Users control their own keys
- Free distribution
- Auto-updates built-in

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRADING BOT APP (Tauri)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                 FRONTEND (React + TypeScript)           │   │
│   │                                                         │   │
│   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│   │  │  Dashboard  │ │   Systems   │ │   Trades    │       │   │
│   │  │  - P&L      │ │   - List    │ │   - History │       │   │
│   │  │  - Charts   │ │   - Config  │ │   - Journal │       │   │
│   │  │  - Stats    │ │   - Toggle  │ │   - Export  │       │   │
│   │  └─────────────┘ └─────────────┘ └─────────────┘       │   │
│   │                                                         │   │
│   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│   │  │  Positions  │ │  Settings   │ │   Logs      │       │   │
│   │  │  - Open     │ │  - API/Keys │ │   - Live    │       │   │
│   │  │  - Pending  │ │  - Risk     │ │   - Filter  │       │   │
│   │  │  - Close    │ │  - Notify   │ │   - Export  │       │   │
│   │  └─────────────┘ └─────────────┘ └─────────────┘       │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              ↕ IPC (Inter-Process Comm)         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                 BACKEND (Rust + Python Sidecar)         │   │
│   │                                                         │   │
│   │  ┌──────────────────────────────────────────────────┐   │   │
│   │  │  TRADING ENGINE (Python - runs as sidecar)       │   │   │
│   │  │                                                  │   │   │
│   │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐   │   │   │
│   │  │  │ Hyperliquid│ │ Strategies │ │    Risk    │   │   │   │
│   │  │  │    API     │ │  Engine    │ │  Manager   │   │   │   │
│   │  │  │ - Orders   │ │ - MeanRev  │ │ - Sizing   │   │   │   │
│   │  │  │ - Positions│ │ - Breakout │ │ - Limits   │   │   │   │
│   │  │  │ - Candles  │ │ - Custom   │ │ - Drawdown │   │   │   │
│   │  │  └────────────┘ └────────────┘ └────────────┘   │   │   │
│   │  │                                                  │   │   │
│   │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐   │   │   │
│   │  │  │   Data     │ │  Logger    │ │  Notifier  │   │   │   │
│   │  │  │   Feed     │ │ - Trades   │ │ - Telegram │   │   │   │
│   │  │  │ - WebSocket│ │ - Errors   │ │ - Discord  │   │   │   │
│   │  │  │ - Candles  │ │ - Events   │ │ - Email    │   │   │   │
│   │  │  └────────────┘ └────────────┘ └────────────┘   │   │   │
│   │  └──────────────────────────────────────────────────┘   │   │
│   │                                                         │   │
│   │  ┌──────────────────────────────────────────────────┐   │   │
│   │  │  RUST CORE (Tauri native)                        │   │   │
│   │  │  - File system access                            │   │   │
│   │  │  - Secure key storage                            │   │   │
│   │  │  - Auto-updater                                  │   │   │
│   │  │  - System tray                                   │   │   │
│   │  │  - Startup on boot                               │   │   │
│   │  └──────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   HYPERLIQUID     │
                    │   - REST API      │
                    │   - WebSocket     │
                    │   - Order Book    │
                    └───────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **App Framework** | Tauri 2.0 | Native apps, tiny size, secure |
| **Frontend** | React 18 + TypeScript | Modern, type-safe, you know it |
| **Styling** | Tailwind CSS | Fast, looks good |
| **Charts** | Lightweight Charts (TradingView) | Free, professional look |
| **State Management** | Zustand or Jotai | Simple, lightweight |
| **Trading Engine** | Python 3.11+ | Best for trading, pandas/numpy |
| **Hyperliquid SDK** | hyperliquid-python-sdk | Official SDK |
| **Rust Core** | Tauri APIs | File access, security, updates |
| **Database** | SQLite | Local, no setup, portable |
| **Auto-Updates** | tauri-plugin-updater | Built-in, GitHub Releases |

---

## Project Structure

```
hyperliquid-trader/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── Dashboard/
│   │   │   ├── PnLChart.tsx
│   │   │   ├── StatsCards.tsx
│   │   │   └── RecentTrades.tsx
│   │   ├── Systems/
│   │   │   ├── SystemList.tsx
│   │   │   ├── SystemConfig.tsx
│   │   │   └── SystemToggle.tsx
│   │   ├── Positions/
│   │   │   ├── OpenPositions.tsx
│   │   │   ├── PendingOrders.tsx
│   │   │   └── PositionCard.tsx
│   │   ├── Settings/
│   │   │   ├── ApiKeys.tsx
│   │   │   ├── RiskSettings.tsx
│   │   │   └── Notifications.tsx
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       └── Table.tsx
│   ├── hooks/
│   │   ├── useHyperliquid.ts
│   │   ├── useTradingEngine.ts
│   │   └── useAutoUpdate.ts
│   ├── store/
│   │   ├── positions.ts
│   │   ├── systems.ts
│   │   └── settings.ts
│   ├── App.tsx
│   └── main.tsx
│
├── src-tauri/                    # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs              # Entry point
│   │   ├── commands.rs          # IPC commands
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json          # Tauri config
│
├── trading-engine/               # Python trading logic
│   ├── main.py                  # Entry point (sidecar)
│   ├── hyperliquid/
│   │   ├── client.py            # API wrapper
│   │   ├── websocket.py         # Real-time data
│   │   └── orders.py            # Order management
│   ├── strategies/
│   │   ├── base.py              # Base strategy class
│   │   ├── mean_reversion.py    # 75% V-Shape strategy
│   │   ├── breakout.py          # Breakout strategy
│   │   └── custom.py            # User-defined
│   ├── risk/
│   │   ├── position_sizer.py    # Calculate position size
│   │   ├── risk_manager.py      # Drawdown, limits
│   │   └── validators.py        # Pre-trade checks
│   ├── data/
│   │   ├── candles.py           # Candle management
│   │   ├── indicators.py        # ATR, MA, etc.
│   │   └── cache.py             # Local data cache
│   ├── utils/
│   │   ├── logger.py
│   │   ├── notifier.py
│   │   └── config.py
│   └── requirements.txt
│
├── shared/                       # Shared types/schemas
│   └── types.ts                 # TypeScript types
│
├── package.json                  # Frontend dependencies
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

---

## Auto-Update System

### How it works:

```
┌─────────────────┐         ┌──────────────────────┐
│   User's App    │         │   GitHub Releases    │
│   v1.0.0        │────────▶│   (Free hosting)     │
└─────────────────┘         └──────────────────────┘
        │                            │
        │ On app start:              │
        │ GET /latest-version        │
        │                            ▼
        │                   ┌──────────────────────┐
        │                   │ Response:            │
        │                   │ {                    │
        │                   │   "version": "1.0.1",│
        │                   │   "url": "...",      │
        │                   │   "notes": "..."     │
        │                   │ }                    │
        │                   └──────────────────────┘
        │                            │
        ▼                            ▼
┌─────────────────────────────────────────────────┐
│  Update available: v1.0.1                       │
│  • Fixed bug in mean reversion entry            │
│  • Added new breakout strategy                  │
│                                                 │
│  [Later]                      [Update Now]      │
└─────────────────────────────────────────────────┘
        │
        ▼ User clicks "Update Now"
┌─────────────────────────────────────────────────┐
│  Downloading update... 3.2 MB                   │
│  ████████████░░░░░░░░ 60%                       │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│  Update installed! Restart to apply.            │
│                                                 │
│                              [Restart Now]      │
└─────────────────────────────────────────────────┘
```

### Tauri config for updates:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/YOUR_USERNAME/hyperliquid-trader/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

### Release process:

1. Make changes to code
2. Bump version in `tauri.conf.json`
3. Run `npm run tauri build`
4. Create GitHub Release with the built files
5. Users automatically get notified

---

## 24/7 Running Solutions

### Option A: Keep PC On (Free)
```
User's Laptop
     │
     ├── Tauri App running in system tray
     ├── "Start on boot" enabled
     └── Power settings: Never sleep when plugged in
```

### Option B: User's Own VPS ($5/month)
```
User signs up for DigitalOcean/Vultr
     │
     └── Runs the Python trading engine only
         (No UI needed on server)

User's Laptop
     │
     └── Tauri App connects to their VPS
         (Dashboard only, trading happens on VPS)
```

### Option C: Hybrid Mode (Best UX)
```
┌─────────────────────────────────────────────────┐
│  Trading Engine Location                        │
│                                                 │
│  ○ Local (runs on this computer)               │
│    Free, but stops when PC sleeps               │
│                                                 │
│  ● Cloud (runs 24/7)                           │
│    $5/month, always running                     │
│    [Connect to DigitalOcean]                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Security Model

### Keys never leave user's device:

```
┌─────────────────────────────────────────────────┐
│                 User's Computer                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Tauri Secure Storage (encrypted)         │  │
│  │  - Hyperliquid wallet private key         │  │
│  │  - API credentials                        │  │
│  │  - Encrypted with OS keychain             │  │
│  └───────────────────────────────────────────┘  │
│                      │                          │
│                      ▼                          │
│  ┌───────────────────────────────────────────┐  │
│  │  Trading Engine                           │  │
│  │  - Signs transactions locally             │  │
│  │  - Never sends keys anywhere              │  │
│  └───────────────────────────────────────────┘  │
│                      │                          │
│                      ▼                          │
│             Signed transactions only            │
└─────────────────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Hyperliquid   │
              │   (receives     │
              │   signed txs)   │
              └─────────────────┘
```

**You (the developer) never see user's keys.**
**Friends don't have to trust you with their money.**

---

## Development Phases (FINAL)

### Phase 1: Hyperliquid Manual Trading App
**Goal:** Same features as KCEX extension, but for Hyperliquid via API

| Feature | Description |
|---------|-------------|
| Connect to Hyperliquid | API + WebSocket for real-time data |
| Position calculator | Enter risk → get position size |
| Manual order placement | Long/Short with SL/TP |
| View positions | Open positions, P&L |
| View balances | Available margin |
| Trade history | Log of all trades |
| Basic UI | Clean dashboard like KCEX sidebar |

**Tech:**
- Tauri app (React frontend + Python backend)
- Hyperliquid Python SDK
- SQLite for local storage

**Effort:** 2-3 weeks

---

### Phase 2: System Builder + Automation
**Goal:** Define trading systems in Python, run them automatically

| Feature | Description |
|---------|-------------|
| Strategy base class | `Strategy` class to inherit from |
| System templates | Breakout, Mean Reversion, etc. |
| Python code editor | Edit systems in app |
| System manager UI | List all systems, ON/OFF toggle |
| Per-system settings | Risk, timeframe, parameters (sliders) |
| Live logs | Real-time log viewer per system |
| Performance stats | Win rate, avg R, total P&L per system |
| Backtesting | Test system on historical data |

**System Definition (Python):**
```python
class MySystem(Strategy):
    name = "Breakout Trading"
    timeframe = "30m"
    params = {"tp_r": 1.5, "consecutive_candles": 2}

    def on_candle(self, candles):
        # Your logic here
        if condition:
            self.enter_long(entry, sl, tp)
```

**UI for Systems:**
```
┌─────────────────────────────────────────┐
│ MY SYSTEMS                              │
├─────────────────────────────────────────┤
│ ⚡ Breakout Trading           [ON 🟢]  │
│    BTC • 30m • $10 risk                │
│    Today: +2.3R                        │
│    [Logs] [Settings] [Edit]            │
├─────────────────────────────────────────┤
│ 📊 Mean Reversion             [OFF ⚫] │
│    BTC • 30m • $10 risk                │
│    [Logs] [Settings] [Edit]            │
├─────────────────────────────────────────┤
│ [+ Add System]                          │
└─────────────────────────────────────────┘
```

**Effort:** 4-5 weeks

---

### Phase 3: Polish + Distribution
**Goal:** Auto-updates, shareable with friends

| Feature | Description |
|---------|-------------|
| Auto-updater | Check GitHub releases, download + install |
| Export/import systems | Share `.strategy` files with friends |
| Build installers | .exe (Win), .app (Mac), .deb (Linux) |
| System tray | Run in background, show status |
| Notifications | Telegram/Discord on trade events |
| Google Sheets sync | Export trades to spreadsheet |
| User documentation | How to use, how to write systems |

**Sharing with friends:**
1. You create system in Python
2. Export as `.strategy` file
3. Friend imports into their app
4. Friend only sees Settings UI (sliders), not code
5. Friend clicks [ON] → system runs

**Effort:** 2-3 weeks

---

## Summary

| Phase | What | Effort | Outcome |
|-------|------|--------|---------|
| **1** | Manual trading app (Hyperliquid) | 2-3 weeks | Trade via nice UI |
| **2** | System builder + automation | 4-5 weeks | Bots trade for you |
| **3** | Polish + sharing | 2-3 weeks | Give to friends |

**Total: ~8-11 weeks to full vision**

---

## Tech Stack (Final)

| Layer | Technology |
|-------|------------|
| App framework | Tauri 2.0 |
| Frontend | React + TypeScript + Tailwind |
| Charts | TradingView Lightweight Charts |
| Trading engine | Python 3.11+ |
| Hyperliquid | hyperliquid-python-sdk |
| Database | SQLite |
| Auto-updates | tauri-plugin-updater + GitHub Releases |

---

## System Architecture (Final)

```
┌─────────────────────────────────────────────────────────────┐
│                     TAURI APP                               │
├─────────────────────────────────────────────────────────────┤
│  FRONTEND (React + TypeScript)                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │Dashboard│ │ Systems │ │ Trades  │ │Settings │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
├─────────────────────────────────────────────────────────────┤
│  BACKEND (Python sidecar)                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TRADING ENGINE                                      │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐       │  │
│  │  │ Hyperliquid│ │  Strategy  │ │    Risk    │       │  │
│  │  │    API     │ │   Runner   │ │  Manager   │       │  │
│  │  └────────────┘ └────────────┘ └────────────┘       │  │
│  │                                                      │  │
│  │  STRATEGIES (Python classes)                         │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐       │  │
│  │  │  Breakout  │ │ Mean Rev   │ │  Custom    │       │  │
│  │  │  System    │ │  System    │ │  System    │       │  │
│  │  └────────────┘ └────────────┘ └────────────┘       │  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  RUST CORE (Tauri)                                          │
│  • Auto-updater  • File access  • System tray              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    HYPERLIQUID    │
                    └───────────────────┘
```

---

## Estimated Timeline

| Phase | Time | Outcome |
|-------|------|---------|
| Phase 1 | 1 week | App launches, connects to Hyperliquid |
| Phase 2 | 1 week | Can trade manually via app |
| Phase 3 | 2 weeks | First bot trading automatically |
| Phase 4 | 2 weeks | Multiple strategies running |
| Phase 5 | 2 weeks | Polished, auto-updates work |
| Phase 6 | 1 week | Ready to share |

**Total: ~9-10 weeks to full vision**

**To MVP (manual trading + one automated system): ~4 weeks**

---

## Why This Architecture?

| Decision | Reasoning |
|----------|-----------|
| Tauri over Electron | 10x smaller, faster, more secure |
| Python for trading | Industry standard, best libraries |
| React for UI | You know it, huge ecosystem |
| SQLite for data | No setup, portable, good enough |
| GitHub for updates | Free, reliable, easy |
| Local-first | Users control keys, no trust needed |

---

## Next Steps

When you're ready to build:

1. **Install prerequisites:**
   - Node.js 18+
   - Rust (for Tauri)
   - Python 3.11+

2. **Create project:**
   ```bash
   npm create tauri-app@latest hyperliquid-trader
   ```

3. **Start with Phase 1:**
   - Get the app launching
   - Connect to Hyperliquid (read-only)
   - Display account balance

---

## Summary

**The Stack:**
- Tauri (native app wrapper)
- React + TypeScript (frontend)
- Python (trading engine)
- SQLite (local database)
- GitHub Releases (auto-updates)

**The Benefits:**
- Beautiful native app
- Cross-platform (Win/Mac/Linux)
- Users hold their own keys
- Auto-updates built-in
- Free to distribute
- Can run 24/7 with VPS option

**The Path:**
- Start simple (manual trading)
- Add automation incrementally
- Polish and share when ready

**Saved for later. Focus on trading for now. Build when ready.**
