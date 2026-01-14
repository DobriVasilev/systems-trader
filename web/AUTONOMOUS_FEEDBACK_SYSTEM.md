# Autonomous Feedback System - Complete Implementation Plan

## 🎯 Vision

Create a **fully autonomous feedback-to-implementation system** where:
- Users give feedback (bugs, indicators, algorithm issues)
- Claude Code automatically implements changes
- Users see real-time progress of implementation
- Changes deploy automatically
- Users can immediately test and iterate
- **Zero manual intervention required** (max 30 min/day maintenance)

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │ Bug Report   │   │ Indicator    │   │ Session      │            │
│  │ (Alt+Click)  │   │ Feedback     │   │ Review       │            │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘            │
│         │                  │                  │                     │
│         └──────────────────┴──────────────────┘                     │
│                            │                                        │
│                            ▼                                        │
│                 ┌──────────────────────┐                            │
│                 │   Feedback Database  │                            │
│                 │   (status: pending)  │                            │
│                 └──────────┬───────────┘                            │
│                            │                                        │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BULGARIAN SERVER (24/7)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Feedback Watcher Loop (while true)                        │     │
│  │                                                             │     │
│  │  1. Poll DB for new feedback (every 10 seconds)            │     │
│  │  2. If feedback found:                                     │     │
│  │     - Output JSON to stdout                                │     │
│  │     - Mark as "processing"                                 │     │
│  │     - EXIT (triggers Claude Code)                          │     │
│  │  3. Sleep 10 seconds                                       │     │
│  │  4. Repeat                                                 │     │
│  └────────────────────────────────────────────────────────────┘     │
│                            │                                        │
│                            ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Claude Code Process Monitor                               │     │
│  │                                                             │     │
│  │  - Detects watcher output                                  │     │
│  │  - Parses feedback JSON                                    │     │
│  │  - Generates implementation prompt                         │     │
│  │  - Implements changes                                      │     │
│  │  - Updates database                                        │     │
│  │  - Commits to git                                          │     │
│  │  - Triggers deploy                                         │     │
│  │  - Sends notifications                                     │     │
│  │  - Restarts watcher                                        │     │
│  └────────────────────────────────────────────────────────────┘     │
│                            │                                        │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     REAL-TIME PROGRESS UI                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Agent Plan Component (Live Updates via SSE/WebSocket)    │     │
│  │                                                             │     │
│  │  ✓ Analyzing feedback and context                         │     │
│  │  ⟳ Reading indicator implementation files                 │     │
│  │  ⟳ Implementing changes to MSB indicator                  │     │
│  │  ○ Running tests                                          │     │
│  │  ○ Committing changes                                     │     │
│  │  ○ Deploying to production                                │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## 📊 Database Schema Updates

### Add new fields to `Feedback` model:

```prisma
model Feedback {
  id                    String   @id @default(cuid())

  // ... existing fields ...

  // New autonomous system fields
  implementationStatus  String?  // "pending" | "processing" | "analyzing" | "implementing" | "testing" | "deploying" | "completed" | "failed"
  claudeSessionId       String?  // Track which Claude Code session processed this
  implementationLog     Json?    // Detailed log of what Claude did
  implementationPlan    Json?    // The plan Claude generated (for real-time UI)
  currentTask           String?  // Current task Claude is working on (for real-time UI)
  deploymentStatus      String?  // "pending" | "deploying" | "deployed" | "failed"
  deploymentUrl         String?  // URL to deployed changes (Vercel deployment URL)
  notificationSent      Boolean  @default(false)
  processedAt           DateTime?
  completedAt           DateTime?

  // Error handling
  errorMessage          String?
  retryCount            Int      @default(0)
  maxRetries            Int      @default(3)

  @@index([implementationStatus])
  @@index([processedAt])
}
```

### Add `IndicatorFeedback` model for indicator implementations:

```prisma
model IndicatorFeedback {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  indicatorName     String   // "MSB", "Swing", "BOS", etc.
  indicatorType     String   // "upcoming" | "existing"

  // Feedback content
  description       String   @db.Text // How user identifies this indicator
  methodology       String?  @db.Text // Detailed methodology
  voiceTranscription String? @db.Text

  // Implementation
  implementationStatus String? // Same as Feedback
  claudeSessionId      String?
  implementationLog    Json?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
  @@index([indicatorName])
  @@index([implementationStatus])
}
```

## 🔧 Implementation Components

### 1. Feedback Watcher Script

**Location:** `/scripts/feedback-watcher.ts`

```typescript
#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client'
import { getCapturedLogs } from '@/lib/console-capture'

const prisma = new PrismaClient()

interface FeedbackOutput {
  type: 'NEW_FEEDBACK' | 'NEW_INDICATOR_FEEDBACK'
  count: number
  feedback: any[]
  consoleLogs?: any[]
}

async function watchFeedback() {
  console.log('[WATCHER] Starting feedback watcher...')

  while (true) {
    try {
      // Check for regular feedback
      const pendingFeedback = await prisma.feedback.findMany({
        where: {
          implementationStatus: { in: ['pending', null] },
          type: { in: ['BUG_REPORT', 'FEATURE_REQUEST', 'UI_UX_ISSUE', 'PERFORMANCE_ISSUE'] }
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          attachments: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 5, // Process up to 5 at once
      })

      // Check for indicator feedback
      const pendingIndicators = await prisma.indicatorFeedback.findMany({
        where: {
          implementationStatus: { in: ['pending', null] }
        },
        include: {
          user: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'asc' },
        take: 3, // Process up to 3 at once
      })

      const totalPending = pendingFeedback.length + pendingIndicators.length

      if (totalPending > 0) {
        console.log(`[WATCHER] Found ${totalPending} pending feedback items`)

        // Prepare output for Claude Code
        const output: FeedbackOutput = {
          type: pendingIndicators.length > 0 ? 'NEW_INDICATOR_FEEDBACK' : 'NEW_FEEDBACK',
          count: totalPending,
          feedback: [
            ...pendingFeedback.map(f => ({
              ...f,
              createdAt: f.createdAt.toISOString(),
              element: f.element || {},
            })),
            ...pendingIndicators
          ],
          consoleLogs: typeof window !== 'undefined' ? getCapturedLogs().slice(-50) : [],
        }

        // Output JSON to stdout - THIS TRIGGERS CLAUDE CODE
        console.log('===CLAUDE_CODE_TRIGGER===')
        console.log(JSON.stringify(output, null, 2))
        console.log('===END_TRIGGER===')

        // Mark as processing
        if (pendingFeedback.length > 0) {
          await prisma.feedback.updateMany({
            where: { id: { in: pendingFeedback.map(f => f.id) } },
            data: {
              implementationStatus: 'processing',
              processedAt: new Date(),
            }
          })
        }

        if (pendingIndicators.length > 0) {
          await prisma.indicatorFeedback.updateMany({
            where: { id: { in: pendingIndicators.map(f => f.id) } },
            data: {
              implementationStatus: 'processing',
            }
          })
        }

        console.log('[WATCHER] Marked feedback as processing. Exiting to trigger Claude Code...')
        process.exit(0) // Exit so Claude Code can take over
      }

      // No feedback found, sleep and retry
      await new Promise(resolve => setTimeout(resolve, 10000)) // 10 seconds

    } catch (error) {
      console.error('[WATCHER] Error:', error)
      await new Promise(resolve => setTimeout(resolve, 30000)) // Wait 30s on error
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('[WATCHER] Shutting down gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('[WATCHER] Shutting down gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})

// Start watching
watchFeedback().catch(async (error) => {
  console.error('[WATCHER] Fatal error:', error)
  await prisma.$disconnect()
  process.exit(1)
})
```

### 2. Watcher Runner Script

**Location:** `/scripts/run-watcher.sh`

```bash
#!/bin/bash

# Run feedback watcher in an infinite loop
# If Claude Code processes feedback and exits, this restarts the watcher

cd /Users/dobri/Scripts/systems-trader/web

echo "Starting Autonomous Feedback System..."
echo "Press Ctrl+C to stop"

while true; do
  echo ""
  echo "==================================="
  echo "Starting feedback watcher..."
  echo "==================================="

  # Run the watcher (will exit when feedback is found)
  npm run watch:feedback

  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "Feedback detected! Claude Code should be processing it now..."
    echo "Waiting 5 seconds before restarting watcher..."
    sleep 5
  else
    echo ""
    echo "Watcher exited with error code $EXIT_CODE"
    echo "Waiting 10 seconds before retry..."
    sleep 10
  fi
done
```

### 3. Claude Code Hook Script

**Location:** `/claude-hooks/on-watcher-output.sh`

This is triggered by Claude Code when it detects the watcher output.

```bash
#!/bin/bash

# This script is called by Claude Code when the watcher outputs feedback
# It prepares the prompt for Claude to implement changes

FEEDBACK_JSON="$1"

echo "Claude Code detected new feedback!"
echo "Preparing implementation prompt..."

# Create a prompt file for Claude Code
cat > /tmp/claude-feedback-prompt.md << EOF
# Autonomous Feedback Implementation

You are an autonomous AI agent implementing user feedback for the Systems Trader app.

## Your Role
- Analyze the feedback provided
- Implement the requested changes
- Write clean, production-ready code
- Add tests if needed
- Commit changes with descriptive messages
- Update the feedback status in the database
- Notify users when complete

## Feedback Data
\`\`\`json
$FEEDBACK_JSON
\`\`\`

## Instructions

1. **Analyze the feedback:**
   - Read all feedback items
   - Check console logs if provided
   - Review element info if provided
   - Look at screenshots/attachments

2. **Plan the implementation:**
   - Determine which files need changes
   - Create a step-by-step plan
   - Consider edge cases and testing

3. **Implement changes:**
   - Make the necessary code changes
   - Follow existing code style
   - Add comments where needed
   - Handle errors gracefully

4. **Test the changes:**
   - Run the build to check for errors
   - Test manually if possible
   - Verify the fix addresses the feedback

5. **Update the database:**
   - Mark feedback as "completed"
   - Add implementation log
   - Set deployment status

6. **Commit and deploy:**
   - Commit with descriptive message
   - Push to git
   - Trigger Vercel deployment (git push auto-deploys)

7. **Notify users:**
   - Send in-app notification
   - Send email with summary of changes

## Important Notes

- Be thorough but efficient
- Always test before committing
- Write clear commit messages
- Update feedback status at each step
- If you encounter errors, mark feedback as "failed" with error message
EOF

echo "Prompt created at /tmp/claude-feedback-prompt.md"
```

### 4. Real-Time Progress Component

**Location:** `/src/components/feedback/FeedbackProgressMonitor.tsx`

```typescript
"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, CircleAlert, CircleDotDashed, CircleX } from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string
  status: 'completed' | 'in-progress' | 'pending' | 'need-help' | 'failed'
  tools?: string[]
  subtasks?: Task[]
}

interface ImplementationProgress {
  feedbackId: string
  status: string
  currentTask: string
  plan: Task[]
  log: string[]
}

export function FeedbackProgressMonitor({ feedbackId }: { feedbackId: string }) {
  const [progress, setProgress] = useState<ImplementationProgress | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<string[]>([])

  useEffect(() => {
    // Connect to SSE endpoint for real-time updates
    const eventSource = new EventSource(`/api/feedback/${feedbackId}/progress`)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setProgress(data)

      // Auto-expand current task
      if (data.plan) {
        const inProgressTask = data.plan.find((t: Task) => t.status === 'in-progress')
        if (inProgressTask && !expandedTasks.includes(inProgressTask.id)) {
          setExpandedTasks(prev => [...prev, inProgressTask.id])
        }
      }
    }

    eventSource.onerror = () => {
      console.error('SSE connection error')
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [feedbackId])

  if (!progress) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Status Header */}
      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div>
          <h3 className="font-semibold">Claude is implementing your feedback</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{progress.currentTask}</p>
        </div>
        <CircleDotDashed className="h-6 w-6 text-blue-500 animate-spin" />
      </div>

      {/* Implementation Plan (using the agent-plan component style) */}
      <div className="space-y-2">
        {progress.plan.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            expanded={expandedTasks.includes(task.id)}
            onToggle={() => {
              setExpandedTasks(prev =>
                prev.includes(task.id)
                  ? prev.filter(id => id !== task.id)
                  : [...prev, task.id]
              )
            }}
          />
        ))}
      </div>

      {/* Implementation Log */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400">
          View detailed log ({progress.log.length} entries)
        </summary>
        <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
          {progress.log.map((entry, i) => (
            <div key={i} className="text-xs font-mono p-2 bg-gray-100 dark:bg-gray-800 rounded">
              {entry}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}

function TaskItem({
  task,
  expanded,
  onToggle
}: {
  task: Task
  expanded: boolean
  onToggle: () => void
}) {
  const statusIcon = {
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    'in-progress': <CircleDotDashed className="h-4 w-4 text-blue-500 animate-pulse" />,
    pending: <Circle className="h-4 w-4 text-gray-400" />,
    'need-help': <CircleAlert className="h-4 w-4 text-yellow-500" />,
    failed: <CircleX className="h-4 w-4 text-red-500" />,
  }[task.status]

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        {statusIcon}
        <span className="flex-1 text-left">{task.title}</span>
        {task.subtasks && (
          <span className="text-xs text-gray-500">
            {task.subtasks.filter(t => t.status === 'completed').length} / {task.subtasks.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {expanded && task.subtasks && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
          >
            <div className="p-3 space-y-2">
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-3 text-sm">
                  {statusIcon}
                  <span className="flex-1">{subtask.title}</span>
                  {subtask.tools && (
                    <div className="flex gap-1">
                      {subtask.tools.map((tool, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
```

### 5. SSE Progress Endpoint

**Location:** `/src/app/api/feedback/[id]/progress/route.ts`

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const feedbackId = params.id

  // Create SSE response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data
      const feedback = await prisma.feedback.findUnique({
        where: { id: feedbackId },
        select: {
          implementationStatus: true,
          currentTask: true,
          implementationPlan: true,
          implementationLog: true,
        }
      })

      if (feedback) {
        const data = `data: ${JSON.stringify(feedback)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      // Poll for updates every 2 seconds
      const interval = setInterval(async () => {
        try {
          const updated = await prisma.feedback.findUnique({
            where: { id: feedbackId },
            select: {
              implementationStatus: true,
              currentTask: true,
              implementationPlan: true,
              implementationLog: true,
            }
          })

          if (updated) {
            const data = `data: ${JSON.stringify(updated)}\n\n`
            controller.enqueue(encoder.encode(data))

            // Close stream if completed or failed
            if (updated.implementationStatus === 'completed' || updated.implementationStatus === 'failed') {
              clearInterval(interval)
              controller.close()
            }
          }
        } catch (error) {
          console.error('SSE error:', error)
          clearInterval(interval)
          controller.close()
        }
      }, 2000)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
```

## 🚀 Deployment & Setup

### Step 1: Install Dependencies

```bash
cd /Users/dobri/Scripts/systems-trader/web
npm install --save-dev ts-node
```

### Step 2: Add NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "watch:feedback": "ts-node scripts/feedback-watcher.ts",
    "start:autonomous": "./scripts/run-watcher.sh"
  }
}
```

### Step 3: Set Up Systemd Service (Bulgarian Server)

**Location:** `/etc/systemd/system/feedback-watcher.service`

```ini
[Unit]
Description=Autonomous Feedback Watcher
After=network.target

[Service]
Type=simple
User=dobri
WorkingDirectory=/home/dobri/systems-trader/web
ExecStart=/home/dobri/systems-trader/web/scripts/run-watcher.sh
Restart=always
RestartSec=10
StandardOutput=append:/var/log/feedback-watcher.log
StandardError=append:/var/log/feedback-watcher-error.log

Environment=NODE_ENV=production
Environment=DATABASE_URL=your_database_url

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable feedback-watcher
sudo systemctl start feedback-watcher
sudo systemctl status feedback-watcher
```

### Step 4: Configure Claude Code

Create `.clauderc` in project root:

```json
{
  "hooks": {
    "on_output": "./claude-hooks/on-watcher-output.sh"
  },
  "auto_commit": true,
  "auto_push": true
}
```

## 📱 User Experience Flow

### Scenario 1: Bug Report

1. **User reports bug** (Alt+Right-click or bug button)
   - Provides description
   - Optionally adds screenshot
   - Optionally records voice message
   - Submits feedback

2. **Watcher detects feedback** (within 10 seconds)
   - Outputs JSON to stdout
   - Marks as "processing"
   - Exits

3. **Claude Code activates**
   - Reads feedback JSON
   - Analyzes bug details
   - Creates implementation plan
   - Updates DB with plan

4. **User sees progress in real-time**
   - Opens feedback page
   - Sees Agent Plan component
   - Watches tasks complete:
     - ✓ Analyzing bug report
     - ⟳ Reading related files
     - ⟳ Implementing fix
     - ○ Running tests
     - ○ Committing changes

5. **Claude Code completes**
   - All tasks marked completed
   - Commits changes to git
   - Triggers Vercel deployment
   - Updates DB: status = "completed"
   - Sends notification

6. **User gets notified**
   - In-app notification appears
   - Email sent with summary
   - Shows deployment URL
   - "Your bug fix is live! Click to test."

7. **User tests the fix**
   - Clicks deployment URL
   - Tests the bug is fixed
   - Can submit more feedback if needed

### Scenario 2: Indicator Implementation

1. **User submits indicator feedback**
   - Selects indicator (e.g., "MSB")
   - Explains methodology in text or voice
   - Adds example screenshots
   - Submits

2. **Watcher detects indicator feedback**
   - Same flow as bug report
   - Claude Code receives special "INDICATOR" type

3. **Claude Code implements indicator**
   - Reads indicator documentation
   - Understands user methodology
   - Creates algorithm implementation
   - Adds tests
   - Commits

4. **User reviews implementation**
   - Gets notified when complete
   - Creates test session
   - Runs indicator on historical data
   - Reviews results

5. **User iterates**
   - Finds issues in specific candles
   - Uses session review to add comments
   - "This swing was missed at 12:45"
   - "False signal here, should filter by X"

6. **Claude Code refines**
   - Processes session feedback
   - Improves algorithm
   - Deploys updated version
   - Notifies user to re-test

## 🛠️ Advanced Features

### Voice Transcription

Auto-transcribe voice feedback before sending to Claude:

```typescript
import OpenAI from 'openai'

async function transcribeVoice(audioBlob: Blob): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const file = new File([audioBlob], 'voice.webm', { type: 'audio/webm' })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'en'
  })

  return transcription.text
}
```

### Screenshot Analysis

Generate descriptions of screenshots:

```typescript
import OpenAI from 'openai'

async function analyzeScreenshot(imageUrl: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this screenshot in detail. What UI elements are visible? What might be the bug or issue shown?' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }],
    max_tokens: 500
  })

  return response.choices[0].message.content || ''
}
```

### Intelligent Feedback Routing

Route different feedback types to appropriate handlers:

```typescript
function routeFeedback(feedback: Feedback) {
  if (feedback.type === 'BUG_REPORT') {
    return 'bug-fix'
  } else if (feedback.element?.selector?.includes('indicator')) {
    return 'indicator-logic'
  } else if (feedback.pageUrl?.includes('/sessions/')) {
    return 'algorithm-refinement'
  } else {
    return 'general'
  }
}
```

## 📊 Monitoring & Maintenance

### Dashboard Metrics

Track autonomous system performance:

- Feedback items processed per day
- Average time to implementation
- Success rate (completed vs failed)
- User satisfaction (re-submissions)
- Deployment frequency

### Error Handling

Automatic retry on failure:

```typescript
if (feedback.retryCount < feedback.maxRetries) {
  await prisma.feedback.update({
    where: { id: feedback.id },
    data: {
      implementationStatus: 'pending', // Reset to pending
      retryCount: feedback.retryCount + 1,
      errorMessage: error.message
    }
  })
} else {
  // Max retries reached, notify admin
  await sendAdminNotification({
    type: 'FEEDBACK_FAILED',
    feedbackId: feedback.id,
    error: error.message
  })
}
```

### Health Checks

Monitor watcher health:

```bash
#!/bin/bash
# Check if watcher is running
if ! pgrep -f "feedback-watcher.ts" > /dev/null; then
  echo "Watcher is not running! Restarting..."
  systemctl restart feedback-watcher
fi
```

## 🎯 Success Metrics

This system is successful when:

- ✅ Users can submit feedback 24/7
- ✅ Implementation happens within 15-20 minutes
- ✅ Users see real-time progress
- ✅ Changes deploy automatically
- ✅ You spend max 30 min/day on maintenance
- ✅ Your friends help build all 56+ indicators
- ✅ Bug reports are fixed within hours
- ✅ The app improves autonomously

## 🚧 Limitations & Considerations

1. **Claude Code Personal Account**
   - Rate limits may apply
   - Need to monitor usage
   - May need to upgrade plan

2. **Complex Bugs**
   - Some bugs may require manual intervention
   - System should flag these for review

3. **Testing**
   - Automated tests help but can't catch everything
   - Users are the final testers

4. **Cost**
   - Voice transcription (Whisper API)
   - Image analysis (GPT-4 Vision)
   - Hosting costs for Bulgarian server

5. **Security**
   - Ensure feedback can't execute malicious code
   - Validate all user input
   - Rate limit feedback submissions

## 🔮 Future Enhancements

1. **Multi-Agent System**
   - Different agents for different tasks
   - Bug-fix agent, feature agent, refactoring agent

2. **Learning from Feedback**
   - Track which feedback leads to successful implementations
   - Improve prompts based on success rate

3. **User Reputation System**
   - Reward users who provide quality feedback
   - Prioritize feedback from experienced users

4. **Collaborative Feedback**
   - Multiple users can comment on same feedback
   - Voting system for feature requests

5. **A/B Testing Integration**
   - Deploy changes to subset of users first
   - Automatically roll back if issues detected

---

## 🎬 Getting Started

Ready to implement? Let's start with:

1. ✅ Update database schema
2. ✅ Create feedback watcher script
3. ✅ Set up watcher runner
4. ✅ Implement real-time progress UI
5. ✅ Create SSE endpoint
6. ✅ Deploy to Bulgarian server
7. ✅ Test with sample feedback

Let me know which component you want me to implement first!
