#!/usr/bin/env tsx

/**
 * Claude Code Health Monitor
 *
 * Monitors Claude Code process for freeze/crash conditions
 * Auto-restarts with recovery options if needed
 *
 * Run with: npm run monitor:claude
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Configuration
const HEARTBEAT_FILE = "/tmp/feedback-watcher-heartbeat.txt";
const CLAUDE_LOG_FILE = "/tmp/claude-code-autonomous.log";
const FREEZE_TIMEOUT = 60000; // 60 seconds without heartbeat = freeze
const CHECK_INTERVAL = 10000; // Check every 10 seconds
const MAX_RESTARTS = 5; // Max restarts per hour
const RESTART_WINDOW = 3600000; // 1 hour

// State tracking
let claudeProcess: ChildProcess | null = null;
let restartHistory: number[] = [];
let consecutiveFailures = 0;

// Check if watcher is frozen by examining heartbeat file
function isWatcherFrozen(): boolean {
  try {
    if (!fs.existsSync(HEARTBEAT_FILE)) {
      console.log("[WARN] Heartbeat file not found");
      return false; // Don't treat as frozen if file doesn't exist yet
    }

    const heartbeatTime = parseInt(fs.readFileSync(HEARTBEAT_FILE, "utf8"));
    const now = Date.now();
    const timeSinceHeartbeat = now - heartbeatTime;

    if (timeSinceHeartbeat > FREEZE_TIMEOUT) {
      console.log(`[FREEZE DETECTED] Watcher heartbeat ${timeSinceHeartbeat}ms old (threshold: ${FREEZE_TIMEOUT}ms)`);
      return true;
    }

    return false;
  } catch (error) {
    console.error("[ERROR] Failed to check heartbeat:", error);
    return false;
  }
}

// Check if we've hit restart limits
function canRestart(): boolean {
  const now = Date.now();

  // Remove old restart timestamps outside the window
  restartHistory = restartHistory.filter(time => now - time < RESTART_WINDOW);

  if (restartHistory.length >= MAX_RESTARTS) {
    console.error(`[RESTART LIMIT] Hit max restarts (${MAX_RESTARTS}) in the last hour`);
    return false;
  }

  return true;
}

// Record a restart
function recordRestart() {
  restartHistory.push(Date.now());
  consecutiveFailures++;
}

// Start Claude Code process
function startClaudeProcess(skipPermissions: boolean = false): ChildProcess {
  console.log(`[STARTING CLAUDE] ${skipPermissions ? "With --dangerously-skip-permissions" : "Normal mode"}`);

  const args = skipPermissions ? ["--dangerously-skip-permissions"] : [];

  const proc = spawn("claude", args, {
    cwd: path.join(__dirname, ".."),
    stdio: ["inherit", "pipe", "pipe"],
    env: {
      ...process.env,
      AUTONOMOUS_MODE: "true",
    },
  });

  // Log output
  const logStream = fs.createWriteStream(CLAUDE_LOG_FILE, { flags: "a" });

  proc.stdout?.on("data", (data) => {
    const output = data.toString();
    console.log(`[CLAUDE OUT] ${output.trim()}`);
    logStream.write(`[${new Date().toISOString()}] ${output}`);
  });

  proc.stderr?.on("data", (data) => {
    const output = data.toString();
    console.error(`[CLAUDE ERR] ${output.trim()}`);
    logStream.write(`[${new Date().toISOString()}] [ERROR] ${output}`);
  });

  proc.on("exit", (code, signal) => {
    console.log(`[CLAUDE EXIT] Code: ${code}, Signal: ${signal}`);
    logStream.end();

    if (code !== 0) {
      console.error(`[CLAUDE CRASH] Non-zero exit code: ${code}`);
      handleClaudeCrash();
    }
  });

  proc.on("error", (error) => {
    console.error("[CLAUDE ERROR]", error);
    logStream.end();
    handleClaudeCrash();
  });

  return proc;
}

// Handle Claude crash
function handleClaudeCrash() {
  if (!canRestart()) {
    console.error("[CRITICAL] Cannot restart Claude - hit rate limit");
    console.error("[ACTION] Manual intervention required");
    process.exit(1);
  }

  recordRestart();

  console.log(`[AUTO-RESTART] Restarting Claude (attempt ${consecutiveFailures})...`);

  // Use skip-permissions mode if we've had multiple failures
  const skipPermissions = consecutiveFailures >= 3;

  if (skipPermissions) {
    console.log("[RECOVERY MODE] Using --dangerously-skip-permissions");
  }

  // Wait a bit before restarting
  setTimeout(() => {
    claudeProcess = startClaudeProcess(skipPermissions);
  }, 5000);
}

// Handle freeze detection
function handleFreezeDetection() {
  console.log("[FREEZE HANDLER] Attempting to recover frozen Claude...");

  if (claudeProcess) {
    console.log("[KILLING] Sending SIGTERM to frozen Claude process...");
    claudeProcess.kill("SIGTERM");

    // Force kill after 5 seconds if still alive
    setTimeout(() => {
      if (claudeProcess && !claudeProcess.killed) {
        console.log("[FORCE KILL] Sending SIGKILL...");
        claudeProcess.kill("SIGKILL");
      }
    }, 5000);
  }

  handleClaudeCrash();
}

// Main monitoring loop
async function monitorLoop() {
  console.log(`[${new Date().toISOString()}] Checking health...`);

  // Check if watcher is frozen
  if (isWatcherFrozen()) {
    handleFreezeDetection();
    return;
  }

  // Check if Claude process is still running
  if (claudeProcess && claudeProcess.exitCode === null && !claudeProcess.killed) {
    console.log("[HEALTH] Claude process running normally");
    // Reset consecutive failures on successful check
    if (consecutiveFailures > 0) {
      console.log(`[RECOVERY] Claude stable, resetting failure counter`);
      consecutiveFailures = 0;
    }
  } else if (!claudeProcess || claudeProcess.killed) {
    console.log("[WARN] Claude process not running, starting...");
    if (canRestart()) {
      recordRestart();
      claudeProcess = startClaudeProcess(consecutiveFailures >= 3);
    }
  }
}

// Main function
async function main() {
  console.log("=".repeat(80));
  console.log("Claude Code Health Monitor - Started");
  console.log("=".repeat(80));
  console.log(`Heartbeat file: ${HEARTBEAT_FILE}`);
  console.log(`Claude log file: ${CLAUDE_LOG_FILE}`);
  console.log(`Freeze timeout: ${FREEZE_TIMEOUT}ms`);
  console.log(`Check interval: ${CHECK_INTERVAL}ms`);
  console.log(`Max restarts per hour: ${MAX_RESTARTS}`);
  console.log("=".repeat(80));
  console.log("");

  // Start initial Claude process
  claudeProcess = startClaudeProcess();

  // Start monitoring loop
  const monitorInterval = setInterval(monitorLoop, CHECK_INTERVAL);

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("\n[SIGTERM] Shutting down monitor...");
    clearInterval(monitorInterval);
    if (claudeProcess) {
      claudeProcess.kill("SIGTERM");
    }
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("\n[SIGINT] Shutting down monitor...");
    clearInterval(monitorInterval);
    if (claudeProcess) {
      claudeProcess.kill("SIGTERM");
    }
    process.exit(0);
  });
}

// Start monitor
main().catch((error) => {
  console.error("[FATAL ERROR]", error);
  process.exit(1);
});
