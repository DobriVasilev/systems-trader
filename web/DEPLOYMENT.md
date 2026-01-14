# Autonomous Feedback System - Deployment Guide

## Overview

This guide covers deploying the autonomous feedback system to the Bulgarian server for 24/7 operation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Bulgarian Server (24/7)                                        │
│                                                                 │
│  ┌──────────────────┐         ┌─────────────────────────┐     │
│  │ Feedback Watcher │◄────────┤  PostgreSQL Database     │     │
│  │  (systemd)       │         │  (Neon or local)         │     │
│  └────────┬─────────┘         └─────────────────────────┘     │
│           │                                                     │
│           │ Detects new feedback                               │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │  Claude Code     │                                          │
│  │  (with hooks)    │                                          │
│  └────────┬─────────┘                                          │
│           │                                                     │
│           │ Implements changes                                 │
│           ▼                                                     │
│  ┌──────────────────┐         ┌─────────────────────────┐     │
│  │  Git Push        │────────►│  Vercel Auto-Deploy      │     │
│  └──────────────────┘         └─────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Server Requirements
- Ubuntu 20.04+ or Debian 11+
- Node.js 20+
- Git
- systemd
- PostgreSQL access (or Neon connection)

### Access Requirements
- SSH access to Bulgarian server
- sudo privileges
- GitHub SSH key configured
- Claude Code installed

## Installation Steps

### 1. Prepare the Server

```bash
# SSH into the Bulgarian server
ssh user@bulgarian-server

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Claude Code (if not already installed)
# Follow: https://www.anthropic.com/claude-code

# Create project directory
sudo mkdir -p /var/www/systems-trader
sudo chown $USER:$USER /var/www/systems-trader
```

### 2. Clone and Setup Project

```bash
# Clone repository
cd /var/www
git clone git@github.com:yourusername/systems-trader.git
cd systems-trader/web

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
nano .env  # Configure environment variables
```

### 3. Configure Environment Variables

Edit `.env` with the following required variables:

```bash
# Database (Neon or local PostgreSQL)
DATABASE_URL="postgresql://user:password@host/database"

# Authentication
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secret-here"

# OpenAI (for voice transcription)
OPENAI_API_KEY="sk-..."

# R2 Storage (for attachments)
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="..."

# Upstash Redis (for rate limiting)
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."

# Email (Resend)
RESEND_API_KEY="..."
EMAIL_FROM="noreply@yourdomain.com"
```

### 4. Database Migration

```bash
# Push schema to database
npm run db:push

# Verify connection
npm run db:studio  # Opens Prisma Studio
```

### 5. Run Setup Script

```bash
# Run the autonomous system setup script
sudo ./scripts/deploy/setup-autonomous-system.sh
```

This script will:
- Create log directories
- Install systemd service
- Configure log rotation
- Create monitoring scripts

### 6. Start the Service

```bash
# Start the feedback watcher
sudo systemctl start feedback-watcher

# Check status
sudo systemctl status feedback-watcher

# View logs
sudo journalctl -u feedback-watcher -f

# Or use the convenience command
feedback-watcher-status
```

## Verification

### Test the System

1. **Submit Test Feedback**
   - Go to your web app
   - Submit feedback as a dev_team user
   - Watch the logs: `journalctl -u feedback-watcher -f`

2. **Check Heartbeat**
   ```bash
   cat /tmp/feedback-watcher-heartbeat.txt
   # Should show recent timestamp
   ```

3. **Monitor Progress**
   - Open the feedback in the web app
   - You should see real-time progress updates

## Monitoring & Maintenance

### Check Status

```bash
# Quick status check
feedback-watcher-status

# Detailed systemd status
systemctl status feedback-watcher

# Live logs
journalctl -u feedback-watcher -f

# View recent logs
tail -f /var/log/feedback-watcher/output.log
```

### Common Operations

```bash
# Restart service
sudo systemctl restart feedback-watcher

# Stop service
sudo systemctl stop feedback-watcher

# Start service
sudo systemctl start feedback-watcher

# Disable auto-start
sudo systemctl disable feedback-watcher

# Enable auto-start
sudo systemctl enable feedback-watcher
```

### Health Monitoring

The system includes several health checks:

1. **Heartbeat File**: `/tmp/feedback-watcher-heartbeat.txt`
   - Updated every 10 seconds
   - If older than 60s, watcher may be frozen

2. **Process Status**: Check if watcher is running
   ```bash
   ps aux | grep feedback-watcher
   ```

3. **Database Connectivity**: Check if watcher can connect to DB
   ```bash
   # View logs for connection errors
   grep -i "error" /var/log/feedback-watcher/error.log
   ```

## Troubleshooting

### Watcher Not Starting

```bash
# Check systemd logs
journalctl -u feedback-watcher -n 50

# Check permissions
ls -la /var/www/systems-trader/web

# Check environment
cat /var/www/systems-trader/web/.env | head
```

### Watcher Crashes Frequently

```bash
# View error logs
tail -100 /var/log/feedback-watcher/error.log

# Check database connection
npm run db:studio

# Verify Node.js version
node --version  # Should be 20+
```

### Claude Code Not Triggering

```bash
# Check if Claude is installed
which claude

# Verify Claude can run
claude --version

# Check watcher output
tail -f /var/log/feedback-watcher/output.log
```

### High Memory Usage

```bash
# Check resource usage
systemctl status feedback-watcher

# View memory limits
cat /etc/systemd/system/feedback-watcher.service | grep Memory

# Restart to free memory
sudo systemctl restart feedback-watcher
```

## Security Considerations

1. **Role-Based Access Control**
   - Only dev_team and admin users trigger autonomous processing
   - Other users must manually export prompts

2. **Rate Limiting**
   - 10 feedback submissions per hour per user
   - 5 mark-for-processing requests per hour
   - 30 prompt generations per hour

3. **Input Validation**
   - Text content limited to 10,000 characters
   - Maximum 10 attachments per feedback
   - Feedback type validation

4. **Admin Controls**
   - Retry, cancel, reset, and override capabilities
   - All admin actions are logged

## Maintenance Schedule

### Daily
- Monitor system status: `feedback-watcher-status`
- Check for failed implementations in dashboard
- Review error logs

### Weekly
- Review rate limit analytics
- Check disk space: `df -h`
- Update dependencies if needed

### Monthly
- Review and archive old logs
- Update system packages
- Test failover procedures

## Rollback Procedure

If something goes wrong:

```bash
# 1. Stop the service
sudo systemctl stop feedback-watcher

# 2. Review what happened
tail -200 /var/log/feedback-watcher/error.log

# 3. Fix issues (code, config, etc.)

# 4. Restart service
sudo systemctl start feedback-watcher

# 5. Monitor closely
journalctl -u feedback-watcher -f
```

## Contact

For issues or questions:
- Check logs first: `/var/log/feedback-watcher/`
- Review documentation: `AUTONOMOUS_FEEDBACK_SYSTEM.md`
- Contact admin if unresolved
