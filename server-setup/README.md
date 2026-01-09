# Trading Server Setup - Complete Guide

Industry-standard production server setup for the Systems Trader application.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Dell Wyse 5070 (Ubuntu Server 24.04)                      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Caddy      │  │  Next.js     │  │ PostgreSQL   │     │
│  │  (Port 80)   │──│  (Port 3000) │──│  (Port 5432) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  WireGuard   │  │   Fail2ban   │  │  Auto-Backup │     │
│  │ (Port 51820) │  │   Security   │  │  Daily 2 AM  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          ↓
              Internet (Bulgarian IP)
                          ↓
            ┌─────────────┴─────────────┐
            │                           │
       [Your Mac]                   [Friends]
```

## Quick Start

### 1. Install Ubuntu Server (One-time, at server)

See: [00-ubuntu-installation.md](./00-ubuntu-installation.md)

**Summary:**
- Download Ubuntu Server 24.04 LTS on Mac
- Create bootable USB with balenaEtcher
- Boot Dell from USB, install Ubuntu
- Note the server IP address!

### 2. Remote Setup (From Mac via SSH)

```bash
# SSH into server
ssh dobri@YOUR_SERVER_IP

# Clone repo
git clone https://github.com/DobriVasilev/systems-trader.git
cd systems-trader/server-setup

# Make scripts executable
chmod +x *.sh

# Run setup (in order)
sudo ./01-security-hardening.sh      # 5 min
sudo ./02-install-caddy.sh           # 2 min
sudo ./03-install-nodejs.sh          # 3 min
sudo ./04-install-postgres.sh        # 2 min
./05-deploy-app.sh                   # 10 min (as normal user)
sudo ./06-setup-wireguard.sh         # 3 min (optional)
sudo ./07-setup-backups.sh           # 2 min
sudo ./08-setup-monitoring.sh        # 2 min

# Total time: ~30 minutes
```

### 3. Configure & Test

```bash
# Edit environment variables
nano ~/systems-trader/web/.env

# Restart app
sudo systemctl restart trading-app

# Test locally
curl http://localhost:3000

# Check status
systemctl status trading-app
```

### 4. Access Your App

From any device: `http://YOUR_SERVER_IP`

## Scripts Reference

| Script | Purpose | Sudo? | Time |
|--------|---------|-------|------|
| `01-security-hardening.sh` | UFW, Fail2ban, SSH, auto-updates | ✓ | 5 min |
| `02-install-caddy.sh` | Web server, reverse proxy | ✓ | 2 min |
| `03-install-nodejs.sh` | Node.js 20, npm, pnpm | ✓ | 3 min |
| `04-install-postgres.sh` | Database setup | ✓ | 2 min |
| `05-deploy-app.sh` | Build & deploy Next.js app | ✗ | 10 min |
| `06-setup-wireguard.sh` | VPN for admin access | ✓ | 3 min |
| `07-setup-backups.sh` | Automated daily backups | ✓ | 2 min |
| `08-setup-monitoring.sh` | Health checks, monitoring | ✓ | 2 min |

## Key Features

### ✅ Production-Ready
- Automatic HTTPS (Caddy)
- Systemd service auto-restart
- Graceful shutdown handling
- Security hardening (UFW, Fail2ban)

### ✅ Zero-Downtime
- Auto-start on boot
- Auto-restart on crash
- Power loss recovery (BIOS configured)

### ✅ Monitoring
- Health checks every 6 hours
- Automated backups daily at 2 AM
- Log rotation
- Resource monitoring (htop, glances)

### ✅ Security
- Firewall configured
- SSH hardened
- Fail2ban active
- Automatic security updates
- WireGuard VPN (optional)

## Common Operations

### View Service Status
```bash
systemctl status trading-app
systemctl status caddy
systemctl status postgresql
```

### View Logs
```bash
# App logs
sudo journalctl -u trading-app -f

# Caddy logs
sudo tail -f /var/log/caddy/access.log

# All logs
monitor-trading-app.sh  # Interactive menu
```

### Restart Services
```bash
sudo systemctl restart trading-app
sudo systemctl restart caddy
```

### Update App from Git
```bash
cd ~/systems-trader
git pull
cd web
npm install
npx prisma migrate deploy
npm run build
sudo systemctl restart trading-app
```

### Manual Backup
```bash
sudo /usr/local/bin/backup-trading-app.sh
```

### Health Check
```bash
health-check.sh
```

## Directory Structure

```
/home/dobri/
  └── systems-trader/
      ├── web/                      # Next.js app
      │   ├── .env                  # Environment variables
      │   ├── .next/                # Build output
      │   └── prisma/               # Database schema
      └── server-setup/             # These scripts

/var/www/trading-app/              # Production build (optional)
/var/log/trading-app/              # Application logs
/var/log/caddy/                    # Web server logs
/var/backups/trading-app/          # Daily backups
/etc/systemd/system/               # Service files
/etc/caddy/Caddyfile               # Web server config
```

## Important Files

| File | Purpose |
|------|---------|
| `~/systems-trader/web/.env` | App configuration (secrets!) |
| `/etc/systemd/system/trading-app.service` | App service definition |
| `/etc/caddy/Caddyfile` | Web server config |
| `/etc/wireguard/wg0.conf` | VPN config |
| `/root/client-wireguard.conf` | VPN client config |

## Troubleshooting

### App not starting?
```bash
# Check logs
sudo journalctl -u trading-app -n 50

# Check if port is in use
sudo netstat -tulpn | grep 3000

# Verify .env file
cat ~/systems-trader/web/.env

# Restart
sudo systemctl restart trading-app
```

### Can't access from browser?
```bash
# Check firewall
sudo ufw status

# Check if Caddy is running
systemctl status caddy
curl http://localhost

# Check if app is responding
curl http://localhost:3000
```

### Database connection issues?
```bash
# Check PostgreSQL
systemctl status postgresql

# Test connection
PGPASSWORD='your_password' psql -U trading_user -d trading_app -c "SELECT 1;"

# Check .env DATABASE_URL
```

### Server not restarting after power loss?
- Already fixed in BIOS ("Power On after AC Loss")
- Verify: Unplug power, replug → should auto-boot

### WireGuard not connecting?
```bash
# Check server status
sudo systemctl status wg-quick@wg0

# Check firewall
sudo ufw allow 51820/udp

# Get client config
sudo cat /root/client-wireguard.conf
```

## Security Checklist

- [x] Firewall enabled (UFW)
- [x] Fail2ban active
- [x] SSH hardened
- [x] Automatic security updates
- [ ] SSH key authentication (do this!)
- [ ] Disable password SSH auth
- [ ] Set strong database password
- [ ] Set strong NextAuth secret
- [ ] Set up WireGuard VPN
- [ ] Change default PostgreSQL password

## Next Steps

### Immediate (Required)
1. **Edit .env file** with real values:
   ```bash
   nano ~/systems-trader/web/.env
   # Set DATABASE_URL password
   # Set AUTH_SECRET (random string)
   # Set NEXTAUTH_URL to your IP/domain
   ```

2. **Restart app**:
   ```bash
   sudo systemctl restart trading-app
   ```

3. **Test access** from browser

### Soon (Recommended)
1. **Set up SSH keys**:
   ```bash
   # On Mac
   ssh-copy-id dobri@YOUR_SERVER_IP
   # Then disable password auth in /etc/ssh/sshd_config
   ```

2. **Get a domain name** (optional):
   - Point DNS to server IP
   - Update Caddyfile with domain
   - Caddy auto-provisions SSL

3. **Set up WireGuard** for secure admin access

### Later (Nice to have)
1. Set up external monitoring (UptimeRobot, etc.)
2. Configure email alerts for errors
3. Set up off-site backups
4. Add UPS for power outages (€50-80)

## Utility Commands

Source the utils file for helpful commands:
```bash
source ~/systems-trader/server-setup/utils.sh

status          # Quick status check
restart_all     # Restart all services
logs app        # View app logs
logs caddy      # View web server logs
update_app      # Update from git
backup_now      # Run backup
stats           # System statistics
help            # Show all commands
```

## Support

Questions? Check:
1. Logs: `sudo journalctl -u trading-app -f`
2. Health check: `health-check.sh`
3. Service status: `systemctl status trading-app`

## Architecture Decisions

Why these choices?

- **Caddy** vs Nginx: Automatic HTTPS, simpler config
- **PostgreSQL** vs SQLite: Better for multi-user, production-ready
- **Systemd** vs PM2: Native to Ubuntu, more reliable
- **WireGuard** vs OpenVPN: Faster, modern, simpler
- **Ubuntu Server** vs others: LTS support, huge community

## Performance

Dell Wyse 5070 specs:
- CPU: Intel Pentium J5005 (4 cores, 2.7GHz)
- RAM: 8GB (can handle 50-100 concurrent users)
- Storage: 128GB SSD
- Power: ~10W (less than a lightbulb!)

Expected capacity:
- **Users**: 50-100 concurrent
- **Requests**: ~1000 req/sec
- **Uptime**: 99%+ (with proper setup)

## Legal Note

This server setup is for:
- Personal use
- Small group of friends
- Educational purposes

If you plan to:
- Offer this as a paid service
- Have 50+ users
- Handle significant trading volume

Then consult with a lawyer about:
- Terms of Service
- Liability disclaimers
- Hyperliquid ToS compliance
- Business structure (LLC, etc.)

---

**You're now running a production-grade trading server!** 🚀

Built with industry best practices. Deployed like the pros. Running 24/7.
