import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateUlid } from "@/lib/ulid";
import { broadcastDetectionsBatch, broadcastDetectionCreated } from "@/lib/realtime";
import { logDetectionBatchCreated, logDetectionCreated } from "@/lib/events";

// GET /api/sessions/[id]/detections - Get all detections for a session
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

    const detections = await prisma.patternDetection.findMany({
      where: { sessionId: id },
      orderBy: { candleTime: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: detections,
    });
  } catch (error) {
    console.error("Error fetching detections:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch detections" },
      { status: 500 }
    );
  }
}

// POST /api/sessions/[id]/detections - Run detection or add manual detection
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
    const { action } = body;

    // Check access with edit permission
    const patternSession = await prisma.patternSession.findFirst({
      where: {
        id,
        OR: [
          { createdById: session.user.id },
          { shares: { some: { userId: session.user.id, permission: { in: ["edit", "admin"] } } } },
        ],
      },
    });

    if (!patternSession) {
      return NextResponse.json(
        { success: false, error: "Session not found or no permission" },
        { status: 404 }
      );
    }

    if (action === "run_detection") {
      // Run pattern detection on the candle data
      const candleData = patternSession.candleData as { candles?: Array<{ time: number; open: number; high: number; low: number; close: number }> };
      const candles = candleData?.candles || [];

      if (candles.length === 0) {
        return NextResponse.json(
          { success: false, error: "No candle data in session" },
          { status: 400 }
        );
      }

      // Get detection settings from session's patternSettings (fallback to user prefs, then default)
      const sessionSettings = patternSession.patternSettings as { detection_mode?: "wicks" | "closes" } | null;
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { preferences: true },
      });
      const userPrefs = user?.preferences as { swingDetectionMode?: "wicks" | "closes" } | null;

      // Priority: session settings > user preferences > default
      const detectionMode = sessionSettings?.detection_mode || userPrefs?.swingDetectionMode || "wicks";
      const detectionOptions: DetectionOptions = {
        mode: detectionMode,
      };

      // Clear existing detections for this session
      await prisma.patternDetection.deleteMany({
        where: { sessionId: id },
      });

      // Run detection based on pattern type
      let detections: Array<{
        candleIndex: number;
        candleTime: Date;
        price: number;
        detectionType: string;
        structure?: string;
        confidence?: number;
        metadata?: Record<string, unknown>;
      }> = [];

      switch (patternSession.patternType) {
        case "swings":
          detections = detectSwings(candles, detectionOptions);
          break;
        case "bos":
          detections = detectBOS(candles, detectionOptions);
          break;
        case "msb":
          detections = detectMSB(candles, detectionOptions);
          break;
        default:
          detections = detectSwings(candles, detectionOptions); // Default to swings
      }

      // Store detections in database with detection mode in metadata
      const createdDetections = await prisma.patternDetection.createMany({
        data: detections.map((d) => ({
          id: generateUlid(),
          sessionId: id,
          candleIndex: d.candleIndex,
          candleTime: d.candleTime,
          price: d.price,
          detectionType: d.detectionType,
          structure: d.structure || null,
          confidence: d.confidence || null,
          metadata: JSON.parse(JSON.stringify({
            ...d.metadata,
            detection_mode: detectionMode, // Store whether this was a wick or close detection
          })),
          status: "pending",
        })),
      });

      // Fetch and return the created detections
      const allDetections = await prisma.patternDetection.findMany({
        where: { sessionId: id },
        orderBy: { candleTime: "asc" },
      });

      // Broadcast real-time update
      await broadcastDetectionsBatch(id, createdDetections.count);

      // Log event
      await logDetectionBatchCreated(
        id,
        session.user.id,
        createdDetections.count,
        patternSession.patternType
      );

      return NextResponse.json({
        success: true,
        data: {
          count: createdDetections.count,
          detections: allDetections,
        },
      });
    } else if (action === "add_manual") {
      // Add a manual detection
      const { candleIndex, candleTime, price, detectionType, structure } = body;

      const detection = await prisma.patternDetection.create({
        data: {
          id: generateUlid(),
          sessionId: id,
          candleIndex,
          candleTime: new Date(candleTime * 1000),
          price,
          detectionType,
          structure,
          status: "pending",
          metadata: { source: "manual", userId: session.user.id },
        },
      });

      // Broadcast real-time update
      await broadcastDetectionCreated(id, detection.id);

      // Log event
      await logDetectionCreated(id, session.user.id, detection.id, {
        candleIndex,
        candleTime,
        price,
        detectionType,
        structure,
        source: "manual",
      });

      return NextResponse.json({
        success: true,
        data: detection,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in detections:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process detection" },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATTERN DETECTION ALGORITHMS
// ============================================================================

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Detection {
  candleIndex: number;
  candleTime: Date;
  price: number;
  detectionType: string;
  structure?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

// Detection mode: "wicks" uses high/low, "closes" uses close price only
type SwingDetectionMode = "wicks" | "closes";

interface DetectionOptions {
  mode: SwingDetectionMode;
}

/**
 * Detect swing highs and lows using break-confirmation logic
 * A swing is only confirmed when something BREAKS it:
 * - Swing LOW confirmed when price breaks ABOVE previous swing high
 * - Swing HIGH confirmed when price breaks BELOW previous swing low
 *
 * @param candles - Array of candle data
 * @param options - Detection options (mode: "wicks" uses high/low, "closes" uses close only)
 */
function detectSwings(candles: Candle[], options: DetectionOptions = { mode: "wicks" }): Detection[] {
  if (candles.length < 5) return [];

  const detections: Detection[] = [];
  const lookback = 3; // Number of candles to look back/forward for pivot
  const useWicks = options.mode === "wicks";

  // Helper to get the "high" price based on mode
  const getHigh = (c: Candle) => useWicks ? c.high : c.close;
  // Helper to get the "low" price based on mode
  const getLow = (c: Candle) => useWicks ? c.low : c.close;

  // Find potential pivots first
  const pivots: Array<{
    index: number;
    type: "high" | "low";
    price: number;
    time: number;
  }> = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    const currentHigh = getHigh(current);
    const currentLow = getLow(current);

    // Check for swing high
    let isSwingHigh = true;
    for (let j = 1; j <= lookback; j++) {
      if (getHigh(candles[i - j]) >= currentHigh || getHigh(candles[i + j]) >= currentHigh) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) {
      pivots.push({ index: i, type: "high", price: currentHigh, time: current.time });
    }

    // Check for swing low
    let isSwingLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (getLow(candles[i - j]) <= currentLow || getLow(candles[i + j]) <= currentLow) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow) {
      pivots.push({ index: i, type: "low", price: currentLow, time: current.time });
    }
  }

  // Sort pivots by index
  pivots.sort((a, b) => a.index - b.index);

  // Confirm swings using break logic
  let lastConfirmedHigh: typeof pivots[0] | null = null;
  let lastConfirmedLow: typeof pivots[0] | null = null;
  let pendingHigh: typeof pivots[0] | null = null;
  let pendingLow: typeof pivots[0] | null = null;

  for (let i = 0; i < pivots.length; i++) {
    const pivot = pivots[i];

    if (pivot.type === "high") {
      // Check if this breaks a pending low (confirms the low)
      if (pendingLow && pivot.price > (lastConfirmedHigh?.price || 0)) {
        // Low is confirmed
        const structure = lastConfirmedLow
          ? pendingLow.price > lastConfirmedLow.price
            ? "HL"
            : "LL"
          : "L";

        detections.push({
          candleIndex: pendingLow.index,
          candleTime: new Date(pendingLow.time * 1000),
          price: pendingLow.price,
          detectionType: "swing_low",
          structure,
          confidence: 0.8,
          metadata: { confirmedAt: pivot.index, confirmedByPrice: pivot.price },
        });

        lastConfirmedLow = pendingLow;
        pendingLow = null;
      }

      // Set as pending high
      if (!pendingHigh || pivot.price > pendingHigh.price) {
        pendingHigh = pivot;
      }
    } else {
      // Low pivot
      // Check if this breaks a pending high (confirms the high)
      if (pendingHigh && pivot.price < (lastConfirmedLow?.price || Infinity)) {
        // High is confirmed
        const structure = lastConfirmedHigh
          ? pendingHigh.price > lastConfirmedHigh.price
            ? "HH"
            : "LH"
          : "H";

        detections.push({
          candleIndex: pendingHigh.index,
          candleTime: new Date(pendingHigh.time * 1000),
          price: pendingHigh.price,
          detectionType: "swing_high",
          structure,
          confidence: 0.8,
          metadata: { confirmedAt: pivot.index, confirmedByPrice: pivot.price },
        });

        lastConfirmedHigh = pendingHigh;
        pendingHigh = null;
      }

      // Set as pending low
      if (!pendingLow || pivot.price < pendingLow.price) {
        pendingLow = pivot;
      }
    }
  }

  // Sort by candle time
  detections.sort((a, b) => a.candleTime.getTime() - b.candleTime.getTime());

  return detections;
}

/**
 * Detect Break of Structure (BOS)
 * BOS occurs when price breaks a significant swing level in the direction of the trend
 */
function detectBOS(candles: Candle[], options: DetectionOptions = { mode: "wicks" }): Detection[] {
  const swings = detectSwings(candles, options);
  const detections: Detection[] = [];

  for (let i = 1; i < swings.length; i++) {
    const current = swings[i];
    const prev = swings[i - 1];

    // BOS bullish: HH after HL
    if (current.structure === "HH" && prev.structure === "HL") {
      detections.push({
        candleIndex: current.candleIndex,
        candleTime: current.candleTime,
        price: current.price,
        detectionType: "bos_bullish",
        confidence: 0.7,
        metadata: { swingType: current.detectionType, structure: current.structure },
      });
    }

    // BOS bearish: LL after LH
    if (current.structure === "LL" && prev.structure === "LH") {
      detections.push({
        candleIndex: current.candleIndex,
        candleTime: current.candleTime,
        price: current.price,
        detectionType: "bos_bearish",
        confidence: 0.7,
        metadata: { swingType: current.detectionType, structure: current.structure },
      });
    }
  }

  return detections;
}

/**
 * Detect Market Structure Break (MSB)
 * MSB occurs when price breaks a swing level against the current trend
 */
function detectMSB(candles: Candle[], options: DetectionOptions = { mode: "wicks" }): Detection[] {
  const swings = detectSwings(candles, options);
  const detections: Detection[] = [];

  for (let i = 1; i < swings.length; i++) {
    const current = swings[i];
    const prev = swings[i - 1];

    // MSB bullish: HL after LL (trend reversal from bearish to bullish)
    if (current.structure === "HL" && prev.structure === "LL") {
      detections.push({
        candleIndex: current.candleIndex,
        candleTime: current.candleTime,
        price: current.price,
        detectionType: "msb_bullish",
        confidence: 0.75,
        metadata: { swingType: current.detectionType, structure: current.structure },
      });
    }

    // MSB bearish: LH after HH (trend reversal from bullish to bearish)
    if (current.structure === "LH" && prev.structure === "HH") {
      detections.push({
        candleIndex: current.candleIndex,
        candleTime: current.candleTime,
        price: current.price,
        detectionType: "msb_bearish",
        confidence: 0.75,
        metadata: { swingType: current.detectionType, structure: current.structure },
      });
    }
  }

  return detections;
}
