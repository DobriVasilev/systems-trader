# Ubuntu Server 24.04 LTS Installation Guide

## Prerequisites

- USB drive (8GB+)
- Dell Wyse 5070 connected to monitor, keyboard, network

## Step 1: Download Ubuntu Server

Download from: https://ubuntu.com/download/server

Get: **Ubuntu Server 24.04 LTS** (Long Term Support - 5 years updates)

## Step 2: Create Bootable USB

### On macOS:

```bash
# Download balenaEtcher (easiest method)
brew install --cask balenaetcher

# OR use dd command (advanced):
diskutil list  # Find your USB (e.g., /dev/disk2)
diskutil unmountDisk /dev/disk2
sudo dd if=ubuntu-24.04-server-amd64.iso of=/dev/rdisk2 bs=1m
```

## Step 3: Boot From USB

1. Insert USB into Dell Wyse
2. Power on and press **F12** (Boot Menu)
3. Select USB device
4. Ubuntu installer will start

## Step 4: Installation Options

**Language:** English

**Keyboard:** Your layout (probably English US)

**Installation type:** Ubuntu Server

**Network:**
- Use DHCP for now (we'll set static IP later)
- Note down the IP address shown (e.g., 192.168.1.50)

**Storage:**
- Use entire disk ✓
- Set up this disk as an LVM group ✓
- Confirm disk wipe (Windows 10 will be removed)

**Profile setup:**
- Your name: `dobri`
- Server name: `trading-server`
- Username: `dobri`
- Password: [Strong password - save it!]

**SSH Setup:**
- ✓ Install OpenSSH server
- ✓ Import SSH keys from GitHub (optional, safer)

**Featured Server Snaps:**
- Don't install anything yet (we'll do it manually)

## Step 5: Complete Installation

- Installation takes 5-10 minutes
- Remove USB when prompted
- Server will reboot

## Step 6: First Login

After reboot:
```bash
Ubuntu 24.04 LTS trading-server tty1

trading-server login: dobri
Password: [your password]
```

You're now logged into your Ubuntu server! 🎉

## Step 7: Update System

First commands to run:
```bash
# Update package lists
sudo apt update

# Upgrade all packages
sudo apt upgrade -y

# Reboot to apply kernel updates
sudo reboot
```

## Next: SSH Setup

After reboot, you'll access this server remotely from your Mac via SSH.
No more monitor/keyboard needed - the server can sit in the corner.
