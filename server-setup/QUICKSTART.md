# Server Setup Quick Start Guide

## Phase 1: Ubuntu Installation (One-time, at the Dell server)

### On Your Mac:
```bash
# 1. Download Ubuntu Server 24.04 LTS ISO
# Go to: https://ubuntu.com/download/server
# Download: ubuntu-24.04-live-server-amd64.iso

# 2. Create bootable USB
brew install --cask balenaetcher
# Open balenaEtcher → Select ISO → Select USB → Flash
```

### On Dell Server (with monitor & keyboard):
```
1. Insert USB
2. Power on → Press F12 (boot menu)
3. Select USB device
4. Follow installer:
   - Language: English
   - Keyboard: English US
   - Network: Use DHCP (note the IP address!)
   - Storage: Use entire disk → Confirm
   - Profile:
     * Name: dobri
     * Server: trading-server
     * Username: dobri
     * Password: [strong password]
   - Install OpenSSH: ✓ YES
5. Installation completes → Remove USB → Reboot
6. Login and run:
   sudo apt update && sudo apt upgrade -y
   sudo reboot
```

**Note the server's IP address!** (e.g., 192.168.1.50)

---

## Phase 2: Remote Setup (From your Mac via SSH)

```bash
# From your Mac, SSH into the server
ssh dobri@192.168.1.50

# Once connected, clone your repo
git clone https://github.com/DobriVasilev/systems-trader.git
cd systems-trader/server-setup

# Make scripts executable
chmod +x *.sh

# Run setup scripts in order
sudo ./01-security-hardening.sh
sudo ./02-install-caddy.sh
sudo ./03-install-nodejs.sh
sudo ./04-install-postgres.sh
sudo ./05-deploy-app.sh
sudo ./06-setup-wireguard.sh
```

Each script is idempotent (safe to run multiple times).

---

## Phase 3: Access Your App

```
# From any device:
http://your-server-ip
# or
https://trader.yourdomain.com (once DNS is set up)
```

---

## Directory Structure After Setup

```
/home/dobri/
  └── systems-trader/          # Your app code
      ├── web/                 # Next.js frontend
      ├── server-setup/        # These setup scripts
      └── ...

/var/www/trading-app/          # Production Next.js build
/var/log/caddy/                # Web server logs
/var/log/trading-app/          # Application logs
/etc/systemd/system/           # Service files (auto-restart)
```

---

## Key Commands

```bash
# Check service status
sudo systemctl status caddy
sudo systemctl status trading-app

# View logs
sudo journalctl -u trading-app -f
sudo tail -f /var/log/caddy/access.log

# Restart services
sudo systemctl restart trading-app
sudo systemctl restart caddy

# Update app
cd ~/systems-trader
git pull
npm run build
sudo systemctl restart trading-app
```

---

## Security Checklist

- [x] Firewall enabled (UFW)
- [x] Fail2ban active
- [x] Automatic security updates
- [x] SSH hardened
- [ ] SSH key auth (do this next)
- [ ] Disable SSH password auth
- [ ] Set up WireGuard VPN
- [ ] Configure automated backups

---

## Troubleshooting

**Can't SSH?**
```bash
# On server (with monitor):
sudo ufw allow 22
sudo systemctl restart sshd
ip addr show  # Verify IP address
```

**App not accessible?**
```bash
# Check services
sudo systemctl status caddy
sudo systemctl status trading-app

# Check ports
sudo netstat -tulpn | grep LISTEN
```

**Server not restarting after power loss?**
- Already fixed in BIOS (Power On after AC Loss)
- Services auto-start via systemd

---

## Next Steps After Basic Setup

1. **Get a domain name** (optional but recommended)
   - Point DNS A record to server IP
   - Update Caddyfile with domain
   - Caddy auto-provisions SSL

2. **Set up automated backups**
   - Database dumps
   - User data
   - Configs

3. **Monitoring** (optional)
   - Uptime monitoring
   - Error alerting
   - Resource usage tracking

4. **WireGuard VPN**
   - Secure admin access
   - Use from anywhere

---

## Quick Reference

| Service | Port | Status Command |
|---------|------|----------------|
| Caddy | 80, 443 | `systemctl status caddy` |
| App | 3000 (internal) | `systemctl status trading-app` |
| PostgreSQL | 5432 (local) | `systemctl status postgresql` |
| SSH | 22 | `systemctl status sshd` |

**Server IP:** [Write it here after installation]
**Admin User:** dobri
**App Location:** /home/dobri/systems-trader
