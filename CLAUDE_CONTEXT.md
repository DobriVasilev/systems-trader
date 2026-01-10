# CLAUDE CONTEXT - Read This First

**Last Updated:** January 2026

This file provides context for Claude to understand this project. Read this at the start of every conversation.

---

## What This Project Is

A **PNL/risk-focused trading platform** for Hyperliquid that:
1. Lets US users trade on Hyperliquid by routing requests through a Bulgarian server
2. Enables fast manual trade entry based on risk tolerance (not position size)
3. Will eventually support automated trading systems and backtesting

**Core Philosophy:** Budget = Risk. When you set $50 budget, that's your max loss, not your position size. The system calculates position size from your risk.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WEB APP (Next.js 15)                         │
│                     https://dobri.org                               │
│                     Hosted on Dell server in Bulgaria               │
├─────────────────────────────────────────────────────────────────────┤
│  /trading     - Manual trading (PNL-based entry)                    │
│  /bots        - Bot management UI                                   │
│  /sessions    - Pattern validation tool (collaborative)             │
│  /dashboard   - Main dashboard                                      │
│  /auth        - OAuth login (Google, GitHub)                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DELL SERVER (Bulgaria)                           │
│                    78.83.66.219 / dobri.org                         │
├─────────────────────────────────────────────────────────────────────┤
│  - Routes all Hyperliquid requests (US users get Bulgarian IP)      │
│  - Runs Next.js app via PM2                                         │
│  - Caddy reverse proxy with HTTPS                                   │
│  - Cloudflare CDN in front                                          │
│  - Daily encrypted backups to R2                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        HYPERLIQUID                                  │
│                    (Sees Bulgarian IP)                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
/systems-trader/
├── web/                      # Next.js 15 web app (MAIN APPLICATION)
│   ├── src/
│   │   ├── app/              # Next.js app router pages
│   │   ├── components/       # React components
│   │   └── lib/              # Core libraries
│   │       ├── hyperliquid.ts    # Hyperliquid SDK wrapper
│   │       ├── bot-runner.ts     # In-memory bot execution
│   │       ├── wallet-encryption.ts  # AES-256 wallet encryption
│   │       └── trading-client.ts     # Trade execution
│   └── prisma/               # Database schema
│
├── desktop/                  # Tauri desktop app (MVP - WORKS)
│   ├── src/src/              # React frontend
│   │   ├── App.tsx           # Main app (148K lines - monolith)
│   │   └── exchanges/        # Exchange integrations
│   └── src/lib.rs            # Rust backend
│
├── trading-engine/           # Python trading analysis
│   ├── patterns/             # Pattern detection (swings, BOS, MSB)
│   ├── indicators/           # Technical indicators
│   └── engine/               # Backtesting infrastructure
│
├── extension/                # TradingView browser extension
│   └── content.js            # Injects trading modal on TradingView
│
├── server-setup/             # Dell server infrastructure scripts
└── docs/                     # Documentation
```

---

## What's Built vs What's Pending

### COMPLETED
- [x] Tauri desktop app with manual trading (works standalone)
- [x] TradingView extension (works with Tauri)
- [x] Web app with trading UI, bot management, pattern tool
- [x] Dell server deployment in Bulgaria
- [x] Cloudflare CDN + HTTPS
- [x] OAuth login (Google, GitHub)
- [x] Encrypted wallet storage (AES-256-GCM)
- [x] Database schema (users, wallets, bots, trades)
- [x] Pattern detection algorithms (swings, BOS/MSB, ranges, false breakouts)
- [x] Technical indicators (RSI, MACD, ATR, VWAP, etc.)
- [x] Backtesting infrastructure (data structures, trade recording)
- [x] Daily encrypted backups to Cloudflare R2
- [x] Chat system with E2E encryption
- [x] Pattern validation tool (collaborative)

### IN PROGRESS
- [ ] Transfer Tauri trading functionality to web app
- [ ] Make extension work with web app (not just Tauri)
- [ ] Auto-deploy from GitHub to Dell server

### FUTURE (Not Now)
- [ ] Wire pattern detection to live bot execution
- [ ] Bot engine as 24/7 systemd service
- [ ] Automated backtesting
- [ ] Live automated trading systems

---

## Current Priority

**WEB-ONLY for simplicity.** The goal is:
1. Users access https://dobri.org
2. They can manually trade with PNL-based risk sizing
3. All requests route through Bulgaria (US users can use Hyperliquid)
4. No app installation required

The Tauri app works but requires installation. Web is easier for users.

---

## Key Files

| Purpose | File |
|---------|------|
| Hyperliquid trading | `/web/src/lib/hyperliquid.ts` |
| Wallet encryption | `/web/src/lib/wallet-encryption.ts` |
| Bot execution | `/web/src/lib/bot-runner.ts` |
| Trading UI | `/web/src/app/trading/page.tsx` |
| Database schema | `/web/prisma/schema.prisma` |
| Tauri main app | `/desktop/src/src/App.tsx` |
| Pattern detection | `/trading-engine/patterns/swings.py` |
| Server setup | `/server-setup/*.sh` |

---

## Environment

- **Dev machine:** MacBook (dobri)
- **Production server:** Dell Wyse 5070 in Bulgaria
  - IP: 78.83.66.219
  - Domain: dobri.org
  - User: dobri
  - App path: `/home/dobri/systems-trader/web`
- **Database:** Neon PostgreSQL (cloud)
- **Storage:** Cloudflare R2 (backups)
- **CDN:** Cloudflare (dobri.org proxied)

---

## Common Commands

```bash
# On MacBook - push changes
cd ~/Scripts/systems-trader && git add -A && git commit -m "message" && git push

# On Dell server - deploy (currently manual, setting up auto-deploy)
cd ~/systems-trader && git pull && cd web && npm run build && pm2 restart trading-app

# Run backup manually
sudo /usr/local/bin/backup-trading-app.sh

# Check server health
/usr/local/bin/health-check.sh

# View logs
pm2 logs trading-app
journalctl -u trading-app -f
```

---

## Important Context

1. **Tauri ≠ separate project.** It was the MVP to prove the concept. The trading logic in Tauri should be transferred to the web app.

2. **Extension needs updating.** Currently talks to Tauri (localhost:3456). Needs to work with web app for US users.

3. **Pattern detection is Python, trading is TypeScript.** These aren't connected yet. For now, focus on manual trading. Automation comes later.

4. **US users need Bulgarian IP.** They use VPN once to create Hyperliquid account/API key, then all trading goes through our server.

5. **PNL-based sizing is the killer feature.** Fast trade entry because you specify risk, not position size.

# test
