/**
 * Pattern Tool Type Definitions
 */

// ============================================================================
// ENUMS
// ============================================================================

export type PatternType =
  | "swings"
  | "bos"
  | "msb"
  | "range"
  | "false_breakout"
  | "fibonacci";

export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

export type DetectionType =
  // Swings
  | "swing_high"
  | "swing_low"
  // Structure breaks
  | "bos_bullish"
  | "bos_bearish"
  | "msb_bullish"
  | "msb_bearish"
  // Range
  | "range_high"
  | "range_low"
  | "range_mid"
  // Fibonacci
  | "fib_level"
  // False breakout
  | "false_breakout_high"
  | "false_breakout_low";

export type StructureType = "HH" | "HL" | "LH" | "LL";

export type DetectionStatus = "pending" | "confirmed" | "rejected" | "moved";

export type CorrectionType = "move" | "delete" | "add" | "confirm";

export type CorrectionStatus = "pending" | "applied" | "disputed";

export type SessionStatus = "in_progress" | "resolved" | "archived";

export type EventType =
  | "session_created"
  | "session_updated"
  | "session_archived"
  | "detection_added"
  | "detection_confirmed"
  | "detection_rejected"
  | "detection_moved"
  | "correction_created"
  | "correction_updated"
  | "correction_resolved"
  | "comment_created"
  | "comment_updated"
  | "comment_resolved"
  | "comment_deleted"
  | "share_added"
  | "share_removed";

// ============================================================================
// CANDLE DATA
// ============================================================================

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandleWithIndex extends Candle {
  index: number;
}

// ============================================================================
// DETECTION
// ============================================================================

export interface Detection {
  id: string;
  sessionId: string;
  candleIndex: number;
  candleTime: Date;
  price: number;
  detectionType: DetectionType;
  structure?: StructureType;
  confidence?: number;
  metadata?: Record<string, unknown>;
  canvasX?: number;
  canvasY?: number;
  status: DetectionStatus;
  createdAt: Date;
}

export interface DetectionCreate {
  candleIndex: number;
  candleTime: Date;
  price: number;
  detectionType: DetectionType;
  structure?: StructureType;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CORRECTION
// ============================================================================

export interface Attachment {
  id: string;
  url: string;
  type: "image" | "file";
  name: string;
  size: number;
}

export interface Correction {
  id: string;
  sessionId: string;
  detectionId?: string;
  userId: string;
  correctionType: CorrectionType;
  originalIndex?: number;
  originalTime?: Date;
  originalPrice?: number;
  originalType?: DetectionType;
  correctedIndex?: number;
  correctedTime?: Date;
  correctedPrice?: number;
  correctedType?: DetectionType;
  correctedStructure?: StructureType;
  reason: string;
  attachments?: Attachment[];
  status: CorrectionStatus;
  resolvedAt?: Date;
  resolvedById?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CorrectionCreate {
  detectionId?: string;
  correctionType: CorrectionType;
  originalIndex?: number;
  originalTime?: Date;
  originalPrice?: number;
  originalType?: DetectionType;
  correctedIndex?: number;
  correctedTime?: Date;
  correctedPrice?: number;
  correctedType?: DetectionType;
  correctedStructure?: StructureType;
  reason: string;
  attachments?: Attachment[];
}

// ============================================================================
// COMMENT
// ============================================================================

export interface Comment {
  id: string;
  sessionId: string;
  userId: string;
  detectionId?: string;
  correctionId?: string;
  parentId?: string;
  content: string;
  attachments?: Attachment[];
  canvasX?: number;
  canvasY?: number;
  candleTime?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedById?: string;
  editedAt?: Date;
  editCount: number;
  originalContent?: string;
  createdAt: Date;
  updatedAt: Date;
  // Populated
  replies?: Comment[];
  user?: {
    id: string;
    name?: string;
    image?: string;
  };
}

export interface CommentCreate {
  detectionId?: string;
  correctionId?: string;
  parentId?: string;
  content: string;
  attachments?: Attachment[];
  canvasX?: number;
  canvasY?: number;
  candleTime?: Date;
}

// ============================================================================
// SESSION
// ============================================================================

export interface PatternSessionSummary {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  patternType: PatternType;
  status: SessionStatus;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  detectionCount: number;
  correctionCount: number;
  commentCount: number;
  createdBy: {
    id: string;
    name?: string;
    image?: string;
  };
}

export interface PatternSessionFull extends PatternSessionSummary {
  startTime: Date;
  endTime: Date;
  patternVersion: string;
  candleData?: Candle[];
  description?: string;
  isPublic: boolean;
  detections: Detection[];
  corrections: Correction[];
  comments: Comment[];
}

export interface PatternSessionCreate {
  symbol: string;
  timeframe: Timeframe;
  startTime: Date;
  endTime: Date;
  patternType: PatternType;
  patternVersion: string;
  candleData?: Candle[];
  title?: string;
  description?: string;
}

// ============================================================================
// EVENT (Audit Trail)
// ============================================================================

export interface PatternEventPayload {
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PatternEvent {
  id: string;
  sessionId: string;
  userId: string;
  eventType: EventType;
  entityType?: "session" | "detection" | "correction" | "comment";
  entityId?: string;
  payload: PatternEventPayload;
  canvasSnapshot?: unknown;
  createdAt: Date;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// EXPORT FORMAT (for Claude)
// ============================================================================

export interface ExportSession {
  session: {
    id: string;
    symbol: string;
    timeframe: Timeframe;
    patternType: PatternType;
    patternVersion: string;
    startTime: string;
    endTime: string;
  };
  corrections: Array<{
    id: string;
    type: CorrectionType;
    detection?: {
      id: string;
      type: DetectionType;
      candleTime: string;
      price: number;
      structure?: StructureType;
    };
    correctedTo?: {
      candleTime: string;
      price: number;
      type?: DetectionType;
      structure?: StructureType;
    };
    reason: string;
    author: string;
    createdAt: string;
  }>;
  comments: Array<{
    id: string;
    detectionId?: string;
    correctionId?: string;
    content: string;
    author: string;
    createdAt: string;
  }>;
}
