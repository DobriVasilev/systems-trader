#!/usr/bin/env tsx

/**
 * Workspace Feedback Watcher
 *
 * Polls database for pattern sessions with pending corrections
 * Aggregates feedback for workspaces and triggers Claude Code
 *
 * Run with: npm run watch:workspace-feedback
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// Configuration
const POLL_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_FILE = "/tmp/feedback-watcher-heartbeat.txt";
const MAX_RUNTIME = 30 * 60 * 1000; // 30 minutes max runtime
const WORKSPACE_DIR = "/tmp/claude-workspace";
const FEEDBACK_QUEUE_DIR = path.join(WORKSPACE_DIR, "feedback-queue");

// Track health
let lastHeartbeat = Date.now();
let startTime = Date.now();

// Ensure workspace directories exist
function ensureWorkspaceDirectories() {
  const dirs = [
    WORKSPACE_DIR,
    FEEDBACK_QUEUE_DIR,
    path.join(WORKSPACE_DIR, "status"),
    path.join(WORKSPACE_DIR, "prompts"),
    path.join(WORKSPACE_DIR, "logs"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Write heartbeat to file for monitoring
function updateHeartbeat() {
  try {
    fs.writeFileSync(HEARTBEAT_FILE, Date.now().toString());
    lastHeartbeat = Date.now();
  } catch (error) {
    console.error("Failed to write heartbeat:", error);
  }
}

// Freeze detection
function checkForFreeze() {
  const now = Date.now();
  const timeSinceLastHeartbeat = now - lastHeartbeat;

  if (timeSinceLastHeartbeat > POLL_INTERVAL * 3) {
    console.error(`[FREEZE DETECTED] No heartbeat for ${timeSinceLastHeartbeat}ms`);
    process.exit(1);
  }

  if (now - startTime > MAX_RUNTIME) {
    console.log(`[MAX RUNTIME] Watcher has run for ${MAX_RUNTIME}ms. Exiting for restart.`);
    process.exit(0);
  }
}

// Aggregate corrections from a session
function aggregateSessionCorrections(session: any) {
  if (!session.corrections || session.corrections.length === 0) {
    return [];
  }

  // Group corrections by type
  const grouped: Record<string, any[]> = {};

  for (const correction of session.corrections) {
    const type = correction.correctionType;
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(correction);
  }

  // Convert to array format
  const corrections = [];
  for (const [type, items] of Object.entries(grouped)) {
    corrections.push({
      type: type,
      count: items.length,
      items: items,
    });
  }

  return corrections;
}

// Generate workspace prompt from aggregated feedback
function generateWorkspacePrompt(workspace: any, sessions: any[]): string {
  let prompt = `# 🔧 Pattern Implementation Feedback\n\n`;
  prompt += `**Pattern:** ${workspace.name} (${workspace.patternType})\n`;
  prompt += `**Category:** ${workspace.category}\n`;
  prompt += `**Current Version:** ${workspace.version}\n`;
  prompt += `**Status:** ${workspace.status}\n\n`;

  prompt += `## 📊 Overview\n\n`;
  prompt += `This feedback aggregates ${sessions.length} testing session(s) with corrections.\n\n`;

  // Aggregate statistics
  let totalCorrections = 0;
  const correctionsByType: Record<string, number> = {};

  for (const session of sessions) {
    const corrections = aggregateSessionCorrections(session);
    for (const correction of corrections) {
      totalCorrections += correction.count;
      correctionsByType[correction.type] = (correctionsByType[correction.type] || 0) + correction.count;
    }
  }

  prompt += `**Total Corrections:** ${totalCorrections}\n`;
  for (const [type, count] of Object.entries(correctionsByType)) {
    prompt += `- ${type.replace(/_/g, " ")}: ${count}\n`;
  }
  prompt += `\n`;

  // Sessions detail
  prompt += `## 📝 Testing Sessions\n\n`;

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    prompt += `### Session ${i + 1}: ${session.id}\n\n`;
    prompt += `- **Created:** ${new Date(session.createdAt).toLocaleString()}\n`;
    prompt += `- **Timeframe:** ${session.timeframe}\n`;
    prompt += `- **Chart Type:** ${session.chartType}\n`;

    if (session.verificationStatus) {
      prompt += `- **Verification Status:** ${session.verificationStatus}\n`;
    }

    prompt += `\n`;

    const corrections = aggregateSessionCorrections(session);

    for (const correction of corrections) {
      prompt += `#### ${correction.type.replace(/_/g, " ")} (${correction.count})\n\n`;

      for (let j = 0; j < correction.items.length; j++) {
        const item = correction.items[j];
        prompt += `${j + 1}. **${correction.type.toUpperCase()}** correction\n`;

        // Show reason
        if (item.reason) {
          prompt += `   ${item.reason}\n`;
        }

        // Show original state
        if (item.originalTime || item.originalPrice) {
          prompt += `   Original: Time=${item.originalTime ? new Date(item.originalTime).toISOString() : "N/A"}, Price=${item.originalPrice || "N/A"}`;
          if (item.originalType) prompt += `, Type=${item.originalType}`;
          prompt += `\n`;
        }

        // Show corrected state
        if (item.correctedTime || item.correctedPrice) {
          prompt += `   Corrected: Time=${item.correctedTime ? new Date(item.correctedTime).toISOString() : "N/A"}, Price=${item.correctedPrice || "N/A"}`;
          if (item.correctedType) prompt += `, Type=${item.correctedType}`;
          if (item.correctedStructure) prompt += `, Structure=${item.correctedStructure}`;
          prompt += `\n`;
        }

        // Show attachments
        if (item.attachments && Array.isArray(item.attachments) && item.attachments.length > 0) {
          prompt += `   Attachments:\n`;
          for (const att of item.attachments) {
            prompt += `   - ${att.name || att.url}\n`;
          }
        }

        prompt += `\n`;
      }
    }

    // Add notes if present
    if (session.notes) {
      prompt += `**Session Notes:**\n${session.notes}\n\n`;
    }

    prompt += `---\n\n`;
  }

  // Pattern context
  if (workspace.description) {
    prompt += `## 📖 Pattern Description\n\n`;
    prompt += `${workspace.description}\n\n`;
  }

  if (workspace.userReasoning) {
    prompt += `## 💭 Implementation Reasoning\n\n`;
    prompt += `${workspace.userReasoning}\n\n`;
  }

  if (workspace.identificationSteps) {
    prompt += `## 🔍 Identification Steps\n\n`;
    const steps = workspace.identificationSteps as any;
    if (Array.isArray(steps)) {
      steps.forEach((step: any, i: number) => {
        prompt += `${i + 1}. ${step}\n`;
      });
    } else {
      prompt += JSON.stringify(steps, null, 2);
    }
    prompt += `\n`;
  }

  // Task
  prompt += `## 🎯 Task\n\n`;
  prompt += `Please review the corrections from testing sessions and update the pattern implementation accordingly. `;
  prompt += `Ensure all corrections are properly addressed and the pattern accurately identifies the described price action behavior.\n\n`;

  prompt += `After implementing the fixes:\n`;
  prompt += `1. Update the pattern version number\n`;
  prompt += `2. Run tests to verify the changes\n`;
  prompt += `3. Commit with a descriptive message\n`;
  prompt += `4. The system will automatically monitor the deployment\n\n`;

  return prompt;
}

// Check for workspaces with pending feedback
async function pollForWorkspaceFeedback() {
  try {
    updateHeartbeat();

    console.log(`[${new Date().toISOString()}] Polling for workspace feedback...`);

    // Find workspaces with sessions that have corrections pending implementation
    const workspaces = await prisma.patternWorkspace.findMany({
      where: {
        status: {
          in: ["implementing", "beta", "in_review"],
        },
      },
      include: {
        sessions: {
          where: {
            status: "submitted_for_review",
            implementedAt: null,
          },
          include: {
            corrections: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Find workspace with most urgent feedback
    let targetWorkspace = null;
    let targetSessions: any[] = [];

    for (const workspace of workspaces) {
      // Filter sessions that actually have corrections
      const sessionsWithCorrections = workspace.sessions.filter(
        (s: any) => s.corrections && s.corrections.length > 0
      );

      if (sessionsWithCorrections.length > 0) {
        // Check if there's already a pending execution for this workspace
        const pendingExecution = await prisma.claudeExecution.findFirst({
          where: {
            workspaceId: workspace.id,
            status: {
              in: ["pending", "running"],
            },
          },
        });

        if (!pendingExecution) {
          targetWorkspace = workspace;
          targetSessions = sessionsWithCorrections;
          break;
        }
      }
    }

    if (!targetWorkspace || targetSessions.length === 0) {
      console.log(`[NO FEEDBACK] No pending workspace feedback found. Waiting ${POLL_INTERVAL}ms...`);
      return;
    }

    console.log(`[FEEDBACK FOUND] Workspace: ${targetWorkspace.name}, Sessions: ${targetSessions.length}`);

    // Create execution record
    const execution = await prisma.claudeExecution.create({
      data: {
        workspaceId: targetWorkspace.id,
        triggeredBy: targetWorkspace.createdById,
        status: "pending",
        phase: "planning",
        progress: 0,
        sessionIds: targetSessions.map(s => s.id),
        feedbackType: "corrections",
      },
    });

    // Create workspace message for execution start
    await prisma.workspaceMessage.create({
      data: {
        workspaceId: targetWorkspace.id,
        executionId: execution.id,
        type: "execution_started",
        authorType: "system",
        title: "Claude Code Execution Started",
        content: `Processing ${targetSessions.length} session(s) with corrections`,
        data: {
          executionId: execution.id,
          sessionCount: targetSessions.length,
        },
      },
    });

    // Note: Sessions remain in "submitted_for_review" status until implementation completes

    // Generate prompt
    const prompt = generateWorkspacePrompt(targetWorkspace, targetSessions);

    // Write prompt to file
    const promptFile = path.join(WORKSPACE_DIR, "prompts", `${execution.id}.md`);
    fs.writeFileSync(promptFile, prompt);

    // Create feedback queue file
    const feedbackFile = path.join(FEEDBACK_QUEUE_DIR, `${execution.id}.json`);
    const feedbackData = {
      executionId: execution.id,
      workspaceId: targetWorkspace.id,
      patternType: targetWorkspace.patternType,
      patternName: targetWorkspace.name,
      version: targetWorkspace.version,
      sessionIds: targetSessions.map(s => s.id),
      sessionCount: targetSessions.length,
      promptFile: promptFile,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(feedbackFile, JSON.stringify(feedbackData, null, 2));

    // Update execution with prompt file
    await prisma.claudeExecution.update({
      where: { id: execution.id },
      data: {
        promptFile: promptFile,
      },
    });

    // Output for Claude Code trigger
    console.log("\n\n[CLAUDE CODE TRIGGER]");
    console.log("=".repeat(80));
    console.log(JSON.stringify(feedbackData, null, 2));
    console.log("=".repeat(80));
    console.log(`Prompt file: ${promptFile}`);
    console.log(`Feedback queue: ${feedbackFile}`);
    console.log("=".repeat(80));
    console.log("\n");

    // Exit to trigger Claude Code activation
    console.log("[EXITING] Watcher will be restarted by runner script");
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`[ERROR] Polling error:`, error);
    // Don't exit on error, continue watching
  }
}

// Main loop
async function main() {
  console.log("[WORKSPACE WATCHER STARTED]");
  console.log(`Polling interval: ${POLL_INTERVAL}ms`);
  console.log(`Max runtime: ${MAX_RUNTIME}ms`);
  console.log(`Heartbeat file: ${HEARTBEAT_FILE}`);
  console.log(`Workspace directory: ${WORKSPACE_DIR}`);
  console.log("Watching for workspace feedback from testing sessions...\n");

  // Ensure directories exist
  ensureWorkspaceDirectories();

  // Initial heartbeat
  updateHeartbeat();

  // Set up freeze detection check
  const freezeCheckInterval = setInterval(checkForFreeze, POLL_INTERVAL);

  // Set up polling interval
  const pollInterval = setInterval(async () => {
    await pollForWorkspaceFeedback();
  }, POLL_INTERVAL);

  // Initial poll
  await pollForWorkspaceFeedback();

  // Keep process alive
  process.on("SIGTERM", async () => {
    console.log("\n[SIGTERM] Shutting down gracefully...");
    clearInterval(pollInterval);
    clearInterval(freezeCheckInterval);
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("\n[SIGINT] Shutting down gracefully...");
    clearInterval(pollInterval);
    clearInterval(freezeCheckInterval);
    await prisma.$disconnect();
    process.exit(0);
  });
}

// Start watcher
main().catch(async (error) => {
  console.error("[FATAL ERROR]", error);
  await prisma.$disconnect();
  process.exit(1);
});
