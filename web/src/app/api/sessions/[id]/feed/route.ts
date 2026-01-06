import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SortType, sortItems, wilsonScore, controversyScore } from "@/lib/sorting";

export interface FeedItem {
  type: "correction" | "comment";
  id: string;
  content: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  score: number;
  userVote: number | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    username: string | null;
  };
  // Correction-specific fields
  correctionType?: string;
  detectionId?: string | null;
  originalIndex?: number | null;
  originalTime?: string | null;
  originalPrice?: number | null;
  originalType?: string | null;
  correctedIndex?: number | null;
  correctedTime?: string | null;
  correctedPrice?: number | null;
  correctedType?: string | null;
  correctedStructure?: string | null;
  // Comment-specific fields
  detectionId2?: string | null;
  candleTime?: string | null;
  depth?: number;
  path?: string | null;
  parentId?: string | null;
  replyCount?: number;
  // Nested replies (for threaded display)
  replies?: FeedItem[];
}

// GET /api/sessions/[id]/feed - Get unified feed with corrections and comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id: sessionId } = await params;

  const { searchParams } = new URL(request.url);
  const sort = (searchParams.get("sort") || "new") as SortType;
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const cursor = searchParams.get("cursor");
  const includeReplies = searchParams.get("includeReplies") === "true";

  try {
    // Check access (anonymous can view public sessions)
    const patternSession = await prisma.patternSession.findFirst({
      where: {
        id: sessionId,
        OR: [
          { isPublic: true },
          ...(session?.user?.id
            ? [
                { createdById: session.user.id },
                { shares: { some: { userId: session.user.id } } },
              ]
            : []),
        ],
      },
    });

    if (!patternSession) {
      return NextResponse.json(
        { success: false, error: "Session not found or access denied" },
        { status: 404 }
      );
    }

    // Get user's votes if authenticated
    let userCommentVotes: Map<string, number> = new Map();
    let userCorrectionVotes: Map<string, number> = new Map();

    if (session?.user?.id) {
      const [commentVotes, correctionVotes] = await Promise.all([
        prisma.patternVote.findMany({
          where: {
            userId: session.user.id,
            comment: { sessionId },
          },
          select: { commentId: true, value: true },
        }),
        prisma.patternVote.findMany({
          where: {
            userId: session.user.id,
            correction: { sessionId },
          },
          select: { correctionId: true, value: true },
        }),
      ]);

      commentVotes.forEach((v) => {
        if (v.commentId) userCommentVotes.set(v.commentId, v.value);
      });
      correctionVotes.forEach((v) => {
        if (v.correctionId) userCorrectionVotes.set(v.correctionId, v.value);
      });
    }

    // Fetch corrections (these are "posts" in the feed)
    const corrections = await prisma.patternCorrection.findMany({
      where: { sessionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            username: true,
          },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch top-level comments (not replies to corrections, standalone comments)
    const topLevelComments = await prisma.patternComment.findMany({
      where: {
        sessionId,
        parentId: null,
        correctionId: null, // Not a reply to a correction
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            username: true,
          },
        },
        _count: {
          select: { replies: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map corrections to feed items
    const correctionItems: FeedItem[] = corrections.map((c) => ({
      type: "correction" as const,
      id: c.id,
      content: c.reason,
      createdAt: c.createdAt.toISOString(),
      upvotes: c.upvotes,
      downvotes: c.downvotes,
      score: c.score,
      userVote: userCorrectionVotes.get(c.id) ?? null,
      user: c.user,
      correctionType: c.correctionType,
      detectionId: c.detectionId,
      originalIndex: c.originalIndex,
      originalTime: c.originalTime?.toISOString() ?? null,
      originalPrice: c.originalPrice,
      originalType: c.originalType,
      correctedIndex: c.correctedIndex,
      correctedTime: c.correctedTime?.toISOString() ?? null,
      correctedPrice: c.correctedPrice,
      correctedType: c.correctedType,
      correctedStructure: c.correctedStructure,
      replyCount: c._count.comments,
    }));

    // Map comments to feed items
    const commentItems: FeedItem[] = topLevelComments.map((c) => ({
      type: "comment" as const,
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      upvotes: c.upvotes,
      downvotes: c.downvotes,
      score: c.score,
      userVote: userCommentVotes.get(c.id) ?? null,
      user: c.user,
      detectionId2: c.detectionId,
      candleTime: c.candleTime?.toISOString() ?? null,
      depth: c.depth,
      path: c.path,
      replyCount: c._count.replies,
    }));

    // Combine and sort
    let allItems = [...correctionItems, ...commentItems];

    // Apply sorting
    if (sort === "best") {
      allItems.sort((a, b) => {
        const aScore = wilsonScore(a.upvotes, a.downvotes);
        const bScore = wilsonScore(b.upvotes, b.downvotes);
        return bScore - aScore;
      });
    } else if (sort === "top") {
      allItems.sort((a, b) => b.score - a.score);
    } else if (sort === "controversial") {
      allItems.sort((a, b) => {
        const aScore = controversyScore(a.upvotes, a.downvotes);
        const bScore = controversyScore(b.upvotes, b.downvotes);
        return bScore - aScore;
      });
    } else {
      // Default: new
      allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Apply cursor pagination
    if (cursor) {
      const cursorIndex = allItems.findIndex((item) => item.id === cursor);
      if (cursorIndex !== -1) {
        allItems = allItems.slice(cursorIndex + 1);
      }
    }

    // Apply limit
    const hasMore = allItems.length > limit;
    const items = allItems.slice(0, limit);
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    // Optionally load replies for each item
    if (includeReplies) {
      for (const item of items) {
        if (item.type === "correction") {
          // Load comments on this correction
          const replies = await prisma.patternComment.findMany({
            where: {
              correctionId: item.id,
              parentId: null, // Top-level replies to the correction
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  username: true,
                },
              },
              _count: {
                select: { replies: true },
              },
            },
            orderBy: { createdAt: "asc" },
          });

          item.replies = replies.map((r) => ({
            type: "comment" as const,
            id: r.id,
            content: r.content,
            createdAt: r.createdAt.toISOString(),
            upvotes: r.upvotes,
            downvotes: r.downvotes,
            score: r.score,
            userVote: userCommentVotes.get(r.id) ?? null,
            user: r.user,
            depth: r.depth,
            path: r.path,
            parentId: r.parentId,
            replyCount: r._count.replies,
          }));
        } else if (item.type === "comment" && item.replyCount && item.replyCount > 0) {
          // Load replies to this comment
          const replies = await loadCommentReplies(item.id, userCommentVotes);
          item.replies = replies;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        items,
        nextCursor,
        hasMore,
        sort,
      },
    });
  } catch (error) {
    console.error("Error fetching feed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}

// Helper to recursively load comment replies
async function loadCommentReplies(
  parentId: string,
  userVotes: Map<string, number>,
  maxDepth: number = 5,
  currentDepth: number = 0
): Promise<FeedItem[]> {
  if (currentDepth >= maxDepth) return [];

  const replies = await prisma.patternComment.findMany({
    where: { parentId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          username: true,
        },
      },
      _count: {
        select: { replies: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const items: FeedItem[] = [];

  for (const reply of replies) {
    const item: FeedItem = {
      type: "comment",
      id: reply.id,
      content: reply.content,
      createdAt: reply.createdAt.toISOString(),
      upvotes: reply.upvotes,
      downvotes: reply.downvotes,
      score: reply.score,
      userVote: userVotes.get(reply.id) ?? null,
      user: reply.user,
      depth: reply.depth,
      path: reply.path,
      parentId: reply.parentId,
      replyCount: reply._count.replies,
    };

    // Recursively load nested replies
    if (reply._count.replies > 0) {
      item.replies = await loadCommentReplies(reply.id, userVotes, maxDepth, currentDepth + 1);
    }

    items.push(item);
  }

  return items;
}
