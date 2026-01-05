import { ulid, decodeTime } from "ulid";

/**
 * Generate a new ULID.
 * ULIDs are:
 * - Universally unique
 * - Lexicographically sortable
 * - Case insensitive
 * - URL safe
 * - Encode timestamp (first 10 chars)
 */
export function generateUlid(): string {
  return ulid();
}

/**
 * Generate a ULID with a specific timestamp.
 * Useful for testing or historical data.
 */
export function generateUlidAt(timestamp: Date | number): string {
  const time = typeof timestamp === "number" ? timestamp : timestamp.getTime();
  return ulid(time);
}

/**
 * Extract timestamp from a ULID.
 */
export function getUlidTimestamp(id: string): Date {
  return new Date(decodeTime(id));
}

/**
 * Check if a string is a valid ULID format.
 */
export function isValidUlid(id: string): boolean {
  // ULIDs are 26 characters, Crockford Base32
  const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
  return ulidRegex.test(id);
}

/**
 * Generate multiple ULIDs at once.
 * Useful for batch operations.
 */
export function generateUlids(count: number): string[] {
  return Array.from({ length: count }, () => ulid());
}
