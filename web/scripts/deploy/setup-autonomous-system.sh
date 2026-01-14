#!/bin/bash

################################################################################
# Autonomous Feedback System Setup Script
#
# This script sets up the autonomous feedback system on the Bulgarian server
# Run as root or with sudo
#
# Usage: sudo ./setup-autonomous-system.sh
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root or with sudo"
    exit 1
fi

log "=========================================="
log "Autonomous Feedback System Setup"
log "=========================================="
log ""

# Configuration
PROJECT_DIR="/var/www/systems-trader/web"
LOG_DIR="/var/log/feedback-watcher"
USER="www-data"
GROUP="www-data"

# Step 1: Create log directory
log "Creating log directory..."
mkdir -p "$LOG_DIR"
chown "$USER:$GROUP" "$LOG_DIR"
chmod 755 "$LOG_DIR"

# Step 2: Install tsx if not already installed
log "Checking dependencies..."
cd "$PROJECT_DIR"
if ! npm list tsx &>/dev/null; then
    log "Installing tsx..."
    sudo -u "$USER" npm install -D tsx
fi

# Step 3: Install systemd service
log "Installing systemd service..."
cp "$PROJECT_DIR/scripts/deploy/systemd/feedback-watcher.service" /etc/systemd/system/
chmod 644 /etc/systemd/system/feedback-watcher.service

# Step 4: Reload systemd
log "Reloading systemd..."
systemctl daemon-reload

# Step 5: Enable service (but don't start yet)
log "Enabling feedback-watcher service..."
systemctl enable feedback-watcher

# Step 6: Create environment file if it doesn't exist
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    warn ".env file not found. Please create it before starting the service."
    log "Required environment variables:"
    log "  - DATABASE_URL"
    log "  - OPENAI_API_KEY (for voice transcription)"
    log "  - R2_* (for attachments)"
    log "  - UPSTASH_* (for rate limiting)"
fi

# Step 7: Set up log rotation
log "Setting up log rotation..."
cat > /etc/logrotate.d/feedback-watcher <<EOF
$LOG_DIR/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $USER $GROUP
}
EOF

# Step 8: Create monitoring script
log "Creating monitoring script..."
cat > /usr/local/bin/feedback-watcher-status <<'EOF'
#!/bin/bash
echo "=== Feedback Watcher Status ==="
systemctl status feedback-watcher --no-pager
echo ""
echo "=== Recent Logs ==="
tail -n 20 /var/log/feedback-watcher/output.log
echo ""
echo "=== Heartbeat Status ==="
if [ -f /tmp/feedback-watcher-heartbeat.txt ]; then
    heartbeat=$(cat /tmp/feedback-watcher-heartbeat.txt)
    now=$(date +%s000)
    age=$((now - heartbeat))
    echo "Last heartbeat: $((age / 1000))s ago"
else
    echo "No heartbeat file found"
fi
EOF

chmod +x /usr/local/bin/feedback-watcher-status

# Step 9: Setup complete
log ""
log "=========================================="
log "Setup Complete!"
log "=========================================="
log ""
log "Next steps:"
log "1. Ensure .env file is configured"
log "2. Run database migrations: cd $PROJECT_DIR && npm run db:push"
log "3. Start the service: systemctl start feedback-watcher"
log "4. Check status: feedback-watcher-status"
log ""
log "Useful commands:"
log "  - Start: systemctl start feedback-watcher"
log "  - Stop: systemctl stop feedback-watcher"
log "  - Restart: systemctl restart feedback-watcher"
log "  - Status: systemctl status feedback-watcher"
log "  - Logs: journalctl -u feedback-watcher -f"
log "  - Quick status: feedback-watcher-status"
log ""
