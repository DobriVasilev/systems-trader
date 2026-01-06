import { z } from "zod";

// Native Hyperliquid timeframes only (no aggregation, no bugs)
const VALID_TIMEFRAMES = [
  "1m", "5m", "15m", "30m",
  "1h", "4h",
  "1d", "1w", "1M"
] as const;

// Session schemas
export const createSessionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  symbol: z.string().min(1).max(20),
  timeframe: z.enum(VALID_TIMEFRAMES),
  patternType: z.string().min(1).max(50),
  patternSettings: z.record(z.string(), z.unknown()).optional(), // Pattern-specific settings
  candleData: z.record(z.string(), z.unknown()).optional(),
  description: z.string().max(1000).optional(),
});

export const updateSessionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  candleData: z.record(z.string(), z.unknown()).optional(),
});

// Detection type enum - matches DetectionType from types/patterns.ts
export const detectionTypeEnum = z.enum([
  "swing_high",
  "swing_low",
  "bos_bullish",
  "bos_bearish",
  "msb_bullish",
  "msb_bearish",
  "range_high",
  "range_low",
  "range_mid",
  "fib_level",
  "false_breakout_high",
  "false_breakout_low",
]);

// Structure type enum - matches StructureType from types/patterns.ts
export const structureTypeEnum = z.enum(["HH", "HL", "LH", "LL", "H", "L"]);

// Detection schemas
export const runDetectionSchema = z.object({
  action: z.literal("run_detection"),
});

export const addManualDetectionSchema = z.object({
  action: z.literal("add_manual"),
  candleIndex: z.number().int().min(0),
  candleTime: z.number().positive(),
  price: z.number().positive(),
  detectionType: detectionTypeEnum,
  structure: structureTypeEnum.optional(),
});

export const detectionActionSchema = z.discriminatedUnion("action", [
  runDetectionSchema,
  addManualDetectionSchema,
]);

// Correction schemas - matches actual API usage
export const createCorrectionSchema = z.object({
  detectionId: z.string().min(1).optional().nullable(),
  correctionType: z.enum(["move", "delete", "add", "confirm", "unconfirm"]),
  reason: z.string().max(1000).optional().default(""),
  // For move/delete corrections - original values
  originalIndex: z.number().int().min(0).optional().nullable(),
  originalTime: z.string().or(z.number()).optional().nullable(),
  originalPrice: z.number().positive().optional().nullable(),
  originalType: detectionTypeEnum.optional().nullable(),
  // For move/add corrections - corrected values
  correctedIndex: z.number().int().min(0).optional().nullable(),
  correctedTime: z.string().or(z.number()).optional().nullable(),
  correctedPrice: z.number().positive().optional().nullable(),
  correctedType: detectionTypeEnum.optional().nullable(),
  correctedStructure: structureTypeEnum.optional().nullable(),
});

// Comment schemas
export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  detectionId: z.string().optional().nullable(),
  correctionId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  candleTime: z.string().or(z.number()).optional().nullable(),
  canvasX: z.number().optional().nullable(),
  canvasY: z.number().optional().nullable(),
});

export const updateCommentSchema = z.object({
  commentId: z.string().min(1),
  content: z.string().min(1).max(2000).optional(),
  resolved: z.boolean().optional(),
});

// Share schemas - accepts either email or userId
export const createShareSchema = z.object({
  email: z.string().email().max(255).optional(),
  userId: z.string().cuid().optional(),
  permission: z.enum(["view", "comment", "edit", "admin"]).default("view"),
}).refine(data => data.email || data.userId, {
  message: "Either email or userId must be provided",
});

export const updatePublicSchema = z.object({
  isPublic: z.boolean(),
});

// File upload schema
export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^[a-zA-Z0-9]+\/[a-zA-Z0-9\-+.]+$/),
  size: z.number().int().min(1).max(10 * 1024 * 1024), // Max 10MB
});

// Candles API schema
export const candlesQuerySchema = z.object({
  symbol: z.string().min(1).max(20).default("BTC"),
  interval: z.enum(VALID_TIMEFRAMES).default("4h"),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

// Helper function to validate and parse
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
  };
}
