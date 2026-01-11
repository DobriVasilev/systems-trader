#!/bin/bash
# Safe deploy script - NEVER leaves the app down
# Even if this script fails, the app will keep running

APP_DIR="/home/dobri/systems-trader"
WEB_DIR="${APP_DIR}/web"
LOG_FILE="/var/log/trading-app/deploy.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "========================================"
log "Deploy started"

# PHASE 1: Pull and build (app stays running during this)
# If this fails, abort - app keeps running with old code

cd "$APP_DIR" || { log "ERROR: Cannot cd to $APP_DIR"; exit 1; }

log "Pulling from GitHub..."
if ! git fetch origin >> "$LOG_FILE" 2>&1; then
    log "ERROR: git fetch failed"
    exit 1
fi

if ! git reset --hard origin/master >> "$LOG_FILE" 2>&1; then
    log "ERROR: git reset failed"
    exit 1
fi

cd "$WEB_DIR" || { log "ERROR: Cannot cd to $WEB_DIR"; exit 1; }

log "Installing dependencies..."
if ! npm ci --production=false >> "$LOG_FILE" 2>&1; then
    log "ERROR: npm ci failed"
    exit 1
fi

log "Generating Prisma client..."
if ! npx prisma generate >> "$LOG_FILE" 2>&1; then
    log "ERROR: prisma generate failed"
    exit 1
fi

log "Building Next.js app..."
if ! npm run build >> "$LOG_FILE" 2>&1; then
    log "ERROR: npm run build failed - app continues with old build"
    exit 1
fi

# PHASE 2: Restart app (build succeeded, safe to restart)
# Use reload for zero-downtime, fallback to restart if needed

log "Reloading app..."

# Try graceful reload first (zero downtime)
if pm2 reload trading-app >> "$LOG_FILE" 2>&1; then
    log "App reloaded successfully"
else
    log "Reload failed, trying restart..."
    # If reload fails, force restart but ALWAYS ensure it comes back up
    pm2 stop trading-app >> "$LOG_FILE" 2>&1 || true
    sleep 1

    # Kill any zombie processes on port 3000
    fuser -k 3000/tcp >> "$LOG_FILE" 2>&1 || true
    sleep 1

    # Start the app - retry up to 3 times
    for i in 1 2 3; do
        if pm2 start trading-app >> "$LOG_FILE" 2>&1; then
            log "App started on attempt $i"
            break
        fi
        log "Start attempt $i failed, retrying..."
        sleep 2
    done
fi

# PHASE 3: Verify app is running
sleep 3
if pm2 show trading-app | grep -q "online"; then
    log "Deploy completed successfully - app is online"
else
    log "WARNING: App may not be running! Attempting emergency start..."
    pm2 start trading-app >> "$LOG_FILE" 2>&1 || true
fi

log "========================================"
