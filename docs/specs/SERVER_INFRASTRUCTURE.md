# Server Infrastructure - Dell Wyse 5070 Setup

**Last Updated:** 2026-01-05
**Status:** Planning (hardware ordered)

---

## Table of Contents

1. [Hardware](#1-hardware)
2. [Architecture Overview](#2-architecture-overview)
3. [What Runs Where](#3-what-runs-where)
4. [Network Architecture](#4-network-architecture)
5. [Security Model](#5-security-model)
6. [Data Storage](#6-data-storage)
7. [Operating Modes](#7-operating-modes)
8. [Setup Guide](#8-setup-guide)
9. [Maintenance](#9-maintenance)
10. [Backup Strategy](#10-backup-strategy)

---

## 1. Hardware

### Dell Wyse 5070 Specs

| Component | Spec |
|-----------|------|
| **CPU** | Intel Celeron/Pentium (x86_64) |
| **RAM** | 8GB |
| **Storage** | 128GB SSD |
| **Power** | ~10-15W (very low) |
| **Size** | Thin client form factor |
| **Cost** | ~€100-150 |

### Why Dell Wyse 5070?

| vs Raspberry Pi | vs Cloud VPS |
|-----------------|--------------|
| x86 architecture (easier) | One-time cost vs monthly |
| More RAM (8GB vs 4GB typical) | Full control |
| Real SSD (not SD card) | No bandwidth limits |
| Still low power | Bulgarian IP (no VPN needed) |
| Can run Docker easily | Physical access for recovery |

### Location

```
Bulgarian Apartment (Dobri's)
├── Internet Router (WiFi)
│   └── Dell Wyse 5070
│       ├── Connected via Ethernet (preferred) or WiFi
│       ├── Running 24/7/365
│       └── Power: Always on, ~€2/month electricity
```

---

## 2. Architecture Overview

### The Complete System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DELL WYSE 5070 (Bulgaria)                             │
│                        IP: Bulgarian (no VPN needed)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    TRADING SYSTEMS ENGINE                               │ │
│  │                    (Rust + React, from Tauri app)                       │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                         │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │ │
│  │  │  DATA LAYER     │  │ PATTERN LIBRARY │  │ INDICATOR LIB   │        │ │
│  │  │  (OHLCV cache)  │  │ (Swings, etc.)  │  │ (RSI, MA, etc.) │        │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │ │
│  │                                                                         │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │ │
│  │  │ BACKTEST ENGINE │  │  LIVE ENGINE    │  │  SYSTEM PARSER  │        │ │
│  │  │ (replay mode)   │  │ (real trades)   │  │  (YAML configs) │        │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         WEB SERVER                                      │ │
│  │                         (HTTPS via Caddy)                               │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │  • Serves React dashboard                                               │ │
│  │  • WebSocket for real-time updates                                      │ │
│  │  • REST API for system control                                          │ │
│  │  • Authentication required                                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         DATA STORAGE                                    │ │
│  │                         (SQLite, local)                                 │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │  • Historical candles (OHLCV)                                           │ │
│  │  • System configurations (YAML)                                         │ │
│  │  • Backtest results                                                     │ │
│  │  • Trade history                                                        │ │
│  │  • Encrypted API keys                                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         WIREGUARD VPN                                   │ │
│  │                         (for remote access)                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS / WSS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HYPERLIQUID                                     │
│                              (API + WebSocket)                               │
└─────────────────────────────────────────────────────────────────────────────┘

                    ▲                               ▲
                    │ WireGuard VPN                 │ HTTPS (web dashboard)
                    │                               │
        ┌───────────┴───────────┐       ┌──────────┴──────────┐
        │   YOUR MACBOOK        │       │   YOUR PHONE        │
        │   (anywhere in world) │       │   (anywhere)        │
        │                       │       │                     │
        │   • Full VPN access   │       │   • View dashboard  │
        │   • SSH for admin     │       │   • Monitor trades  │
        │   • Development       │       │   • Quick controls  │
        └───────────────────────┘       └─────────────────────┘
```

---

## 3. What Runs Where

### On the Dell Wyse (Bulgaria)

| Component | Purpose |
|-----------|---------|
| **Trading Systems Engine** | Core logic - patterns, indicators, signals |
| **Backtest Engine** | Run backtests on historical data |
| **Live Trading Engine** | Execute real trades 24/7 |
| **Web Dashboard Server** | React app served via HTTPS |
| **SQLite Database** | All local data storage |
| **WireGuard VPN** | Secure remote access |
| **Caddy** | Reverse proxy, auto HTTPS |

### On Your Devices (MacBook, Phone, etc.)

| Component | Purpose |
|-----------|---------|
| **Web Browser** | Access dashboard from anywhere |
| **WireGuard Client** | VPN tunnel to server (optional) |
| **Development Tools** | VS Code, Claude Code (when coding) |

### On GitHub

| Component | Purpose |
|-----------|---------|
| **Source Code** | Version control, backup |
| **Releases** | Auto-update distribution |
| **Issues** | Bug tracking |

### NOT Needed

| Service | Why Not |
|---------|---------|
| Vercel | No serverless needed, we have real server |
| Neon/Supabase | SQLite is simpler, no external dependency |
| AWS/GCP | Overkill, self-hosted is better for this |
| VPN service | WireGuard on own server is free |

---

## 4. Network Architecture

### Port Usage

| Port | Protocol | Service | Exposed To |
|------|----------|---------|------------|
| 443 | TCP | HTTPS (Web Dashboard) | Internet |
| 51820 | UDP | WireGuard VPN | Internet |
| 22 | TCP | SSH | WireGuard only |

### Domain Setup

```
trader.yourdomain.com  →  Bulgarian Home IP (dynamic DNS)
        │
        ▼
  [Home Router]
        │
   Port Forward:
   443 → Wyse:443
   51820 → Wyse:51820
        │
        ▼
  [Dell Wyse 5070]
   Caddy handles HTTPS
   WireGuard handles VPN
```

### Options for Domain

| Option | Cost | Effort |
|--------|------|--------|
| **DuckDNS** | Free | Easy, dynamic DNS |
| **Own domain** | ~€10/year | More professional |
| **Cloudflare Tunnel** | Free | No port forwarding needed |

---

## 5. Security Model

### Threat Model

| Threat | Risk | Mitigation |
|--------|------|------------|
| **API key theft (network)** | Medium | HTTPS everywhere, keys never transmitted after setup |
| **API key theft (at rest)** | Low | AES-256-GCM encryption, password-derived key |
| **Unauthorized access** | Medium | Strong password + optional 2FA |
| **Brute force attack** | Low | Rate limiting, fail2ban |
| **Man-in-the-middle** | Low | HTTPS with valid cert (Let's Encrypt) |
| **Physical theft** | Very Low | Server in your apartment, encrypted storage |
| **Router compromise** | Low | Only 2 ports exposed, firewall on Wyse |

### Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: NETWORK                                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  • UFW firewall (only ports 443, 51820 open)                           │ │
│  │  • Fail2ban for brute force protection                                 │ │
│  │  • WireGuard for admin access (SSH only via VPN)                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  LAYER 2: TRANSPORT                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  • HTTPS with TLS 1.3 (Let's Encrypt certificate)                      │ │
│  │  • WireGuard encryption (ChaCha20-Poly1305)                            │ │
│  │  • No plain HTTP ever                                                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  LAYER 3: APPLICATION                                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  • Password authentication (Argon2id hashing)                          │ │
│  │  • Session tokens (short expiry, HTTP-only cookies)                    │ │
│  │  • Rate limiting on all endpoints                                      │ │
│  │  • CSRF protection                                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  LAYER 4: DATA                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  • API keys encrypted at rest (AES-256-GCM)                            │ │
│  │  • Encryption key derived from user password (Argon2id)                │ │
│  │  • Keys decrypted only in memory when needed                           │ │
│  │  • SQLite database with restricted permissions                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### API Key Storage

```
User enters API key (one time)
        │
        ▼
Password → [Argon2id] → Encryption Key
        │
        ▼
API Key + Encryption Key → [AES-256-GCM] → Encrypted Blob
        │
        ▼
Stored in: /home/trader/data/keys.enc

On startup:
User enters password → Derives key → Decrypts API key → Held in memory only
```

### Is Local More or Less Secure Than Cloud?

**More secure because:**
- You control the hardware physically
- No cloud provider employees have access
- No multi-tenant risks
- Keys never leave your network

**Less secure because:**
- You're responsible for updates/patches
- Home network may be less hardened than datacenter
- Physical theft possible (but unlikely)

**Bottom line:** For a personal trading server, self-hosted is MORE secure if you keep it updated.

---

## 6. Data Storage

### SQLite Database Schema

```sql
-- Historical candle data
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

-- Trading systems
CREATE TABLE systems (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    config_yaml TEXT NOT NULL,  -- Full YAML config
    status TEXT DEFAULT 'inactive',  -- active, inactive, backtesting
    created_at INTEGER,
    updated_at INTEGER
);

-- Backtest results
CREATE TABLE backtests (
    id TEXT PRIMARY KEY,
    system_id TEXT NOT NULL,
    config_snapshot TEXT NOT NULL,  -- YAML at time of backtest
    start_date TEXT,
    end_date TEXT,
    results_json TEXT,  -- Full results including trades
    created_at INTEGER,
    FOREIGN KEY (system_id) REFERENCES systems(id)
);

-- Live trades
CREATE TABLE trades (
    id TEXT PRIMARY KEY,
    system_id TEXT,
    direction TEXT NOT NULL,  -- long, short
    entry_price REAL,
    exit_price REAL,
    entry_time INTEGER,
    exit_time INTEGER,
    stop_loss REAL,
    take_profit REAL,
    pnl_r REAL,
    pnl_usd REAL,
    status TEXT,  -- open, closed, cancelled
    FOREIGN KEY (system_id) REFERENCES systems(id)
);

-- Encrypted credentials (separate file, not in main DB)
-- Stored in keys.enc, encrypted with user password
```

### Storage Estimates

| Data Type | Size | Growth |
|-----------|------|--------|
| 1 year M30 BTC candles | ~500KB | Fixed |
| 1 year M1 BTC candles | ~15MB | Fixed |
| 10 assets × 5 timeframes × 1 year | ~300MB | ~300MB/year |
| System configs | <1MB | Minimal |
| Trade history | ~10MB/year | ~10MB/year |
| Backtest results | ~100MB/year | Depends on usage |
| **Total Year 1** | **~500MB** | |
| **Total Year 5** | **~2GB** | |

**128GB SSD = plenty of space**

---

## 7. Operating Modes

### Mode 1: Full Server (Recommended)

```
┌─────────────────┐                    ┌─────────────────┐
│  Your Device    │                    │  Dell Wyse      │
│  (anywhere)     │                    │  (Bulgaria)     │
│                 │    HTTPS/WSS       │                 │
│  Browser only   │───────────────────▶│  Everything     │
│  No trading     │                    │  runs here      │
│  logic          │                    │                 │
└─────────────────┘                    └─────────────────┘
                                              │
                                              ▼
                                       [Hyperliquid]

Best for:
- 24/7 automated trading
- Access from any device
- Low-power devices (phone, Chromebook)
- When traveling / in US
```

### Mode 2: Development Mode

```
┌─────────────────┐                    ┌─────────────────┐
│  Your MacBook   │                    │  Dell Wyse      │
│  (local)        │                    │  (Bulgaria)     │
│                 │    WireGuard       │                 │
│  Full dev       │───────────────────▶│  Production     │
│  environment    │                    │  reference      │
│                 │                    │                 │
└─────────────────┘                    └─────────────────┘
        │
        ▼
  [Hyperliquid]
  (direct, if in EU)

Best for:
- Writing new systems
- Testing changes locally
- Debugging
```

### Mode 3: Hybrid (Future)

```
┌─────────────────┐                    ┌─────────────────┐
│  Tauri Desktop  │                    │  Dell Wyse      │
│  App            │                    │  (Bulgaria)     │
│                 │    Sync API        │                 │
│  Local UI +     │◄──────────────────▶│  Backend        │
│  some caching   │                    │  execution      │
│                 │                    │                 │
└─────────────────┘                    └─────────────────┘

Best for:
- Rich desktop experience
- Offline system editing
- Sync when connected
```

---

## 8. Setup Guide

### Phase 1: Basic OS Setup

```bash
# 1. Download Ubuntu Server 22.04 LTS
# 2. Flash to USB drive (use Balena Etcher)
# 3. Boot Dell Wyse from USB, install to internal SSD

# After install, SSH in:
ssh user@wyse-local-ip

# Update everything
sudo apt update && sudo apt upgrade -y

# Set hostname
sudo hostnamectl set-hostname trader

# Configure timezone
sudo timedatectl set-timezone Europe/Sofia
```

### Phase 2: Security Hardening

```bash
# Install and configure firewall
sudo apt install ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 51820/udp  # WireGuard
sudo ufw enable

# Install fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban

# Disable password SSH (use keys only)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### Phase 3: WireGuard VPN

```bash
# Install WireGuard
sudo apt install wireguard

# Generate server keys
wg genkey | sudo tee /etc/wireguard/private.key
sudo chmod 600 /etc/wireguard/private.key
sudo cat /etc/wireguard/private.key | wg pubkey | sudo tee /etc/wireguard/public.key

# Create config
sudo nano /etc/wireguard/wg0.conf
```

```ini
# /etc/wireguard/wg0.conf
[Interface]
PrivateKey = <server-private-key>
Address = 10.0.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
# Your MacBook
PublicKey = <macbook-public-key>
AllowedIPs = 10.0.0.2/32

[Peer]
# Your Phone
PublicKey = <phone-public-key>
AllowedIPs = 10.0.0.3/32
```

```bash
# Enable and start
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
```

### Phase 4: Dynamic DNS

```bash
# Option A: DuckDNS (free)
# 1. Go to duckdns.org, create account
# 2. Create subdomain: yourname.duckdns.org
# 3. Set up update script

mkdir -p ~/scripts
nano ~/scripts/duckdns.sh
```

```bash
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=YOURSUBDOMAIN&token=YOUR-TOKEN&ip=" | curl -k -o ~/duckdns.log -K -
```

```bash
chmod +x ~/scripts/duckdns.sh
crontab -e
# Add: */5 * * * * ~/scripts/duckdns.sh  # Update every 5 min
```

### Phase 5: Web Server (Caddy)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Configure
sudo nano /etc/caddy/Caddyfile
```

```
yourname.duckdns.org {
    reverse_proxy localhost:3000  # Trading app
    encode gzip
}
```

```bash
sudo systemctl restart caddy
```

### Phase 6: Trading Application

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clone trading app (when ready)
git clone https://github.com/DobriVasilev/hyperliquid-trader.git
cd hyperliquid-trader

# Build and run (details TBD based on final architecture)
npm install
npm run build
# Run as service via systemd
```

### Phase 7: Systemd Service

```bash
sudo nano /etc/systemd/system/trader.service
```

```ini
[Unit]
Description=Hyperliquid Trading Systems Engine
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/hyperliquid-trader
ExecStart=/home/trader/hyperliquid-trader/target/release/trading-server
Restart=always
RestartSec=10
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable trader
sudo systemctl start trader
```

---

## 9. Maintenance

### Regular Tasks

| Task | Frequency | How |
|------|-----------|-----|
| **System updates** | Weekly | `sudo apt update && sudo apt upgrade` |
| **Check logs** | Daily (automated) | Dashboard shows alerts |
| **Backup** | Daily (automated) | Script to encrypted cloud |
| **Certificate renewal** | Auto | Caddy handles this |
| **DuckDNS update** | Every 5 min | Cron job |

### Monitoring

```bash
# Check if services are running
systemctl status trader
systemctl status caddy
systemctl status wg-quick@wg0

# Check disk space
df -h

# Check memory
free -m

# Check trading logs
journalctl -u trader -f
```

### Remote Access

```bash
# From your MacBook (via WireGuard):
ssh trader@10.0.0.1

# Or via web dashboard at:
https://yourname.duckdns.org
```

---

## 10. Backup Strategy

### What to Backup

| Data | Location | Priority |
|------|----------|----------|
| System configs | `/home/trader/data/systems/` | Critical |
| Encrypted keys | `/home/trader/data/keys.enc` | Critical |
| Trade history | `/home/trader/data/trades.db` | High |
| Historical candles | `/home/trader/data/candles.db` | Low (can re-fetch) |
| WireGuard configs | `/etc/wireguard/` | Medium |

### Backup Script

```bash
#!/bin/bash
# /home/trader/scripts/backup.sh

BACKUP_DIR="/home/trader/backups"
DATE=$(date +%Y%m%d)

# Create backup
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/backup-$DATE.tar.gz \
    /home/trader/data/systems \
    /home/trader/data/keys.enc \
    /home/trader/data/trades.db \
    /etc/wireguard

# Encrypt backup
gpg --symmetric --cipher-algo AES256 $BACKUP_DIR/backup-$DATE.tar.gz
rm $BACKUP_DIR/backup-$DATE.tar.gz

# Upload to cloud (rclone to Google Drive / S3 / etc.)
rclone copy $BACKUP_DIR/backup-$DATE.tar.gz.gpg remote:trader-backups/

# Keep only last 7 days locally
find $BACKUP_DIR -name "backup-*.gpg" -mtime +7 -delete
```

### Recovery

```bash
# Download backup
rclone copy remote:trader-backups/backup-YYYYMMDD.tar.gz.gpg /tmp/

# Decrypt
gpg -d /tmp/backup-YYYYMMDD.tar.gz.gpg > /tmp/backup.tar.gz

# Extract
tar -xzf /tmp/backup.tar.gz -C /

# Restart services
sudo systemctl restart trader
```

---

## Summary

### Architecture Decision

| Question | Answer |
|----------|--------|
| Where does code live? | GitHub (version control) |
| Where does data live? | Dell Wyse (SQLite, local) |
| Where do trades execute? | Dell Wyse (24/7, Bulgarian IP) |
| How do you access it? | Web dashboard (HTTPS) or WireGuard |
| Do you need cloud services? | No - fully self-hosted |

### Cost Summary

| Item | Cost |
|------|------|
| Dell Wyse 5070 | ~€100-150 (one-time) |
| Domain (optional) | €10/year |
| Electricity | ~€2/month |
| DuckDNS | Free |
| Let's Encrypt | Free |
| **Total Year 1** | **~€150** |
| **Total Ongoing** | **~€35/year** |

### Security Summary

| Layer | Protection |
|-------|------------|
| Network | UFW firewall, only 2 ports open |
| Access | WireGuard VPN for admin, HTTPS for web |
| Authentication | Password + optional 2FA |
| Data | AES-256-GCM encryption for keys |
| Updates | Automated via systemd timers |

---

## Next Steps

1. **Wait for Dell Wyse to arrive**
2. **Flash Ubuntu Server 22.04**
3. **Follow setup guide phases 1-4**
4. **Build Trading Systems Engine (in progress)**
5. **Deploy to Wyse (phase 5-7)**
6. **Configure backups**
7. **Test from phone/laptop**

---

*Document created: 2026-01-05*
*Hardware: Dell Wyse 5070 (128GB SSD, 8GB RAM)*
*Status: Planning - waiting for hardware*
