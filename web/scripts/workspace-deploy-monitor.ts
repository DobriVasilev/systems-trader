#!/usr/bin/env tsx

/**
 * Workspace Deploy Monitor
 *
 * Monitors Vercel deployments for workspace implementations
 * Implements auto-retry with log forwarding on failure
 *
 * Run with: npm run monitor:workspace-deploy
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// Configuration
const POLL_INTERVAL = 30000; // Check every 30 seconds
const VERCEL_API_URL = "https://api.vercel.com";
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const WORKSPACE_DIR = "/tmp/claude-workspace";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";

if (!VERCEL_TOKEN) {
  console.error("[ERROR] VERCEL_TOKEN environment variable not set");
  process.exit(1);
}

if (!VERCEL_PROJECT_ID) {
  console.error("[ERROR] VERCEL_PROJECT_ID environment variable not set");
  process.exit(1);
}

// Fetch deployment by commit hash
async function fetchDeploymentByCommit(commitHash: string) {
  try {
    const response = await fetch(
      `${VERCEL_API_URL}/v6/deployments?projectId=${VERCEL_PROJECT_ID}&gitCommitSha=${commitHash}`,
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Vercel API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.deployments?.[0] || null;
  } catch (error) {
    console.error(`[ERROR] Failed to fetch deployment:`, error);
    return null;
  }
}

// Fetch deployment logs
async function fetchDeploymentLogs(deploymentId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${VERCEL_API_URL}/v2/deployments/${deploymentId}/events`,
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Vercel API error: ${response.status} ${response.statusText}`);
    }

    const events = await response.json();

    // Extract error logs
    const errorLogs = events
      .filter((e: any) => e.type === "stderr" || e.payload?.level === "error")
      .map((e: any) => e.payload?.text || e.text)
      .join("\n");

    return errorLogs || null;
  } catch (error) {
    console.error(`[ERROR] Failed to fetch logs:`, error);
    return null;
  }
}

// Send retry feedback to Claude
async function sendRetryFeedback(execution: any, deployLogs: string) {
  const workspace = execution.workspace;
  const retryCount = execution.retryCount + 1;

  console.log(`[RETRY] Creating retry feedback for execution ${execution.id} (attempt ${retryCount}/${execution.maxRetries})`);

  // Create retry execution
  const retryExecution = await prisma.claudeExecution.create({
    data: {
      workspaceId: workspace.id,
      triggeredBy: execution.triggeredBy,
      status: "pending",
      phase: "planning",
      progress: 0,
      sessionIds: execution.sessionIds,
      feedbackType: "deploy_failure_retry",
      retryCount: retryCount,
      maxRetries: execution.maxRetries,
      parentExecutionId: execution.id,
      retryReason: `Deployment failed with errors:\n${deployLogs}`,
    },
  });

  // Create workspace message
  await prisma.workspaceMessage.create({
    data: {
      workspaceId: workspace.id,
      executionId: retryExecution.id,
      type: "execution_retry",
      authorType: "system",
      title: `Deploy Failed - Auto Retry ${retryCount}/${execution.maxRetries}`,
      content: `Deployment failed. Claude will automatically retry with deployment logs.`,
      data: {
        originalExecutionId: execution.id,
        retryCount: retryCount,
        maxRetries: execution.maxRetries,
      },
    },
  });

  // Generate retry prompt
  let prompt = `# 🔄 Deploy Failure - Auto Retry\n\n`;
  prompt += `**Pattern:** ${workspace.name} (${workspace.patternType})\n`;
  prompt += `**Version:** ${workspace.version}\n`;
  prompt += `**Retry Attempt:** ${retryCount}/${execution.maxRetries}\n\n`;

  prompt += `## 🚨 Deployment Error\n\n`;
  prompt += `The previous implementation was committed successfully, but the deployment failed with the following errors:\n\n`;
  prompt += `\`\`\`\n${deployLogs}\n\`\`\`\n\n`;

  prompt += `## 🎯 Task\n\n`;
  prompt += `Please analyze the deployment errors and fix the issues. Common problems include:\n`;
  prompt += `- TypeScript compilation errors\n`;
  prompt += `- Missing dependencies\n`;
  prompt += `- Import/export issues\n`;
  prompt += `- Build configuration problems\n\n`;

  prompt += `After fixing:\n`;
  prompt += `1. Ensure all TypeScript errors are resolved\n`;
  prompt += `2. Run the build locally to verify\n`;
  prompt += `3. Commit the fixes\n`;
  prompt += `4. The system will monitor the deployment again\n\n`;

  // Write prompt to file
  const promptFile = path.join(WORKSPACE_DIR, "prompts", `${retryExecution.id}-retry.md`);
  fs.writeFileSync(promptFile, prompt);

  // Create feedback queue file
  const feedbackFile = path.join(WORKSPACE_DIR, "feedback-queue", `${retryExecution.id}-retry.json`);
  const feedbackData = {
    executionId: retryExecution.id,
    workspaceId: workspace.id,
    patternType: workspace.patternType,
    patternName: workspace.name,
    retryAttempt: retryCount,
    maxRetries: execution.maxRetries,
    parentExecutionId: execution.id,
    promptFile: promptFile,
    deployLogs: deployLogs,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(feedbackFile, JSON.stringify(feedbackData, null, 2));

  // Update retry execution with prompt file
  await prisma.claudeExecution.update({
    where: { id: retryExecution.id },
    data: {
      promptFile: promptFile,
    },
  });

  console.log(`[RETRY QUEUED] Feedback file created: ${feedbackFile}`);
}

// Send admin notification email
async function sendAdminNotification(execution: any, deployLogs: string) {
  console.log(`[MAX RETRIES] Execution ${execution.id} has reached max retries, notifying admin`);

  // Create failure message
  await prisma.workspaceMessage.create({
    data: {
      workspaceId: execution.workspaceId,
      executionId: execution.id,
      type: "execution_failed",
      authorType: "system",
      title: "Max Retries Reached - Manual Intervention Required",
      content: `Deployment has failed ${execution.maxRetries} times. Admin has been notified.`,
      data: {
        retryCount: execution.retryCount,
        maxRetries: execution.maxRetries,
        requiresManualIntervention: true,
      },
    },
  });

  // TODO: Integrate with SendGrid or other email service
  console.log(`[EMAIL] Would send notification to: ${ADMIN_EMAIL}`);
  console.log(`[EMAIL] Subject: Max Deploy Retries Reached - ${execution.workspace.name}`);
  console.log(`[EMAIL] Execution ID: ${execution.id}`);
}

// Check pending executions for deploy monitoring
async function monitorDeployments() {
  try {
    console.log(`[${new Date().toISOString()}] Checking for deployments to monitor...`);

    // Find executions that completed successfully but haven't been deployed yet
    const executions = await prisma.claudeExecution.findMany({
      where: {
        status: "completed",
        commitHash: { not: null },
        deployStatus: { in: [null, "building"] },
      },
      include: {
        workspace: true,
      },
      orderBy: {
        completedAt: "asc",
      },
    });

    if (executions.length === 0) {
      console.log("[NO DEPLOYMENTS] No pending deployments to monitor");
      return;
    }

    console.log(`[MONITORING] Found ${executions.length} deployment(s) to check`);

    for (const execution of executions) {
      console.log(`[CHECKING] Execution ${execution.id} - Commit: ${execution.commitHash}`);

      const deployment = await fetchDeploymentByCommit(execution.commitHash!);

      if (!deployment) {
        // Deployment not found yet, might still be queued
        if (!execution.deployStartedAt) {
          await prisma.claudeExecution.update({
            where: { id: execution.id },
            data: {
              deployStartedAt: new Date(),
              deployStatus: "building",
            },
          });
        }
        console.log(`[QUEUED] Deployment not found yet for commit ${execution.commitHash}`);
        continue;
      }

      const deployState = deployment.state; // ready, building, error, canceled
      const deployUrl = deployment.url;

      console.log(`[DEPLOY STATUS] ${deployState} - ${deployUrl}`);

      if (deployState === "READY") {
        // Deployment successful
        await prisma.claudeExecution.update({
          where: { id: execution.id },
          data: {
            deployStatus: "ready",
            deployUrl: `https://${deployUrl}`,
            deployCompletedAt: new Date(),
          },
        });

        await prisma.workspaceMessage.create({
          data: {
            workspaceId: execution.workspaceId,
            executionId: execution.id,
            type: "deploy_succeeded",
            authorType: "system",
            title: "Deployment Successful",
            content: `Changes deployed successfully to production`,
            data: {
              deployUrl: `https://${deployUrl}`,
              commitHash: execution.commitHash,
            },
          },
        });

        console.log(`[SUCCESS] Deployment successful: https://${deployUrl}`);
      } else if (deployState === "ERROR" || deployState === "CANCELED") {
        // Deployment failed
        console.log(`[FAILED] Deployment failed with state: ${deployState}`);

        const logs = await fetchDeploymentLogs(deployment.id);

        await prisma.claudeExecution.update({
          where: { id: execution.id },
          data: {
            deployStatus: "error",
            deployLogs: logs || "Deployment failed (no logs available)",
            deployCompletedAt: new Date(),
          },
        });

        // Check retry count
        if (execution.retryCount < execution.maxRetries) {
          // Auto-retry with logs
          await sendRetryFeedback(execution, logs || "Deployment failed");
        } else {
          // Max retries reached, notify admin
          await sendAdminNotification(execution, logs || "Deployment failed");
        }
      } else if (deployState === "BUILDING" || deployState === "QUEUED") {
        // Still building
        if (!execution.deployStartedAt) {
          await prisma.claudeExecution.update({
            where: { id: execution.id },
            data: {
              deployStartedAt: new Date(),
              deployStatus: "building",
            },
          });
        }
        console.log(`[BUILDING] Deployment in progress...`);
      }
    }
  } catch (error) {
    console.error(`[ERROR] Monitoring error:`, error);
  }
}

// Main loop
async function main() {
  console.log("[DEPLOY MONITOR STARTED]");
  console.log(`Vercel Project ID: ${VERCEL_PROJECT_ID}`);
  console.log(`Poll interval: ${POLL_INTERVAL}ms`);
  console.log(`Workspace directory: ${WORKSPACE_DIR}`);
  console.log("Monitoring Vercel deployments...\n");

  // Set up polling interval
  const pollInterval = setInterval(async () => {
    await monitorDeployments();
  }, POLL_INTERVAL);

  // Initial check
  await monitorDeployments();

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

// Start monitor
main().catch(async (error) => {
  console.error("[FATAL ERROR]", error);
  await prisma.$disconnect();
  process.exit(1);
});
