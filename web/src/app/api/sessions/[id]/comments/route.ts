import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateUlid } from "@/lib/ulid";
import { broadcastCommentCreated, broadcastCommentUpdated, broadcastCommentDeleted } from "@/lib/realtime";
import { logCommentCreated, logCommentUpdated, logCommentResolved, logCommentDeleted } from "@/lib/events";

// GET /api/sessions/[id]/comments - Get all comments for a session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Check access
    const patternSession = await prisma.patternSession.findFirst({
      where: {
        id,
        OR: [
          { createdById: session.user.id },
          { shares: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!patternSession) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    const comments = await prisma.patternComment.findMany({
      where: {
        sessionId: id,
        parentId: null, // Only top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        detection: {
          select: {
            id: true,
            detectionType: true,
            price: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// POST /api/sessions/[id]/comments - Create a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const {
      content,
      detectionId,
      correctionId,
      parentId,
      candleTime,
      canvasX,
      canvasY,
    } = body;

    // Check access (view permission is enough for comments)
    const patternSession = await prisma.patternSession.findFirst({
      where: {
        id,
        OR: [
          { createdById: session.user.id },
          { shares: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!patternSession) {
      return NextResponse.json(
        { success: false, error: "Session not found or no permission" },
        { status: 404 }
      );
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Comment content is required" },
        { status: 400 }
      );
    }

    // Create the comment
    const comment = await prisma.patternComment.create({
      data: {
        id: generateUlid(),
        sessionId: id,
        userId: session.user.id,
        content: content.trim(),
        detectionId: detectionId || null,
        correctionId: correctionId || null,
        parentId: parentId || null,
        candleTime: candleTime ? new Date(candleTime) : null,
        canvasX: canvasX || null,
        canvasY: canvasY || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        detection: {
          select: {
            id: true,
            detectionType: true,
            price: true,
          },
        },
      },
    });

    // Broadcast real-time update
    await broadcastCommentCreated(id, comment.id, session.user.id);

    // Log event
    await logCommentCreated(id, session.user.id, comment.id, {
      content: content.trim(),
      detectionId: detectionId || null,
      correctionId: correctionId || null,
      parentId: parentId || null,
    });

    return NextResponse.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create comment" },
      { status: 500 }
    );
  }
}

// PATCH /api/sessions/[id]/comments - Update a comment (resolve/edit)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { commentId, content, resolved } = body;

    if (!commentId) {
      return NextResponse.json(
        { success: false, error: "Comment ID is required" },
        { status: 400 }
      );
    }

    // Check access and ownership
    const existingComment = await prisma.patternComment.findFirst({
      where: {
        id: commentId,
        sessionId: id,
      },
      include: {
        session: true,
      },
    });

    if (!existingComment) {
      return NextResponse.json(
        { success: false, error: "Comment not found" },
        { status: 404 }
      );
    }

    // Only the author can edit content, but anyone with edit permission can resolve
    const canEdit = existingComment.userId === session.user.id;
    const canResolve =
      existingComment.session.createdById === session.user.id ||
      existingComment.userId === session.user.id;

    if (content && !canEdit) {
      return NextResponse.json(
        { success: false, error: "Only the author can edit this comment" },
        { status: 403 }
      );
    }

    if (resolved !== undefined && !canResolve) {
      return NextResponse.json(
        { success: false, error: "No permission to resolve this comment" },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (content) {
      updateData.content = content.trim();
      updateData.editedAt = new Date();
      updateData.editCount = { increment: 1 };
      if (!existingComment.originalContent) {
        updateData.originalContent = existingComment.content;
      }
    }

    if (resolved !== undefined) {
      updateData.resolved = resolved;
      updateData.resolvedAt = resolved ? new Date() : null;
      updateData.resolvedById = resolved ? session.user.id : null;
    }

    const updatedComment = await prisma.patternComment.update({
      where: { id: commentId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Broadcast real-time update
    await broadcastCommentUpdated(id, commentId);

    // Log events
    if (content) {
      await logCommentUpdated(id, session.user.id, commentId, {
        content: existingComment.content,
      }, {
        content: content.trim(),
      });
    }
    if (resolved !== undefined) {
      await logCommentResolved(id, session.user.id, commentId, resolved);
    }

    return NextResponse.json({
      success: true,
      data: updatedComment,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update comment" },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions/[id]/comments - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json(
        { success: false, error: "Comment ID is required" },
        { status: 400 }
      );
    }

    // Check ownership
    const existingComment = await prisma.patternComment.findFirst({
      where: {
        id: commentId,
        sessionId: id,
        userId: session.user.id, // Only author can delete
      },
    });

    if (!existingComment) {
      return NextResponse.json(
        { success: false, error: "Comment not found or no permission" },
        { status: 404 }
      );
    }

    await prisma.patternComment.delete({
      where: { id: commentId },
    });

    // Broadcast real-time update
    await broadcastCommentDeleted(id, commentId);

    // Log event
    await logCommentDeleted(id, session.user.id, commentId, existingComment.content);

    return NextResponse.json({
      success: true,
      message: "Comment deleted",
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
