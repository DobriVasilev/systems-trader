/**
 * Reddit-style sorting algorithms for comments and feed items
 */

export type SortType = "best" | "top" | "new" | "controversial";

/**
 * Wilson score confidence interval for Reddit's "Best" algorithm
 *
 * This gives a lower bound of the confidence interval for the true
 * upvote ratio. It accounts for both the ratio and sample size.
 *
 * @param upvotes - Number of upvotes
 * @param downvotes - Number of downvotes
 * @returns A score between 0 and 1 (higher is better)
 */
export function wilsonScore(upvotes: number, downvotes: number): number {
  const n = upvotes + downvotes;
  if (n === 0) return 0;

  const z = 1.96; // 95% confidence interval
  const p = upvotes / n;

  // Wilson score lower bound formula
  const numerator = p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  const denominator = 1 + (z * z) / n;

  return numerator / denominator;
}

/**
 * Controversy score for Reddit's "Controversial" sort
 *
 * High scores indicate items with both high engagement AND
 * close to 50/50 split in votes. This surfaces divisive content.
 *
 * @param upvotes - Number of upvotes
 * @param downvotes - Number of downvotes
 * @returns A controversy score (higher = more controversial)
 */
export function controversyScore(upvotes: number, downvotes: number): number {
  // Need both upvotes and downvotes to be controversial
  if (upvotes <= 0 || downvotes <= 0) return 0;

  const magnitude = upvotes + downvotes;
  const balance = Math.min(upvotes, downvotes) / Math.max(upvotes, downvotes);

  // Multiply total votes by how balanced they are (0-1)
  // Perfect balance (50/50) gives maximum controversy for that vote count
  return magnitude * balance;
}

/**
 * Reddit's "Hot" algorithm (optional, for time-decay ranking)
 *
 * This ranks items higher based on recency and net votes.
 * Useful for feeds where you want recent popular items to surface.
 *
 * @param upvotes - Number of upvotes
 * @param downvotes - Number of downvotes
 * @param createdAt - When the item was created
 * @returns A hot score (higher = hotter)
 */
export function hotScore(upvotes: number, downvotes: number, createdAt: Date): number {
  const score = upvotes - downvotes;
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;

  // Epoch in seconds (Reddit uses Unix epoch from December 8, 2005)
  // We use a more recent epoch for our data
  const epochSeconds = new Date("2024-01-01").getTime() / 1000;
  const seconds = createdAt.getTime() / 1000 - epochSeconds;

  return sign * order + seconds / 45000;
}

/**
 * Sort items by the specified sort type
 */
export interface SortableItem {
  upvotes: number;
  downvotes: number;
  score: number;
  createdAt: Date | string;
}

/**
 * Get the sort value for an item based on sort type
 */
export function getSortValue(item: SortableItem, sortType: SortType): number {
  const createdAt = typeof item.createdAt === "string" ? new Date(item.createdAt) : item.createdAt;

  switch (sortType) {
    case "best":
      return wilsonScore(item.upvotes, item.downvotes);
    case "top":
      return item.score; // Simple net score (upvotes - downvotes)
    case "new":
      return createdAt.getTime();
    case "controversial":
      return controversyScore(item.upvotes, item.downvotes);
    default:
      return createdAt.getTime();
  }
}

/**
 * Sort an array of items by the specified sort type
 */
export function sortItems<T extends SortableItem>(items: T[], sortType: SortType): T[] {
  return [...items].sort((a, b) => {
    const aValue = getSortValue(a, sortType);
    const bValue = getSortValue(b, sortType);
    // Higher values first (descending)
    return bValue - aValue;
  });
}

/**
 * Build ORDER BY clause for Prisma based on sort type
 */
export function getPrismaOrderBy(sortType: SortType): object {
  switch (sortType) {
    case "best":
      // For "best", we need to use Wilson score which requires computation
      // Fall back to score for DB queries, then re-sort in memory
      return { score: "desc" };
    case "top":
      return { score: "desc" };
    case "new":
      return { createdAt: "desc" };
    case "controversial":
      // Similar to best, controversial requires computation
      // Pre-sort by engagement (total votes), then compute in memory
      return { createdAt: "desc" };
    default:
      return { createdAt: "desc" };
  }
}

/**
 * Aggregate vote counts to update denormalized fields
 */
export interface VoteAggregate {
  upvotes: number;
  downvotes: number;
  score: number;
}

export function calculateVoteAggregate(votes: Array<{ value: number }>): VoteAggregate {
  let upvotes = 0;
  let downvotes = 0;

  for (const vote of votes) {
    if (vote.value === 1) {
      upvotes++;
    } else if (vote.value === -1) {
      downvotes++;
    }
  }

  return {
    upvotes,
    downvotes,
    score: upvotes - downvotes,
  };
}

/**
 * Calculate new vote aggregates after a vote change
 */
export function updateVoteAggregate(
  current: VoteAggregate,
  oldValue: number | null, // null if new vote
  newValue: number | null  // null if removing vote
): VoteAggregate {
  let { upvotes, downvotes } = current;

  // Remove old vote effect
  if (oldValue === 1) {
    upvotes--;
  } else if (oldValue === -1) {
    downvotes--;
  }

  // Add new vote effect
  if (newValue === 1) {
    upvotes++;
  } else if (newValue === -1) {
    downvotes++;
  }

  return {
    upvotes,
    downvotes,
    score: upvotes - downvotes,
  };
}
