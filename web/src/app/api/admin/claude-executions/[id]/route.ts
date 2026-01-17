import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * GET /api/admin/claude-executions/[id] - Get detailed execution info
 * Admin only
 *
 * Returns:
 * - Full execution details
 * - Claude output transcript
 * - Files changed with diffs
 * - Workspace messages related to this execution
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { id } = params;

    // Get execution with all relations
    const execution = await prisma.claudeExecution.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            patternType: true,
            category: true,
            status: true,
            version: true,
            description: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: "asc",
          },
          take: 50,
        },
      },
    });

    if (!execution) {
      return NextResponse.json(
        { success: false, error: "Execution not found" },
        { status: 404 }
      );
    }

    // Get sessions that were processed
    const sessions = await prisma.patternSession.findMany({
      where: {
        id: { in: execution.sessionIds },
      },
      include: {
        corrections: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Get file diffs if there's a commit hash
    let fileDiffs: Record<string, string> = {};
    if (execution.commitHash) {
      try {
        const projectDir = process.cwd(); // Current working directory of Next.js app

        // Get the list of files changed in the commit
        const { stdout: filesOutput } = await execAsync(
          `cd ${projectDir} && git diff --name-only ${execution.commitHash}^ ${execution.commitHash}`
        );

        const files = filesOutput.trim().split("\n").filter(Boolean);

        // Get diff for each file
        for (const file of files) {
          try {
            const { stdout: diffOutput } = await execAsync(
              `cd ${projectDir} && git diff ${execution.commitHash}^ ${execution.commitHash} -- "${file}"`
            );
            fileDiffs[file] = diffOutput;
          } catch (e) {
            console.error(`Failed to get diff for ${file}:`, e);
            fileDiffs[file] = "Error: Could not retrieve diff";
          }
        }
      } catch (error) {
        console.error("Failed to get file diffs:", error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        execution: {
          id: execution.id,
          workspaceId: execution.workspaceId,
          status: execution.status,
          phase: execution.phase,
          progress: execution.progress,
          triggeredAt: execution.triggeredAt.toISOString(),
          completedAt: execution.completedAt?.toISOString() || null,
          erroredAt: execution.erroredAt?.toISOString() || null,
          sessionIds: execution.sessionIds,
          feedbackType: execution.feedbackType,
          promptFile: execution.promptFile,
          filesChanged: execution.filesChanged,
          commitHash: execution.commitHash,
          commitMessage: execution.commitMessage,
          deployStartedAt: execution.deployStartedAt?.toISOString() || null,
          deployCompletedAt: execution.deployCompletedAt?.toISOString() || null,
          deployUrl: execution.deployUrl,
          deployStatus: execution.deployStatus,
          retryCount: execution.retryCount,
          maxRetries: execution.maxRetries,
          retryReason: execution.retryReason,
          parentExecutionId: execution.parentExecutionId,
          phases: execution.phases,
          checkpoints: execution.checkpoints,
          error: execution.error,
          claudeSessionId: execution.claudeSessionId,
          sessionResumed: execution.sessionResumed,
          claudeOutput: execution.claudeOutput,
        },
        workspace: execution.workspace,
        triggeredBy: execution.user,
        sessions: sessions.map((session) => ({
          id: session.id,
          name: session.name,
          symbol: session.symbol,
          timeframe: session.timeframe,
          patternType: session.patternType,
          status: session.status,
          createdAt: session.createdAt.toISOString(),
          corrections: session.corrections.map((correction) => ({
            id: correction.id,
            correctionType: correction.correctionType,
            reason: correction.reason,
            originalTime: correction.originalTime?.toISOString() || null,
            originalPrice: correction.originalPrice,
            correctedTime: correction.correctedTime?.toISOString() || null,
            correctedPrice: correction.correctedPrice,
            correctedType: correction.correctedType,
            createdAt: correction.createdAt.toISOString(),
            user: correction.user,
          })),
        })),
        messages: execution.messages.map((msg) => ({
          id: msg.id,
          type: msg.type,
          title: msg.title,
          content: msg.content,
          authorType: msg.authorType,
          status: msg.status,
          progress: msg.progress,
          data: msg.data,
          createdAt: msg.createdAt.toISOString(),
        })),
        fileDiffs,
      },
    });
  } catch (error) {
    console.error("Error fetching execution details:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch execution details" },
      { status: 500 }
    );
  }
}
