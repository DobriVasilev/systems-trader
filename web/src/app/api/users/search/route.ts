import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/users/search - Search users for @mentions
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const sessionId = searchParams.get("sessionId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

  if (!query || query.length < 1) {
    return NextResponse.json({
      success: true,
      data: [],
    });
  }

  try {
    // Build search query
    const searchQuery = query.toLowerCase();

    // If sessionId is provided, only search users with access to that session
    let whereClause: object;

    if (sessionId) {
      // Find users who have access to this session
      whereClause = {
        AND: [
          {
            OR: [
              // Session owner
              { createdSessions: { some: { id: sessionId } } },
              // Shared with user
              { sharedSessions: { some: { sessionId } } },
            ],
          },
          {
            OR: [
              { name: { contains: searchQuery, mode: "insensitive" } },
              { username: { contains: searchQuery, mode: "insensitive" } },
              { email: { contains: searchQuery, mode: "insensitive" } },
            ],
          },
        ],
      };
    } else {
      // Search all users (limited results for privacy)
      whereClause = {
        OR: [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { username: { contains: searchQuery, mode: "insensitive" } },
        ],
      };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        username: true,
        email: sessionId ? true : false, // Only show email if within session context
        image: true,
        bio: true,
      },
      take: limit,
      orderBy: [
        // Prioritize exact username matches
        { username: "asc" },
        { name: "asc" },
      ],
    });

    // Sort results by relevance (exact matches first)
    const sortedUsers = users.sort((a, b) => {
      const aName = a.name?.toLowerCase() || "";
      const aUsername = a.username?.toLowerCase() || "";
      const bName = b.name?.toLowerCase() || "";
      const bUsername = b.username?.toLowerCase() || "";

      // Exact username match
      if (aUsername === searchQuery) return -1;
      if (bUsername === searchQuery) return 1;

      // Starts with query
      if (aUsername.startsWith(searchQuery)) return -1;
      if (bUsername.startsWith(searchQuery)) return 1;
      if (aName.startsWith(searchQuery)) return -1;
      if (bName.startsWith(searchQuery)) return 1;

      return 0;
    });

    return NextResponse.json({
      success: true,
      data: sortedUsers,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to search users" },
      { status: 500 }
    );
  }
}
