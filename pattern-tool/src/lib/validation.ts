import { z } from "zod";

// Session schemas
export const createSessionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  symbol: z.string().min(1).max(20),
  timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"]),
  patternType: z.string().min(1).max(50),
  candleData: z.record(z.string(), z.unknown()).optional(),
  description: z.string().max(1000).optional(),
});

export const updateSessionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  candleData: z.record(z.string(), z.unknown()).optional(),
});

// Detection schemas
export const createDetectionSchema = z.object({
  candleIndex: z.number().int().min(0),
  candleTime: z.string().datetime().or(z.number()),
  price: z.number().positive(),
  detectionType: z.string().min(1).max(50),
  structure: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateDetectionSchema = z.object({
  detectionId: z.string().min(1),
  status: z.enum(["pending", "confirmed", "rejected", "moved"]).optional(),
  price: z.number().positive().optional(),
  candleIndex: z.number().int().min(0).optional(),
  candleTime: z.string().datetime().or(z.number()).optional(),
});

// Correction schemas
export const createCorrectionSchema = z.object({
  detectionId: z.string().min(1).optional(),
  correctionType: z.enum(["move", "add", "remove", "reclassify"]),
  reason: z.string().min(1).max(500),
  originalPrice: z.number().positive().optional(),
  correctedPrice: z.number().positive().optional(),
  originalCandleIndex: z.number().int().min(0).optional(),
  correctedCandleIndex: z.number().int().min(0).optional(),
});

// Comment schemas
export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  detectionId: z.string().optional(),
  correctionId: z.string().optional(),
  parentId: z.string().optional(),
  candleTime: z.string().datetime().optional(),
  canvasX: z.number().optional(),
  canvasY: z.number().optional(),
});

export const updateCommentSchema = z.object({
  commentId: z.string().min(1),
  content: z.string().min(1).max(2000).optional(),
  resolved: z.boolean().optional(),
});

// Share schemas
export const createShareSchema = z.object({
  email: z.string().email(),
  permission: z.enum(["view", "comment", "edit", "admin"]).default("view"),
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
  interval: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"]).default("4h"),
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
