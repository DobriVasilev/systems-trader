#!/usr/bin/env tsx

/**
 * Workspace Status Watcher
 *
 * Watches /tmp/claude-workspace/status directory for status updates from Claude Code
 * Updates ClaudeExecution records and creates WorkspaceMessage timeline entries
 *
 * Run with: npm run watch:workspace-status
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { watch } from "fs";
import {
  notifyExecutionFailure,
  notifyClaudeLogout,
  notifyRepeatedFailures,
} from "../src/lib/email";

const prisma = new PrismaClient();

// Configuration
const WORKSPACE_DIR = "/tmp/claude-workspace";
const STATUS_DIR = path.join(WORKSPACE_DIR, "status");
const POLL_INTERVAL = 2000; // Check every 2 seconds for file changes

// Ensure status directory exists
function ensureStatusDirectory() {
  if (!fs.existsSync(STATUS_DIR)) {
    fs.mkdirSync(STATUS_DIR, { recursive: true });
  }
}

// Process a status update file
async function processStatusUpdate(filename: string) {
  const filePath = path.join(STATUS_DIR, filename);

  try {
    console.log(`[${new Date().toISOString()}] Processing status update: ${filename}`);

    // Read status file
    const content = fs.readFileSync(filePath, "utf8");
    const statusData = JSON.parse(content);

    const { executionId, status, phase, progress, message, data, error, commitHash, claudeOutput } = statusData;

    if (!executionId) {
      console.error(`[ERROR] Status file missing executionId: ${filename}`);
      return;
    }

    // Find execution
    const execution = await prisma.claudeExecution.findUnique({
      where: { id: executionId },
      include: {
        workspace: true,
      },
    });

    if (!execution) {
      console.error(`[ERROR] Execution not found: ${executionId}`);
      return;
    }

    console.log(`[UPDATE] Execution ${executionId}: ${status} - ${phase || "N/A"} - ${progress || 0}%`);

    // Update execution record
    const updateData: any = {};

    if (status) updateData.status = status;
    if (phase) updateData.phase = phase;
    if (progress !== undefined) updateData.progress = progress;
    if (error) {
      updateData.error = error;
      updateData.erroredAt = new Date();
    }

    // Handle Claude output (base64 encoded)
    if (claudeOutput) {
      try {
        const decodedOutput = Buffer.from(claudeOutput, "base64").toString("utf-8");
        updateData.claudeOutput = decodedOutput;
        updateData.sessionResumed = true; // Mark as resumed since we used --continue
        console.log(`[OUTPUT] Saved Claude output (${decodedOutput.length} chars)`);
      } catch (e) {
        console.error(`[ERROR] Failed to decode Claude output:`, e);
      }
    }

    // Handle commit hash from status file
    if (commitHash) {
      updateData.commitHash = commitHash;
    }

    // Handle completion
    if (status === "completed") {
      updateData.completedAt = new Date();
      updateData.progress = 100;

      if (data?.filesChanged) updateData.filesChanged = data.filesChanged;
      if (data?.commitHash) updateData.commitHash = data.commitHash;
      if (data?.commitMessage) updateData.commitMessage = data.commitMessage;
    }

    await prisma.claudeExecution.update({
      where: { id: executionId },
      data: updateData,
    });

    // Create workspace message
    const messageData: any = {
      workspaceId: execution.workspaceId,
      executionId: executionId,
      authorType: "claude",
    };

    if (status === "running" && phase) {
      messageData.type = "execution_phase_changed";
      messageData.title = `Phase: ${phase}`;
      messageData.content = `Execution entered ${phase} phase`;
      messageData.data = { phase, progress: progress || 0 };
      messageData.progress = progress || 0;
    } else if (status === "completed") {
      messageData.type = "execution_completed";
      messageData.title = "Implementation Complete";
      messageData.content = data?.commitMessage || "Changes implemented successfully";
      messageData.data = {
        filesChanged: data?.filesChanged || [],
        commitHash: data?.commitHash,
      };
      messageData.progress = 100;

      // Mark sessions as implemented
      if (execution.sessionIds.length > 0) {
        await prisma.patternSession.updateMany({
          where: {
            id: { in: execution.sessionIds },
          },
          data: {
            status: "implemented",
            implementedAt: new Date(),
            implementedBy: execution.triggeredBy,
          },
        });
      }
    } else if (status === "failed" || error) {
      messageData.type = "execution_failed";
      messageData.title = "Implementation Failed";
      messageData.content = error || "Execution failed";
      messageData.data = { error };

      // Mark sessions as active so they can be retried
      // (Keep them in submitted_for_review status so they can be picked up again)
      if (execution.sessionIds.length > 0) {
        // Don't change status - let them remain submitted_for_review for retry
      }

      // Send email notification for failure
      try {
        await notifyExecutionFailure({
          workspaceName: execution.workspace.name,
          patternType: execution.workspace.patternType,
          error: error || "Execution failed",
          executionId: execution.id,
          retryCount: execution.retryCount,
        });
        console.log("[EMAIL] Sent execution failure notification");
      } catch (emailError) {
        console.error("[EMAIL] Failed to send failure notification:", emailError);
      }

      // Check for Claude logout (common error patterns)
      const isLogoutError =
        error &&
        (error.includes("authentication") ||
          error.includes("not logged in") ||
          error.includes("ENOENT") && error.includes("claude") ||
          error.includes("command not found: claude"));

      if (isLogoutError) {
        try {
          await notifyClaudeLogout();
          console.log("[EMAIL] Sent Claude logout notification");
        } catch (emailError) {
          console.error("[EMAIL] Failed to send logout notification:", emailError);
        }
      }

      // Check for repeated failures (3+ consecutive failures)
      try {
        const recentExecutions = await prisma.claudeExecution.findMany({
          where: {
            workspaceId: execution.workspaceId,
          },
          orderBy: {
            triggeredAt: "desc",
          },
          take: 5,
          include: {
            workspace: {
              select: {
                name: true,
              },
            },
          },
        });

        const consecutiveFailures = recentExecutions
          .filter((exec) => exec.status === "failed")
          .slice(0, 3);

        if (consecutiveFailures.length >= 3) {
          await notifyRepeatedFailures({
            failureCount: consecutiveFailures.length,
            recentFailures: consecutiveFailures.map((exec) => ({
              workspaceName: exec.workspace.name,
              error: exec.error || "Unknown error",
              failedAt: exec.erroredAt?.toISOString() || exec.triggeredAt.toISOString(),
            })),
          });
          console.log("[EMAIL] Sent repeated failures notification");
        }
      } catch (emailError) {
        console.error("[EMAIL] Failed to check for repeated failures:", emailError);
      }
    } else if (progress !== undefined && progress > 0) {
      messageData.type = "execution_progress";
      messageData.title = `Progress: ${progress}%`;
      messageData.content = data?.message || `Execution ${progress}% complete`;
      messageData.data = { phase, progress };
      messageData.progress = progress;
    }

    if (messageData.type) {
      await prisma.workspaceMessage.create({
        data: messageData,
      });
    }

    // Archive processed file
    const archiveDir = path.join(STATUS_DIR, "processed");
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const archivePath = path.join(archiveDir, `${Date.now()}-${filename}`);
    fs.renameSync(filePath, archivePath);

    console.log(`[PROCESSED] Status update archived: ${archivePath}`);
  } catch (error) {
    console.error(`[ERROR] Failed to process status file ${filename}:`, error);

    // Move to error directory
    const errorDir = path.join(STATUS_DIR, "errors");
    if (!fs.existsSync(errorDir)) {
      fs.mkdirSync(errorDir, { recursive: true });
    }

    const errorPath = path.join(errorDir, `${Date.now()}-${filename}`);
    try {
      fs.renameSync(filePath, errorPath);
    } catch (e) {
      console.error(`[ERROR] Failed to move error file:`, e);
    }
  }
}

// Poll status directory for new files
async function pollStatusDirectory() {
  try {
    if (!fs.existsSync(STATUS_DIR)) {
      return;
    }

    const files = fs.readdirSync(STATUS_DIR).filter(f => f.endsWith(".json"));

    if (files.length === 0) {
      return;
    }

    console.log(`[FOUND] ${files.length} status update(s) to process`);

    for (const file of files) {
      await processStatusUpdate(file);
    }
  } catch (error) {
    console.error(`[ERROR] Polling error:`, error);
  }
}

// Main loop
async function main() {
  console.log("[STATUS WATCHER STARTED]");
  console.log(`Status directory: ${STATUS_DIR}`);
  console.log(`Poll interval: ${POLL_INTERVAL}ms`);
  console.log("Watching for Claude Code status updates...\n");

  // Ensure directory exists
  ensureStatusDirectory();

  // Set up polling interval
  const pollInterval = setInterval(async () => {
    await pollStatusDirectory();
  }, POLL_INTERVAL);

  // Initial poll
  await pollStatusDirectory();

  // Also set up file system watcher for immediate updates
  try {
    const watcher = watch(STATUS_DIR, async (eventType, filename) => {
      if (filename && filename.endsWith(".json") && eventType === "rename") {
        // Wait a bit to ensure file is fully written
        setTimeout(async () => {
          const filePath = path.join(STATUS_DIR, filename);
          if (fs.existsSync(filePath)) {
            await processStatusUpdate(filename);
          }
        }, 100);
      }
    });

    console.log("[FS WATCH] File system watcher active for immediate updates");
  } catch (error) {
    console.warn("[WARN] Could not set up file system watcher, using polling only:", error);
  }

  // Keep process alive
  process.on("SIGTERM", async () => {
    console.log("\n[SIGTERM] Shutting down gracefully...");
    clearInterval(pollInterval);
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("\n[SIGINT] Shutting down gracefully...");
    clearInterval(pollInterval);
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
