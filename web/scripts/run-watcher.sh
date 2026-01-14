#!/bin/bash

################################################################################
# Feedback Watcher Runner
#
# Runs the feedback watcher in a loop with crash recovery
# Automatically restarts the watcher when it exits (after triggering Claude)
#
# Usage: ./scripts/run-watcher.sh
################################################################################

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/feedback-watcher-runner.log"
MAX_CRASHES=10
CRASH_WINDOW=3600  # 1 hour in seconds
CRASH_BACKOFF=5    # Initial backoff in seconds

# Crash tracking
declare -a CRASH_TIMES=()
CONSECUTIVE_CRASHES=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if we've hit crash limits
check_crash_limit() {
    local now=$(date +%s)
    local window_start=$((now - CRASH_WINDOW))

    # Remove old crash times outside the window
    local updated_crashes=()
    for crash_time in "${CRASH_TIMES[@]}"; do
        if [ "$crash_time" -gt "$window_start" ]; then
            updated_crashes+=("$crash_time")
        fi
    done
    CRASH_TIMES=("${updated_crashes[@]}")

    # Check if we've hit the limit
    if [ "${#CRASH_TIMES[@]}" -ge "$MAX_CRASHES" ]; then
        error "Hit crash limit! ${#CRASH_TIMES[@]} crashes in the last hour"
        error "This likely indicates a serious problem. Manual intervention required."
        return 1
    fi

    return 0
}

# Record a crash
record_crash() {
    local now=$(date +%s)
    CRASH_TIMES+=("$now")
    CONSECUTIVE_CRASHES=$((CONSECUTIVE_CRASHES + 1))
}

# Calculate backoff time
get_backoff_time() {
    local backoff=$CRASH_BACKOFF

    # Exponential backoff for consecutive crashes
    if [ "$CONSECUTIVE_CRASHES" -gt 1 ]; then
        backoff=$((CRASH_BACKOFF * CONSECUTIVE_CRASHES))

        # Cap at 60 seconds
        if [ "$backoff" -gt 60 ]; then
            backoff=60
        fi
    fi

    echo "$backoff"
}

# Reset crash counter on successful run
reset_crashes() {
    if [ "$CONSECUTIVE_CRASHES" -gt 0 ]; then
        log "Watcher running successfully, resetting crash counter"
        CONSECUTIVE_CRASHES=0
    fi
}

# Main runner loop
run_watcher() {
    log "=========================================="
    log "Feedback Watcher Runner Started"
    log "=========================================="
    log "Project directory: $PROJECT_DIR"
    log "Log file: $LOG_FILE"
    log "Max crashes per hour: $MAX_CRASHES"
    log ""

    cd "$PROJECT_DIR"

    local run_count=0

    while true; do
        run_count=$((run_count + 1))
        log "Starting watcher (run #$run_count)..."

        # Check crash limit before starting
        if ! check_crash_limit; then
            error "Cannot continue due to crash limit"
            exit 1
        fi

        # Run the watcher
        local start_time=$(date +%s)
        set +e
        npm run watch:feedback
        local exit_code=$?
        set -e
        local end_time=$(date +%s)
        local runtime=$((end_time - start_time))

        log "Watcher exited with code $exit_code after ${runtime}s"

        # Check exit code
        if [ "$exit_code" -eq 0 ]; then
            # Normal exit (probably found feedback and triggered Claude)
            log "Normal exit - feedback found and processed"
            reset_crashes

            # Short pause before restarting
            sleep 2
        else
            # Abnormal exit (crash)
            error "Abnormal exit code: $exit_code"
            record_crash

            # Calculate backoff time
            local backoff=$(get_backoff_time)
            warn "Waiting ${backoff}s before restart (consecutive crashes: $CONSECUTIVE_CRASHES)"
            sleep "$backoff"
        fi

        # If watcher ran for more than 60 seconds before exiting, it's stable
        if [ "$runtime" -gt 60 ]; then
            reset_crashes
        fi
    done
}

# Graceful shutdown handler
cleanup() {
    log ""
    log "Received shutdown signal, cleaning up..."
    log "Watcher runner stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Start the runner
run_watcher
