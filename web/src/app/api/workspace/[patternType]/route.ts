import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/workspace/[patternType]
 *
 * Get full workspace details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patternType: string }> }
) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { patternType } = await params;

    // Find workspace with full details
    const workspace = await prisma.patternWorkspace.findUnique({
      where: { patternType },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sessions: {
          select: {
            id: true,
            name: true,
            symbol: true,
            timeframe: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        executions: {
          select: {
            id: true,
            status: true,
            phase: true,
            progress: true,
            triggeredAt: true,
            completedAt: true,
            deployStatus: true,
          },
          orderBy: { triggeredAt: "desc" },
          take: 5,
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(workspace);
  } catch (error) {
    console.error("[API] Workspace GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspace/[patternType]
 *
 * Create or update workspace
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ patternType: string }> }
) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only dev_team and admin can create/update workspaces
    if (session.user.role !== "dev_team" && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { patternType } = await params;
    const body = await request.json();
    const {
      name,
      category,
      description,
      userReasoning,
      identificationSteps,
      attachments,
    } = body;

    // Check if workspace exists
    let workspace = await prisma.patternWorkspace.findUnique({
      where: { patternType },
    });

    if (workspace) {
      // Update existing workspace
      workspace = await prisma.patternWorkspace.update({
        where: { patternType },
        data: {
          name: name || workspace.name,
          category: category || workspace.category,
          description: description || workspace.description,
          userReasoning: userReasoning || workspace.userReasoning,
          identificationSteps: identificationSteps
            ? JSON.stringify(identificationSteps)
            : (workspace.identificationSteps ?? undefined),
          attachments: (attachments || workspace.attachments) ?? undefined,
        },
      });

      // Create timeline message
      await prisma.workspaceMessage.create({
        data: {
          workspaceId: workspace.id,
          type: "pattern_description_submitted",
          content: "Pattern description updated",
          authorId: session.user.id,
          authorType: "user",
          data: {
            description: description || workspace.description,
            identificationSteps: identificationSteps || [],
            attachmentCount: attachments?.length || 0,
          },
        },
      });

      return NextResponse.json({
        success: true,
        workspace,
        message: "Workspace updated successfully",
      });
    } else {
      // Create new workspace
      workspace = await prisma.patternWorkspace.create({
        data: {
          patternType,
          name: name || patternType,
          category: category || "uncategorized",
          status: "soon",
          version: "0.0.0",
          description,
          userReasoning,
          identificationSteps: identificationSteps
            ? JSON.stringify(identificationSteps)
            : null,
          attachments: attachments || [],
          createdById: session.user.id,
        },
      });

      // Create timeline message
      await prisma.workspaceMessage.create({
        data: {
          workspaceId: workspace.id,
          type: "pattern_created",
          content: "Pattern workspace created",
          authorId: session.user.id,
          authorType: "user",
          data: {
            patternType: workspace.patternType,
            category: workspace.category,
            status: workspace.status,
          },
        },
      });

      if (description) {
        await prisma.workspaceMessage.create({
          data: {
            workspaceId: workspace.id,
            type: "pattern_description_submitted",
            content: "Pattern description submitted",
            authorId: session.user.id,
            authorType: "user",
            data: {
              description,
              identificationSteps: identificationSteps || [],
              attachmentCount: attachments?.length || 0,
            },
          },
        });
      }

      return NextResponse.json({
        success: true,
        workspace,
        message: "Workspace created successfully",
      });
    }
  } catch (error) {
    console.error("[API] Workspace POST error:", error);
    return NextResponse.json(
      { error: "Failed to create/update workspace" },
      { status: 500 }
    );
  }
}
