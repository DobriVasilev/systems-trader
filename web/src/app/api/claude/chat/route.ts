import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

const WORKSPACE_DIR = "/tmp/claude-workspace";
const LOGS_DIR = path.join(WORKSPACE_DIR, "logs");

/**
 * POST /api/claude/chat - Send message to Claude Code
 *
 * Body: {
 *   workspaceId: string,
 *   message: string,
 *   executionId?: string // Optional, if continuing an execution
 * }
 *
 * Returns: {
 *   success: boolean,
 *   response: string,
 *   conversationId: string
 * }
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { workspaceId, message, executionId } = body;

    if (!workspaceId || !message) {
      return NextResponse.json(
        { success: false, error: "workspaceId and message are required" },
        { status: 400 }
      );
    }

    // Get workspace
    const workspace = await prisma.patternWorkspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        patternType: true,
        status: true,
        claudeSessionId: true,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Ensure logs directory exists
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }

    // Create unique ID for this chat message
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const outputFile = path.join(LOGS_DIR, `${chatId}_output.log`);
    const errorFile = path.join(LOGS_DIR, `${chatId}_error.log`);

    // Get the project directory (where Claude should execute)
    const projectDir = process.cwd();

    // Execute Claude Code with the message
    // Use --continue to maintain the workspace's conversation context
    const claudeCommand = `cd "${projectDir}" && echo "${message.replace(/"/g, '\\"')}" | timeout 300 claude --continue --dangerously-skip-permissions > "${outputFile}" 2> "${errorFile}"`;

    console.log(`[CHAT] Executing Claude command for workspace ${workspace.name}`);
    console.log(`[CHAT] Message: ${message}`);

    try {
      await execAsync(claudeCommand);

      // Read Claude's response
      const response = fs.readFileSync(outputFile, "utf8");

      console.log(`[CHAT] Claude response (${response.length} chars)`);

      // Create workspace message for this chat interaction
      await prisma.workspaceMessage.create({
        data: {
          workspaceId: workspace.id,
          executionId: executionId || null,
          type: "chat_message",
          authorType: "user",
          title: session.user.name || "User",
          content: message,
          data: {
            userId: session.user.id,
            chatId,
          },
        },
      });

      // Create message for Claude's response
      await prisma.workspaceMessage.create({
        data: {
          workspaceId: workspace.id,
          executionId: executionId || null,
          type: "chat_response",
          authorType: "claude",
          title: "Claude Code",
          content: response,
          data: {
            chatId,
            responseLength: response.length,
          },
        },
      });

      // Clean up temporary files
      try {
        fs.unlinkSync(outputFile);
        fs.unlinkSync(errorFile);
      } catch (cleanupError) {
        console.error("[CHAT] Failed to clean up temp files:", cleanupError);
      }

      return NextResponse.json({
        success: true,
        response,
        chatId,
      });
    } catch (error: any) {
      console.error("[CHAT] Claude execution error:", error);

      // Try to read error output
      let errorMessage = "Claude Code execution failed";
      if (fs.existsSync(errorFile)) {
        errorMessage = fs.readFileSync(errorFile, "utf8") || errorMessage;
      }

      // Log the failed interaction
      await prisma.workspaceMessage.create({
        data: {
          workspaceId: workspace.id,
          executionId: executionId || null,
          type: "chat_error",
          authorType: "system",
          title: "Chat Error",
          content: `Failed to get response from Claude: ${errorMessage}`,
          data: {
            error: errorMessage,
            chatId,
          },
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[CHAT] Request error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
