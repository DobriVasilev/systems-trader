import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const execAsync = promisify(exec);

// GitHub webhook secret (set in environment)
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

// Verify GitHub signature
function verifyGitHubSignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[WEBHOOK] No GITHUB_WEBHOOK_SECRET set, skipping verification");
    return true; // Allow if no secret configured (dev mode)
  }

  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Auto-deploy handler
async function handleDeploy(payload: any) {
  const projectDir = "/home/dobri/systems-trader/web";
  const branch = payload.ref?.split("/").pop() || "unknown";
  const commits = payload.commits || [];

  console.log(`[WEBHOOK] Received push to ${branch}`);
  console.log(`[WEBHOOK] Commits: ${commits.length}`);

  // Only deploy master branch
  if (branch !== "master") {
    console.log(`[WEBHOOK] Ignoring non-master branch: ${branch}`);
    return { success: true, message: `Ignored branch: ${branch}` };
  }

  try {
    // Step 1: Pull latest code
    console.log("[WEBHOOK] Pulling latest code...");
    const { stdout: pullOutput } = await execAsync(`cd ${projectDir} && git pull origin master`);
    console.log(pullOutput);

    // Step 2: Check if package.json changed
    const packageChanged = commits.some((c: any) =>
      c.added?.includes("web/package.json") ||
      c.modified?.includes("web/package.json")
    );

    if (packageChanged) {
      console.log("[WEBHOOK] package.json changed, running npm install...");
      const { stdout: installOutput } = await execAsync(`cd ${projectDir} && npm install`);
      console.log(installOutput);
    }

    // Step 3: Check if schema changed
    const schemaChanged = commits.some((c: any) =>
      c.added?.includes("web/prisma/schema.prisma") ||
      c.modified?.includes("web/prisma/schema.prisma")
    );

    if (schemaChanged) {
      console.log("[WEBHOOK] Schema changed, running db:push...");
      const { stdout: dbOutput } = await execAsync(`cd ${projectDir} && npm run db:push`);
      console.log(dbOutput);
    }

    // Step 4: Check if workspace scripts changed
    const scriptsChanged = commits.some((c: any) =>
      c.added?.some((f: string) => f.includes("web/scripts/workspace-")) ||
      c.modified?.some((f: string) => f.includes("web/scripts/workspace-"))
    );

    if (scriptsChanged) {
      console.log("[WEBHOOK] Workspace scripts changed, restarting services...");
      // Note: Systemd services will auto-restart on file changes
      try {
        await execAsync("sudo systemctl restart workspace-feedback-watcher || true");
        await execAsync("sudo systemctl restart workspace-status-watcher || true");
        await execAsync("sudo systemctl restart workspace-deploy-monitor || true");
      } catch (error) {
        console.warn("[WEBHOOK] Could not restart services (may not be running):", error);
      }
    }

    console.log("[WEBHOOK] Deploy completed successfully");

    return {
      success: true,
      message: "Deploy completed",
      details: {
        branch,
        commits: commits.length,
        packageChanged,
        schemaChanged,
        scriptsChanged,
      },
    };
  } catch (error) {
    console.error("[WEBHOOK] Deploy failed:", error);
    throw error;
  }
}

// POST handler for GitHub webhooks
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("x-hub-signature-256") || "";

    // Verify signature
    if (!verifyGitHubSignature(body, signature)) {
      console.error("[WEBHOOK] Invalid signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse payload
    const payload = JSON.parse(body);
    const event = request.headers.get("x-github-event");

    console.log(`[WEBHOOK] Received event: ${event}`);

    // Handle push events
    if (event === "push") {
      const result = await handleDeploy(payload);
      return NextResponse.json(result);
    }

    // Ignore other events
    return NextResponse.json({
      success: true,
      message: `Event ${event} ignored`,
    });
  } catch (error) {
    console.error("[WEBHOOK] Error:", error);
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET handler for testing
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "GitHub webhook endpoint",
    instructions: "POST GitHub webhook payload here",
  });
}
