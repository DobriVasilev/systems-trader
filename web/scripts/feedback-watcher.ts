#!/usr/bin/env tsx

/**
 * Autonomous Feedback Watcher
 *
 * Polls database for pending feedback from dev_team/admin users
 * Outputs JSON to stdout when found, then exits to trigger Claude Code
 *
 * Run with: npm run watch:feedback
 */

import { PrismaClient } from "@prisma/client";
import { generateFeedbackPrompt } from "../src/lib/feedback-prompt-generator";

const prisma = new PrismaClient();

// Configuration
const POLL_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_FILE = "/tmp/feedback-watcher-heartbeat.txt";
const MAX_RUNTIME = 30 * 60 * 1000; // 30 minutes max runtime (safety)

// Track health
let lastHeartbeat = Date.now();
let startTime = Date.now();

// Write heartbeat to file for monitoring
function updateHeartbeat() {
  try {
    const fs = require("fs");
    fs.writeFileSync(HEARTBEAT_FILE, Date.now().toString());
    lastHeartbeat = Date.now();
  } catch (error) {
    console.error("Failed to write heartbeat:", error);
  }
}

// Freeze detection - if this function is called and enough time has passed since last heartbeat
function checkForFreeze() {
  const now = Date.now();
  const timeSinceLastHeartbeat = now - lastHeartbeat;

  if (timeSinceLastHeartbeat > POLL_INTERVAL * 3) {
    console.error(`[FREEZE DETECTED] No heartbeat for ${timeSinceLastHeartbeat}ms`);
    console.error(`[ACTION REQUIRED] Watcher may be frozen. Restart recommended.`);
    process.exit(1);
  }

  // Safety: Kill after max runtime to prevent runaway processes
  if (now - startTime > MAX_RUNTIME) {
    console.log(`[MAX RUNTIME] Watcher has run for ${MAX_RUNTIME}ms. Exiting for restart.`);
    process.exit(0);
  }
}

// Check for pending feedback from dev_team/admin users
async function pollForFeedback() {
  try {
    updateHeartbeat();

    console.log(`[${new Date().toISOString()}] Polling for pending feedback...`);

    // Find oldest pending feedback from dev_team or admin users
    const feedback = await prisma.feedback.findFirst({
      where: {
        implementationStatus: "PENDING",
        status: "PENDING",
        user: {
          role: {
            in: ["dev_team", "admin"],
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        attachments: {
          select: {
            id: true,
            url: true,
            filename: true,
            category: true,
            contentType: true,
            size: true,
            width: true,
            height: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc", // Process oldest first
      },
    });

    if (feedback) {
      console.log(`[FEEDBACK FOUND] ID: ${feedback.id}, Type: ${feedback.type}, User: ${feedback.user.name || feedback.user.email}`);

      // Check retry count
      if (feedback.retryCount >= feedback.maxRetries) {
        console.log(`[MAX RETRIES] Feedback ${feedback.id} has reached max retries (${feedback.retryCount}/${feedback.maxRetries})`);
        await prisma.feedback.update({
          where: { id: feedback.id },
          data: {
            implementationStatus: "FAILED",
            status: "CLOSED",
            errorMessage: `Max retries (${feedback.maxRetries}) exceeded`,
          },
        });
        return; // Continue watching
      }

      // Mark as processing immediately to prevent duplicate processing
      await prisma.feedback.update({
        where: { id: feedback.id },
        data: {
          implementationStatus: "PROCESSING",
          status: "IN_PROGRESS",
          processedAt: new Date(),
          errorMessage: null,
        },
      });

      // Generate prompt
      let prompt: string;
      try {
        const feedbackData = {
          ...feedback,
          createdAt: feedback.createdAt.toISOString(),
          updatedAt: feedback.updatedAt.toISOString(),
        };
        prompt = generateFeedbackPrompt(feedbackData as any);
      } catch (error) {
        console.error(`[ERROR] Failed to generate prompt:`, error);
        await prisma.feedback.update({
          where: { id: feedback.id },
          data: {
            implementationStatus: "FAILED",
            errorMessage: `Failed to generate prompt: ${error instanceof Error ? error.message : String(error)}`,
            retryCount: { increment: 1 },
          },
        });
        return; // Continue watching
      }

      // Output JSON payload for Claude Code to consume
      const payload = {
        feedbackId: feedback.id,
        feedbackType: feedback.type,
        userName: feedback.user.name || feedback.user.email,
        userRole: feedback.user.role,
        title: feedback.title,
        textContent: feedback.textContent,
        voiceTranscription: feedback.voiceTranscription,
        attachments: feedback.attachments,
        prompt: prompt,
        timestamp: new Date().toISOString(),
      };

      console.log("\n\n[CLAUDE CODE TRIGGER]");
      console.log("=".repeat(80));
      console.log(JSON.stringify(payload, null, 2));
      console.log("=".repeat(80));
      console.log("\n");

      // Exit to trigger Claude Code activation
      console.log("[EXITING] Watcher will be restarted by runner script");
      await prisma.$disconnect();
      process.exit(0);
    } else {
      console.log(`[NO FEEDBACK] No pending feedback found. Waiting ${POLL_INTERVAL}ms...`);
    }
  } catch (error) {
    console.error(`[ERROR] Polling error:`, error);
    // Don't exit on error, continue watching
  }
}

// Main loop
async function main() {
  console.log("[WATCHER STARTED]");
  console.log(`Polling interval: ${POLL_INTERVAL}ms`);
  console.log(`Max runtime: ${MAX_RUNTIME}ms`);
  console.log(`Heartbeat file: ${HEARTBEAT_FILE}`);
  console.log("Watching for feedback from dev_team and admin users...\n");

  // Initial heartbeat
  updateHeartbeat();

  // Set up freeze detection check
  const freezeCheckInterval = setInterval(checkForFreeze, POLL_INTERVAL);

  // Set up polling interval
  const pollInterval = setInterval(async () => {
    await pollForFeedback();
  }, POLL_INTERVAL);

  // Initial poll (don't wait for first interval)
  await pollForFeedback();

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
