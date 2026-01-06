import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateVoteAggregate } from "@/lib/sorting";
import { broadcastVoteChanged } from "@/lib/realtime";

// POST /api/sessions/[id]/comments/[commentId]/vote - Vote on a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await auth();
  const { id: sessionId, commentId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { value } = body;

    // Validate vote value
    if (value !== 1 && value !== -1 && value !== 0) {
      return NextResponse.json(
        { success: false, error: "Vote value must be 1, -1, or 0" },
        { status: 400 }
      );
    }

    // Verify user has access to the session
    const comment = await prisma.patternComment.findFirst({
      where: {
        id: commentId,
        sessionId,
        session: {
          OR: [
            { createdById: session.user.id },
            { isPublic: true },
            { shares: { some: { userId: session.user.id } } },
          ],
        },
      },
      select: {
        id: true,
        upvotes: true,
        downvotes: true,
        score: true,
      },
    });

    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Comment not found or access denied" },
        { status: 404 }
      );
    }

    // Get existing vote
    const existingVote = await prisma.patternVote.findUnique({
      where: {
        userId_commentId: {
          userId: session.user.id,
          commentId,
        },
      },
    });

    const oldValue = existingVote?.value ?? null;

    // Calculate new aggregates
    const newAggregates = updateVoteAggregate(
      {
        upvotes: comment.upvotes,
        downvotes: comment.downvotes,
        score: comment.score,
      },
      oldValue,
      value === 0 ? null : value
    );

    // Use transaction to ensure consistency
    if (value === 0) {
      // Remove vote
      if (existingVote) {
        await prisma.$transaction([
          prisma.patternVote.delete({
            where: { id: existingVote.id },
          }),
          prisma.patternComment.update({
            where: { id: commentId },
            data: newAggregates,
          }),
        ]);
      }
    } else if (existingVote) {
      // Update existing vote
      if (existingVote.value !== value) {
        await prisma.$transaction([
          prisma.patternVote.update({
            where: { id: existingVote.id },
            data: { value },
          }),
          prisma.patternComment.update({
            where: { id: commentId },
            data: newAggregates,
          }),
        ]);
      }
    } else {
      // Create new vote
      await prisma.$transaction([
        prisma.patternVote.create({
          data: {
            userId: session.user.id,
            commentId,
            value,
          },
        }),
        prisma.patternComment.update({
          where: { id: commentId },
          data: newAggregates,
        }),
      ]);
    }

    // Broadcast real-time update
    await broadcastVoteChanged(
      sessionId,
      "comment",
      commentId,
      newAggregates.upvotes,
      newAggregates.downvotes,
      newAggregates.score
    );

    return NextResponse.json({
      success: true,
      data: {
        commentId,
        userVote: value === 0 ? null : value,
        ...newAggregates,
      },
    });
  } catch (error) {
    console.error("Error voting on comment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to vote on comment" },
      { status: 500 }
    );
  }
}

// GET /api/sessions/[id]/comments/[commentId]/vote - Get user's vote on a comment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await auth();
  const { id: sessionId, commentId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Verify access
    const comment = await prisma.patternComment.findFirst({
      where: {
        id: commentId,
        sessionId,
        session: {
          OR: [
            { createdById: session.user.id },
            { isPublic: true },
            { shares: { some: { userId: session.user.id } } },
          ],
        },
      },
      select: {
        id: true,
        upvotes: true,
        downvotes: true,
        score: true,
      },
    });

    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Comment not found or access denied" },
        { status: 404 }
      );
    }

    const vote = await prisma.patternVote.findUnique({
      where: {
        userId_commentId: {
          userId: session.user.id,
          commentId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        commentId,
        userVote: vote?.value ?? null,
        upvotes: comment.upvotes,
        downvotes: comment.downvotes,
        score: comment.score,
      },
    });
  } catch (error) {
    console.error("Error getting vote:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get vote" },
      { status: 500 }
    );
  }
}
