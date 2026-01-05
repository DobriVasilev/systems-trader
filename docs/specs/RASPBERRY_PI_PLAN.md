# Raspberry Pi Server Architecture Plan

## Overview

This document outlines the vision for running the TradingView Bridge app on a Raspberry Pi server in Bulgaria, enabling US-based users (and others in restricted regions) to trade on Hyperliquid without VPN issues on their local devices.

---

## The Problem We're Solving

1. **Hyperliquid blocks US users** - requires VPN which is against ToS
2. **Friend's Chromebook is too weak** - can barely run the app
3. **24/7 trading needed** - can't rely on personal devices being always on
4. **Multiple users** - friends want to use the system too
5. **Security** - API keys must be protected, no MITM attacks

---

## The Solution

A Raspberry Pi 4 (8GB) running in Bulgaria acts as:
- The trading execution server (Bulgarian IP = no Hyperliquid blocks)
- A secure gateway for multiple users
- A 24/7 always-on system
- A web dashboard accessible from anywhere

---

## Hardware

### Confirmed Setup
- **Device:** Raspberry Pi 4 8GB (borrowed from friend - FREE)
- **Storage:** External USB Hard Disk (user already has)
- **Power Supply:** Included with Pi
- **Case/Cooling:** Included with Pi
- **Location:** Bulgaria (user's parents' house)
- **Internet:** Home WiFi connection

### Why Pi 4 8GB is Sufficient
- Trading bot = just API calls (minimal CPU/RAM)
- Web dashboard = lightweight Node.js server
- WireGuard VPN = minimal overhead
- 8GB RAM is overkill for this use case

### Reliability Measures
- Boot from USB hard disk (NOT SD card) - avoids SD card corruption
- UPS recommended but optional for home use
- Parents instructed not to turn off Pi or router

---

## Architecture

### Three Operating Modes

Users can choose how they want to use the system:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MODE 1: FULL SERVER                                │
│                        (Recommended for US users)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   [User's Device]          [Raspberry Pi in Bulgaria]         [Hyperliquid] │
│   (Chromebook/Phone)              │                                │        │
│         │                         │                                │        │
│         │  HTTPS/WSS              │                                │        │
│         │  (view dashboard)       │     Bulgarian IP               │        │
│         └────────────────────────►│◄───────────────────────────────┘        │
│                                   │                                          │
│   - Device is just a viewer       │  - Runs trading bot 24/7                │
│   - No heavy processing           │  - Executes all trades                  │
│   - Can use any browser           │  - Stores encrypted API keys            │
│   - Works on crappy hardware      │  - Serves web dashboard                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           MODE 2: VPN PROXY ONLY                             │
│                    (For users who want local control)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   [User's Device]          [Raspberry Pi in Bulgaria]         [Hyperliquid] │
│   (runs full app)                 │                                │        │
│         │                         │                                │        │
│         │  WireGuard VPN          │     Bulgarian IP               │        │
│         └────────────────────────►│────────────────────────────────►        │
│                                   │                                          │
│   - Full app runs locally         │  - Just forwards traffic                │
│   - More CPU usage on device      │  - No trading logic                     │
│   - Device must be on to trade    │  - Simple VPN server                    │
│   - User has full control         │  - Minimal resource usage               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           MODE 3: NO PI (Direct)                             │
│                      (For EU users, no restrictions)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   [User's Device]                                              [Hyperliquid] │
│   (runs full app)                                                  │        │
│         │                                                          │        │
│         │  Direct connection (EU IP)                               │        │
│         └──────────────────────────────────────────────────────────►        │
│                                                                              │
│   - Standard local app usage                                                 │
│   - No Pi involved                                                           │
│   - For users not in restricted regions                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Web Dashboard Vision

### Design Principles
1. **User-friendly** - No technical knowledge required
2. **Clean UI** - Modern, minimal, easy to understand
3. **Secure** - HTTPS only, encrypted everything
4. **Responsive** - Works on phone, tablet, desktop
5. **Real-time** - Live updates via WebSocket

### Dashboard Features

```
┌─────────────────────────────────────────────────────────────────┐
│  TradingView Bridge - Web Dashboard                    [User ▼] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   SERVER     │  │   BALANCE    │  │   TODAY'S    │           │
│  │   ● Online   │  │   $12,450    │  │   P&L: +$340 │           │
│  │   Uptime: 5d │  │   Available  │  │   +2.73%     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ACTIVE POSITIONS                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ BTC-PERP  │ LONG  │ 0.5 BTC │ Entry: $67,200 │ PnL: +$120 │ │
│  │ ETH-PERP  │ SHORT │ 2.0 ETH │ Entry: $3,450  │ PnL: -$45  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ACTIVE SYSTEMS                                          [+ Add] │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ● BTC Scalper      │ Running │ 12 trades today │ [Pause]  │ │
│  │ ● ETH Swing        │ Running │ 2 trades today  │ [Pause]  │ │
│  │ ○ SOL Momentum     │ Paused  │ -               │ [Start]  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  RECENT TRADES                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 14:32 │ BTC │ BUY  │ 0.1 @ $67,150 │ Filled │ BTC Scalper │ │
│  │ 14:28 │ BTC │ SELL │ 0.1 @ $67,230 │ Filled │ BTC Scalper │ │
│  │ 13:45 │ ETH │ SELL │ 1.0 @ $3,460  │ Filled │ ETH Swing   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Settings]  [Logs]  [Emergency Stop All]                        │
└─────────────────────────────────────────────────────────────────┘
```

### Settings Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings                                              [← Back] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CONNECTION MODE                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ○ Full Server Mode (Recommended for US)                    │ │
│  │   Pi runs everything, your device just views               │ │
│  │                                                             │ │
│  │ ○ VPN Proxy Mode                                           │ │
│  │   Your device runs app, Pi provides Bulgarian IP           │ │
│  │                                                             │ │
│  │ ○ Direct Mode (EU users only)                              │ │
│  │   Connect directly, no Pi needed                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  API WALLET                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Status: ● Connected                                        │ │
│  │ Address: 0x1234...5678                                     │ │
│  │ [Change Wallet]  [Revoke Access]                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  NOTIFICATIONS                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [✓] Browser notifications                                  │ │
│  │ [✓] Email alerts (critical only)                           │ │
│  │ [ ] Telegram notifications                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  SECURITY                                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [Change Password]                                          │ │
│  │ [View Connected Devices]                                   │ │
│  │ [Download Backup]                                          │ │
│  │ [Emergency Withdraw]                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Architecture

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Man-in-the-middle attack | HTTPS with valid SSL certificate (Let's Encrypt) |
| API key theft in transit | Keys never sent over network after initial setup |
| API key theft at rest | Encrypted storage with user's password |
| Unauthorized access | Password + optional 2FA |
| Session hijacking | Secure HTTP-only cookies, short expiry |
| Brute force | Rate limiting, account lockout |
| Network sniffing | WireGuard encryption for all traffic |

### Key Security Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. API KEYS NEVER LEAVE THE PI                                  │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ User enters key once → Encrypted → Stored on Pi     │     │
│     │ Key decrypted only in memory when needed            │     │
│     │ Never sent back to user's browser                   │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                  │
│  2. ALL CONNECTIONS ENCRYPTED                                    │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ Browser ←──HTTPS──→ Pi ←──HTTPS──→ Hyperliquid      │     │
│     │         (TLS 1.3)      (TLS 1.3)                    │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                  │
│  3. WIREGUARD FOR REMOTE ACCESS                                  │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ User device ←──WireGuard──→ Pi                      │     │
│     │ (ChaCha20 encryption, no logging)                   │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                  │
│  4. DEFENSE IN DEPTH                                             │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ - UFW firewall (only ports 443, 51820 open)         │     │
│     │ - Fail2ban for brute force protection               │     │
│     │ - No root SSH, key-only authentication              │     │
│     │ - Automatic security updates                         │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Encryption Details

```
KEY STORAGE:
┌─────────────────────────────────────────────────────────────────┐
│ User's API Key                                                   │
│        │                                                         │
│        ▼                                                         │
│ [AES-256-GCM Encryption] ◄─── User's Password (via Argon2id)    │
│        │                                                         │
│        ▼                                                         │
│ Encrypted blob stored in: /home/pi/.tradingbot/keys.enc         │
│                                                                  │
│ On startup:                                                      │
│ - User enters password via web dashboard                         │
│ - Password derives key via Argon2id                              │
│ - API key decrypted into memory only                             │
│ - Password/key never stored, never logged                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Multi-User Support

### Architecture for Multiple Friends

```
┌─────────────────────────────────────────────────────────────────┐
│                     RASPBERRY PI SERVER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    TRADING ENGINE                        │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │   USER A     │  │   USER B     │  │   USER C     │   │    │
│  │  │  (You)       │  │  (US Friend) │  │  (Other)     │   │    │
│  │  ├──────────────┤  ├──────────────┤  ├──────────────┤   │    │
│  │  │ API Wallet A │  │ API Wallet B │  │ API Wallet C │   │    │
│  │  │ Systems: 3   │  │ Systems: 2   │  │ Systems: 1   │   │    │
│  │  │ Encrypted    │  │ Encrypted    │  │ Encrypted    │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │    │
│  │                                                          │    │
│  │  Each user:                                              │    │
│  │  - Has their own encrypted API wallet                    │    │
│  │  - Can only see/control their own systems                │    │
│  │  - Isolated from other users                             │    │
│  │  - Can revoke access anytime                             │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    WEB SERVER (HTTPS)                    │    │
│  │                    Port 443                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           ▲                                      │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   [User A]            [User B]            [User C]
   (Bulgaria)          (USA via WG)        (Anywhere)
```

### User Isolation

- Each user has separate encrypted key storage
- Users authenticate with their own password
- No user can see another user's data
- Admin (you) can add/remove users
- Each user's API wallet is theirs alone (they created it on Hyperliquid)

---

## Network Architecture

### Port Usage

| Port | Protocol | Purpose | Exposed To |
|------|----------|---------|------------|
| 443 | TCP | HTTPS Web Dashboard | Internet (via DuckDNS) |
| 51820 | UDP | WireGuard VPN | Internet |
| 22 | TCP | SSH (admin only) | WireGuard only |

### Domain Setup

```
yourname.duckdns.org → Your Bulgaria Home IP (dynamic)
                           │
                           ▼
                    [Home Router]
                           │
              ┌────────────┼────────────┐
              │            │            │
         Port 443     Port 51820    (blocked)
              │            │
              ▼            ▼
        [Pi: HTTPS]  [Pi: WireGuard]
```

### Firewall Rules (UFW)

```bash
# Default deny incoming
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow HTTPS (web dashboard)
sudo ufw allow 443/tcp

# Allow WireGuard
sudo ufw allow 51820/udp

# Enable firewall
sudo ufw enable
```

---

## Implementation Phases

### Phase 1: Basic Setup (When Pi Arrives)
- [ ] Flash Ubuntu Server to USB hard disk
- [ ] Boot Pi, configure basic settings
- [ ] Set up SSH with key authentication
- [ ] Install Node.js/Python runtime
- [ ] Configure firewall (UFW)
- [ ] Set up DuckDNS dynamic DNS
- [ ] Test basic connectivity

### Phase 2: Trading Backend
- [ ] Port Hyperliquid trading logic to standalone service
- [ ] Implement encrypted key storage
- [ ] Create webhook receiver for TradingView
- [ ] Test trade execution
- [ ] Implement position monitoring
- [ ] Add logging system

### Phase 3: WireGuard VPN
- [ ] Install and configure WireGuard
- [ ] Generate server keys
- [ ] Create client configurations for users
- [ ] Set up port forwarding on router
- [ ] Test VPN connectivity from remote location
- [ ] Document user setup process

### Phase 4: Web Dashboard
- [ ] Set up HTTPS with Let's Encrypt
- [ ] Build React frontend (or simple HTML/JS)
- [ ] Implement authentication system
- [ ] Create dashboard UI (positions, P&L, systems)
- [ ] Add real-time updates via WebSocket
- [ ] Build settings page
- [ ] Implement user management (add friends)

### Phase 5: Multi-User Support
- [ ] Implement user accounts
- [ ] Separate storage per user
- [ ] Add user invitation system
- [ ] Test multi-user isolation
- [ ] Add admin controls

### Phase 6: Polish & Security Hardening
- [ ] Security audit
- [ ] Add rate limiting
- [ ] Implement 2FA (optional)
- [ ] Create backup/restore system
- [ ] Write user documentation
- [ ] Performance optimization

---

## Tech Stack

### Backend
- **Runtime:** Node.js 20 LTS (or Python 3.11)
- **Framework:** Express.js (or FastAPI for Python)
- **Database:** SQLite (simple, no separate server)
- **Encryption:** libsodium (Argon2id + AES-256-GCM)

### Frontend
- **Framework:** React (reuse existing components) or vanilla JS
- **Styling:** CSS (reuse existing styles)
- **Real-time:** WebSocket

### Infrastructure
- **OS:** Ubuntu Server 22.04 LTS
- **Process Manager:** PM2 (auto-restart, logs)
- **Reverse Proxy:** Caddy (automatic HTTPS)
- **VPN:** WireGuard
- **DNS:** DuckDNS

---

## File Structure on Pi

```
/home/pi/
├── tradingbot/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── index.js          # Main entry point
│   │   │   ├── trading.js        # Hyperliquid trading logic
│   │   │   ├── webhook.js        # TradingView webhook handler
│   │   │   ├── auth.js           # Authentication
│   │   │   ├── crypto.js         # Encryption utilities
│   │   │   └── websocket.js      # Real-time updates
│   │   ├── package.json
│   │   └── .env                  # Environment variables (not in git)
│   │
│   ├── frontend/
│   │   ├── dist/                 # Built static files
│   │   └── ...
│   │
│   └── data/
│       ├── users/
│       │   ├── user_a.enc        # Encrypted user data
│       │   └── user_b.enc
│       ├── db.sqlite             # Trade history, settings
│       └── logs/
│           └── trades.log
│
├── .wireguard/
│   └── ... (WireGuard configs)
│
└── scripts/
    ├── backup.sh
    ├── update.sh
    └── health-check.sh
```

---

## Backup Strategy

### What to Backup
- `/home/pi/tradingbot/data/` - All user data and trade history
- WireGuard configurations
- Let's Encrypt certificates

### Backup Schedule
- Daily automated backup to encrypted cloud storage
- Or manual backup via web dashboard "Download Backup" button

### Recovery
- Fresh Pi setup + restore from backup = back online in 30 minutes

---

## Monitoring & Alerts

### Health Checks
- Server uptime monitoring
- Trading engine status
- Hyperliquid API connectivity
- Disk space usage
- Memory usage

### Alerts (Optional)
- Email alerts for critical issues
- Browser notifications for trades
- Optional Telegram integration

---

## User Onboarding Flow

### For New Users (Friends)

```
1. You (admin) create invite link
   └── Unique one-time link sent to friend

2. Friend opens link in browser
   └── Creates account (username + password)

3. Friend connects their Hyperliquid API wallet
   └── Goes to app.hyperliquid.xyz
   └── Creates API wallet (can only trade, not withdraw)
   └── Enters API private key in dashboard
   └── Key encrypted immediately, never leaves Pi

4. Friend sets up WireGuard (if in US)
   └── Downloads config file from dashboard
   └── Imports into WireGuard app
   └── Connects to Pi

5. Friend creates trading systems
   └── Uses dashboard to configure strategies
   └── Systems run 24/7 on Pi

6. Friend monitors via dashboard
   └── Can view from any device
   └── Chromebook, phone, etc.
```

---

## Cost Summary

| Item | Cost |
|------|------|
| Raspberry Pi 4 8GB | FREE (borrowed) |
| USB Hard Disk | FREE (already owned) |
| Power Supply | FREE (included) |
| Case/Cooling | FREE (included) |
| DuckDNS Domain | FREE |
| Let's Encrypt SSL | FREE |
| **Total** | **€0** |

vs. Dell Wyse 5070: €111
vs. VPS hosting: €5-10/month ongoing

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Pi hardware failure | Low | High | Daily backups, can restore to new Pi or Dell |
| Internet outage at home | Medium | Medium | Alert system, manual intervention |
| Power outage | Low | Low | Pi resumes on power restore |
| SD card failure | N/A | N/A | Using USB hard disk instead |
| Security breach | Low | High | Encryption, firewall, regular updates |
| Parents turn off Pi | Low | Low | Clear instructions, labeled device |

---

## Future Enhancements (After MVP)

- [ ] Mobile app (React Native)
- [ ] More exchanges (not just Hyperliquid)
- [ ] Advanced analytics dashboard
- [ ] Paper trading mode
- [ ] Strategy backtesting
- [ ] Social features (share strategies with friends)
- [ ] Automated portfolio rebalancing

---

## Questions to Resolve

1. **Domain:** Use DuckDNS or buy a real domain? (DuckDNS is fine for now)
2. **Backup location:** Where to store encrypted backups?
3. **Multiple Pis:** If system grows, how to scale?
4. **Legal:** Any concerns with running trading infrastructure for friends?

---

## Next Steps (When Pi Arrives)

1. Get Pi from friend
2. Flash Ubuntu Server to USB hard disk
3. Basic setup (SSH, firewall, updates)
4. Install WireGuard, test connectivity
5. Port trading logic to backend service
6. Build web dashboard
7. Test with real trades (small amounts)
8. Invite first friend to test
9. Iterate based on feedback

---

*Document created: January 2026*
*Last updated: January 2026*
*Status: PLANNING - Implementation pending hardware arrival*
