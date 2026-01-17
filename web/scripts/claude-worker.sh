#!/bin/bash

###############################################################################
# Claude Code Worker Script
#
# Watches feedback-queue directory and triggers Claude Code on new feedback
# Handles execution, status updates, and error recovery
#
# Run with: ./scripts/claude-worker.sh
###############################################################################

set -euo pipefail

# Configuration
WORKSPACE_DIR="${CLAUDE_WORKSPACE_PATH:-/tmp/claude-workspace}"
FEEDBACK_QUEUE_DIR="$WORKSPACE_DIR/feedback-queue"
STATUS_DIR="$WORKSPACE_DIR/status"
LOGS_DIR="$WORKSPACE_DIR/logs"
WORKER_LOG="$LOGS_DIR/claude-worker.log"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$WORKER_LOG"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$WORKER_LOG"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1" | tee -a "$WORKER_LOG"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$WORKER_LOG"
}

# Ensure required directories exist
ensure_directories() {
    mkdir -p "$FEEDBACK_QUEUE_DIR"
    mkdir -p "$STATUS_DIR"
    mkdir -p "$LOGS_DIR"
    mkdir -p "$WORKSPACE_DIR/prompts"
}

# Check if Claude Code is available
check_claude_cli() {
    if ! command -v claude &> /dev/null; then
        log_error "Claude Code CLI not found. Please install it first."
        log_error "Visit: https://claude.com/claude-code"
        return 1
    fi
    log_success "Claude Code CLI found: $(which claude)"
    return 0
}

# Update execution status in status file
update_status() {
    local execution_id="$1"
    local status="$2"
    local phase="${3:-}"
    local progress="${4:-0}"
    local message="${5:-}"

    local status_file="$STATUS_DIR/$execution_id.json"

    local json_content=$(cat <<EOF
{
  "executionId": "$execution_id",
  "status": "$status",
  "phase": "$phase",
  "progress": $progress,
  "message": "$message",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
)

    echo "$json_content" > "$status_file"
    log "Status updated: $status ($phase - $progress%)"
}

# Process a feedback file
process_feedback() {
    local feedback_file="$1"
    local feedback_basename=$(basename "$feedback_file")

    log "================================================"
    log "Processing feedback: $feedback_basename"
    log "================================================"

    # Read feedback JSON
    if [ ! -f "$feedback_file" ]; then
        log_error "Feedback file not found: $feedback_file"
        return 1
    fi

    # Extract data from JSON using jq if available, otherwise use basic parsing
    local execution_id=$(grep -o '"executionId"[[:space:]]*:[[:space:]]*"[^"]*"' "$feedback_file" | cut -d'"' -f4)
    local prompt_file=$(grep -o '"promptFile"[[:space:]]*:[[:space:]]*"[^"]*"' "$feedback_file" | cut -d'"' -f4)
    local pattern_type=$(grep -o '"patternType"[[:space:]]*:[[:space:]]*"[^"]*"' "$feedback_file" | cut -d'"' -f4)
    local pattern_name=$(grep -o '"patternName"[[:space:]]*:[[:space:]]*"[^"]*"' "$feedback_file" | cut -d'"' -f4)

    if [ -z "$execution_id" ]; then
        log_error "Failed to extract execution ID from feedback file"
        return 1
    fi

    log "Execution ID: $execution_id"
    log "Pattern: $pattern_name ($pattern_type)"
    log "Prompt file: $prompt_file"

    # Update status to running
    update_status "$execution_id" "running" "starting" 0 "Claude Code execution started"

    # Check if prompt file exists
    if [ ! -f "$prompt_file" ]; then
        log_error "Prompt file not found: $prompt_file"
        update_status "$execution_id" "failed" "error" 0 "Prompt file not found"
        return 1
    fi

    # Read the prompt content
    local prompt_content=$(<"$prompt_file")

    log "Prompt content loaded ($(wc -l < "$prompt_file") lines)"

    # Create a temporary file for Claude's output
    local claude_output_file="$LOGS_DIR/${execution_id}_claude_output.log"
    local claude_error_file="$LOGS_DIR/${execution_id}_claude_error.log"

    # Change to project directory
    cd "$PROJECT_DIR" || {
        log_error "Failed to change to project directory: $PROJECT_DIR"
        update_status "$execution_id" "failed" "error" 0 "Failed to access project directory"
        return 1
    }

    log "Working directory: $(pwd)"

    # Update status to implementing
    update_status "$execution_id" "running" "implementing" 10 "Claude Code is analyzing the feedback"

    # Run Claude Code with the prompt
    log "Launching Claude Code..."
    log "Command: claude \"$prompt_content\""

    # Execute Claude Code
    # Use --continue to resume the most recent conversation in this directory
    # This maintains context across executions for the same pattern workspace
    # Note: Claude Code is interactive, so we pipe the prompt via stdin

    if echo "$prompt_content" | timeout 600 claude --continue --dangerously-skip-permissions > "$claude_output_file" 2> "$claude_error_file"; then
        log_success "Claude Code execution completed successfully"

        # Store Claude output in status file
        local status_file="$STATUS_DIR/$execution_id.json"
        local claude_output_base64=$(base64 -w 0 "$claude_output_file" 2>/dev/null || base64 "$claude_output_file")

        # Update status to testing
        update_status "$execution_id" "running" "testing" 70 "Running tests"

        # Check if there are any changes
        if git diff --quiet && git diff --cached --quiet; then
            log_warn "No changes detected. Claude may not have made any modifications."
            update_status "$execution_id" "completed" "done" 100 "No changes needed"

            # Add Claude output to final status
            local final_status=$(cat "$status_file" | sed "s/\"timestamp\":/\"claudeOutput\": \"$claude_output_base64\", \"timestamp\":/")
            echo "$final_status" > "$status_file"
        else
            log_success "Changes detected. Proceeding with commit."

            # Get the commit hash after Claude commits
            local commit_hash=$(git rev-parse HEAD)

            # Update status with commit info
            update_status "$execution_id" "running" "deploying" 80 "Changes committed: $commit_hash"

            # Store commit hash and Claude output in status file for deploy monitor
            local json_with_data=$(cat "$status_file" | sed "s/\"timestamp\":/\"commitHash\": \"$commit_hash\", \"claudeOutput\": \"$claude_output_base64\", \"timestamp\":/")
            echo "$json_with_data" > "$status_file"

            log_success "Commit hash: $commit_hash"

            # Update to completed (deploy monitor will track deployment)
            update_status "$execution_id" "completed" "done" 100 "Implementation complete, awaiting deployment"
        fi

        # Archive the feedback file
        mv "$feedback_file" "$feedback_file.processed"

        log_success "Feedback processing complete!"
        return 0

    else
        local exit_code=$?
        log_error "Claude Code execution failed with exit code: $exit_code"

        # Log error output
        if [ -s "$claude_error_file" ]; then
            log_error "Claude error output:"
            cat "$claude_error_file" | tee -a "$WORKER_LOG"
        fi

        # Update status to failed
        update_status "$execution_id" "failed" "error" 0 "Claude Code execution failed"

        # Archive the feedback file as failed
        mv "$feedback_file" "$feedback_file.failed"

        return 1
    fi
}

# Watch for new feedback files
watch_feedback_queue() {
    log "========================================="
    log "Claude Code Worker Started"
    log "========================================="
    log "Workspace: $WORKSPACE_DIR"
    log "Queue: $FEEDBACK_QUEUE_DIR"
    log "Project: $PROJECT_DIR"
    log "Watching for feedback files..."
    log ""

    while true; do
        # Find unprocessed JSON files in feedback queue
        for feedback_file in "$FEEDBACK_QUEUE_DIR"/*.json; do
            # Check if glob matched any files
            [ -e "$feedback_file" ] || continue

            # Skip if already processed or failed
            if [[ "$feedback_file" == *.processed ]] || [[ "$feedback_file" == *.failed ]]; then
                continue
            fi

            # Process the feedback
            log "Found new feedback: $(basename "$feedback_file")"

            if process_feedback "$feedback_file"; then
                log_success "Successfully processed feedback"
            else
                log_error "Failed to process feedback"
            fi

            log ""
        done

        # Sleep for a bit before checking again
        sleep 5
    done
}

# Signal handlers for graceful shutdown
cleanup() {
    log "Received shutdown signal, cleaning up..."
    exit 0
}

trap cleanup SIGTERM SIGINT

# Main execution
main() {
    log "Initializing Claude Code Worker..."

    # Ensure directories exist
    ensure_directories

    # Check if Claude CLI is available
    if ! check_claude_cli; then
        exit 1
    fi

    # Start watching
    watch_feedback_queue
}

# Run main function
main
