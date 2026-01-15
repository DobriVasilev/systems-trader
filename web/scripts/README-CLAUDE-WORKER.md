# Claude Code Worker

## Overview

The Claude Worker Script (`claude-worker.sh`) is a critical component of the autonomous feedback implementation system. It bridges the gap between the feedback watcher and Claude Code CLI, handling the execution and monitoring of automated code improvements.

## How It Works

```
Feedback Watcher → Feedback Queue → Claude Worker → Claude Code CLI → Git Commit → Deploy
```

### Workflow

1. **Feedback Watcher** detects pending corrections from user testing sessions
2. **Watcher** creates a JSON file in `/tmp/claude-workspace/feedback-queue/`
3. **Claude Worker** (this script) continuously monitors the queue directory
4. When a new feedback file appears:
   - Reads the execution details and prompt file
   - Updates status to "running"
   - Launches Claude Code CLI with the generated prompt
   - Monitors Claude's execution
   - Updates status throughout the process
   - Handles commits and deployment tracking
5. **Status Watcher** picks up status updates and syncs to database
6. **Deploy Monitor** tracks the Vercel deployment

## Directory Structure

```
/tmp/claude-workspace/
├── feedback-queue/     # Incoming feedback files
│   ├── {execution-id}.json
│   ├── {execution-id}.json.processed
│   └── {execution-id}.json.failed
├── prompts/           # Generated prompts for Claude
│   └── {execution-id}.md
├── status/            # Status updates
│   └── {execution-id}.json
└── logs/              # Execution logs
    ├── claude-worker.log
    ├── {execution-id}_claude_output.log
    └── {execution-id}_claude_error.log
```

## Feedback File Format

```json
{
  "executionId": "cluid123",
  "workspaceId": "workspace-id",
  "patternType": "SOON",
  "patternName": "Session On Outline New",
  "version": "1.0.0",
  "sessionIds": ["session1", "session2"],
  "sessionCount": 2,
  "promptFile": "/tmp/claude-workspace/prompts/cluid123.md",
  "timestamp": "2026-01-15T14:30:00Z"
}
```

## Status Updates

The worker writes status updates to `/tmp/claude-workspace/status/{execution-id}.json`:

```json
{
  "executionId": "cluid123",
  "status": "running",
  "phase": "implementing",
  "progress": 50,
  "message": "Claude is analyzing the feedback",
  "commitHash": "abc123def",
  "timestamp": "2026-01-15T14:30:00Z"
}
```

### Status Flow

```
pending → running → completed
                  ↘ failed
```

### Phases

- `starting` - Initializing execution
- `implementing` - Claude is making code changes
- `testing` - Running tests
- `deploying` - Changes committed, deployment in progress
- `done` - Execution complete
- `error` - Execution failed

## Running the Worker

### Local Development

```bash
# Ensure directories exist
mkdir -p /tmp/claude-workspace/{feedback-queue,status,prompts,logs}

# Make script executable
chmod +x scripts/claude-worker.sh

# Run directly
./scripts/claude-worker.sh
```

### Production with PM2

The worker is managed by PM2 along with other workspace watchers:

```bash
# Start all workspace services
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs claude-worker

# Restart worker
pm2 restart claude-worker

# Stop worker
pm2 stop claude-worker
```

### Manual Testing

```bash
# Terminal 1: Start the worker
./scripts/claude-worker.sh

# Terminal 2: Create test feedback
cat > /tmp/claude-workspace/feedback-queue/test-123.json << 'EOF'
{
  "executionId": "test-123",
  "workspaceId": "ws-test",
  "patternType": "TEST",
  "patternName": "Test Pattern",
  "version": "1.0.0",
  "sessionIds": ["session1"],
  "sessionCount": 1,
  "promptFile": "/tmp/claude-workspace/prompts/test-123.md",
  "timestamp": "2026-01-15T14:30:00Z"
}
EOF

# Create corresponding prompt
cat > /tmp/claude-workspace/prompts/test-123.md << 'EOF'
# Test Feedback

Please make a simple test change to verify the autonomous system is working.

## Task

1. Add a comment to the README.md file
2. Commit with message "Test autonomous implementation"
EOF

# Watch the worker process the feedback
# Check status file: cat /tmp/claude-workspace/status/test-123.json
```

## Environment Variables

- `CLAUDE_WORKSPACE_PATH` - Path to workspace directory (default: `/tmp/claude-workspace`)
- `PROJECT_DIR` - Path to project root (default: current directory)

## Error Handling

### Feedback Processing Failures

If processing fails:
- Error is logged to `$LOGS_DIR/claude-worker.log`
- Status is updated to "failed"
- Feedback file is renamed to `.failed`
- Execution continues with next feedback

### Claude Code Execution Failures

If Claude Code fails:
- Exit code is captured
- Error output is logged to `{execution-id}_claude_error.log`
- Status is updated with error details
- Feedback file is marked as failed

### Recovery

The worker runs continuously and processes feedback files independently. If one execution fails, it doesn't affect subsequent ones.

## Monitoring

### Health Check

```bash
# Check if worker is running
ps aux | grep claude-worker

# View recent logs
tail -f /tmp/claude-workspace/logs/claude-worker.log

# Check status files
ls -la /tmp/claude-workspace/status/

# View specific execution status
cat /tmp/claude-workspace/status/{execution-id}.json
```

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs claude-worker --lines 100

# Check for restarts (should be 0 for healthy worker)
pm2 status
```

## Security Considerations

### File Permissions

Ensure proper permissions on workspace directories:

```bash
chmod 755 /tmp/claude-workspace
chmod 755 /tmp/claude-workspace/*
```

### Git Credentials

The worker runs in the project directory and requires git to be configured:

```bash
git config --global user.name "Claude Code"
git config --global user.email "claude@autonomous-system"
```

### Claude CLI Access

Ensure Claude Code CLI is installed and authenticated:

```bash
# Check installation
which claude

# Verify authentication
claude --version
```

## Troubleshooting

### Worker Not Processing Feedback

1. Check if worker is running: `pm2 status claude-worker`
2. Check logs: `pm2 logs claude-worker`
3. Verify directories exist: `ls -la /tmp/claude-workspace/`
4. Check for feedback files: `ls -la /tmp/claude-workspace/feedback-queue/`

### Claude Code Not Found

```bash
# Install Claude Code CLI
# Visit: https://claude.com/claude-code

# Verify installation
which claude
claude --version
```

### Permission Denied

```bash
# Make script executable
chmod +x scripts/claude-worker.sh

# Check workspace permissions
ls -la /tmp/claude-workspace/
```

### Git Errors

```bash
# Verify git is configured
git config --global --list

# Check repository status
cd /home/dobri/systems-trader/web
git status
```

## Integration with Other Components

### Feedback Watcher

- **Input**: Detects pending corrections in database
- **Output**: Creates feedback JSON files in queue
- **Trigger**: Worker watches queue directory

### Status Watcher

- **Input**: Worker writes status JSON files
- **Output**: Updates database with execution progress
- **Trigger**: Status watcher monitors status directory

### Deploy Monitor

- **Input**: Worker includes commit hash in status
- **Output**: Tracks Vercel deployment status
- **Trigger**: Deploy monitor polls Vercel API

## Performance

- **Scan Interval**: 5 seconds between queue checks
- **Timeout**: 600 seconds (10 minutes) for Claude Code execution
- **Concurrent Executions**: Processes one feedback at a time
- **Resource Usage**: Minimal (< 50MB RAM when idle)

## Future Improvements

- [ ] Support for parallel execution of multiple feedback items
- [ ] WebSocket updates instead of file-based status
- [ ] Retry logic for failed executions
- [ ] Execution time estimates based on feedback complexity
- [ ] Integration with notification system (Slack, email)
- [ ] Metrics and analytics dashboard
