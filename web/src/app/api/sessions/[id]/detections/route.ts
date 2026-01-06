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

// Helper to format candle for reasoning
function formatCandle(c: Candle, index: number): string {
  const date = new Date(c.time * 1000);
  const dateStr = date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const direction = c.close >= c.open ? 'GREEN (bullish)' : 'RED (bearish)';
  const body = Math.abs(c.close - c.open).toFixed(2);
  const upperWick = (c.high - Math.max(c.open, c.close)).toFixed(2);
  const lowerWick = (Math.min(c.open, c.close) - c.low).toFixed(2);

  return `Candle #${index} at ${dateStr}:
    Open: $${c.open.toFixed(2)} → Close: $${c.close.toFixed(2)} (${direction})
    High: $${c.high.toFixed(2)} | Low: $${c.low.toFixed(2)}
    Body: $${body} | Upper Wick: $${upperWick} | Lower Wick: $${lowerWick}`;
}

// Get pattern documentation
function getSwingPatternDocumentation(mode: SwingDetectionMode): string {
  return `
════════════════════════════════════════════════════════════════════════════════
                        SWING DETECTION ALGORITHM v1.0
════════════════════════════════════════════════════════════════════════════════

OVERVIEW:
---------
This algorithm detects swing highs and swing lows using a two-phase approach:
1. PIVOT DETECTION: Find potential swing points by comparing with surrounding candles
2. CONFIRMATION: Confirm swings only when price "breaks" a significant level

CURRENT SETTINGS:
-----------------
• Detection Mode: ${mode === 'wicks' ? 'WICKS (using High/Low prices)' : 'CLOSES (using Close prices only)'}
• Lookback Period: 3 candles before and after

═══════════════════════════════════════════════════════════════════════════════
PHASE 1: PIVOT DETECTION
═══════════════════════════════════════════════════════════════════════════════

For each candle (except the first 3 and last 3), we check if it's a pivot:

SWING HIGH PIVOT:
  A candle is a potential swing high if its ${mode === 'wicks' ? 'HIGH' : 'CLOSE'} price is HIGHER than
  the ${mode === 'wicks' ? 'HIGH' : 'CLOSE'} of all 3 candles before AND all 3 candles after.

  Visual:
       [HIGH]    ← This candle's high must be the highest
      /      \\
     /        \\
  [lower]   [lower]  ← All surrounding candles must have lower highs

SWING LOW PIVOT:
  A candle is a potential swing low if its ${mode === 'wicks' ? 'LOW' : 'CLOSE'} price is LOWER than
  the ${mode === 'wicks' ? 'LOW' : 'CLOSE'} of all 3 candles before AND all 3 candles after.

  Visual:
  [higher]   [higher]  ← All surrounding candles must have higher lows
     \\        /
      \\      /
       [LOW]    ← This candle's low must be the lowest

═══════════════════════════════════════════════════════════════════════════════
PHASE 2: CONFIRMATION (Break Logic)
═══════════════════════════════════════════════════════════════════════════════

Pivots are NOT automatically confirmed. They become confirmed swings only when:

SWING LOW CONFIRMED:
  When a later SWING HIGH pivot has a price ABOVE the last confirmed high.
  This indicates that price made a higher high, confirming the low between them.

  Logic: If price goes UP past the previous high, the low before it is confirmed.

SWING HIGH CONFIRMED:
  When a later SWING LOW pivot has a price BELOW the last confirmed low.
  This indicates that price made a lower low, confirming the high between them.

  Logic: If price goes DOWN past the previous low, the high before it is confirmed.

═══════════════════════════════════════════════════════════════════════════════
STRUCTURE LABELS
═══════════════════════════════════════════════════════════════════════════════

Each confirmed swing gets a structure label based on comparison with previous:

• HH (Higher High): Current swing high > Previous swing high → Bullish
• LH (Lower High): Current swing high < Previous swing high → Bearish
• HL (Higher Low): Current swing low > Previous swing low → Bullish
• LL (Lower Low): Current swing low < Previous swing low → Bearish
• H/L: First swing of its type (no previous to compare)

═══════════════════════════════════════════════════════════════════════════════
LIMITATIONS & KNOWN ISSUES
═══════════════════════════════════════════════════════════════════════════════

1. The 3-candle lookback is fixed. Very sharp V-shaped reversals with less than
   3 candles on each side may be missed.

2. Confirmation logic may delay detection. A swing is only confirmed when the
   NEXT swing in the opposite direction meets the break criteria.

3. Ranging/choppy markets may produce fewer detections because the break
   conditions are not met.

4. Very recent swings (last few candles) may not be confirmed yet because
   there hasn't been a break to confirm them.

════════════════════════════════════════════════════════════════════════════════
`;
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
  const priceType = useWicks ? "HIGH" : "CLOSE";
  const priceTypeLow = useWicks ? "LOW" : "CLOSE";

  // Find potential pivots first with detailed reasoning
  const pivots: Array<{
    index: number;
    type: "high" | "low";
    price: number;
    time: number;
    pivotReasoning: string;
  }> = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    const currentHigh = getHigh(current);
    const currentLow = getLow(current);

    // Check for swing high with detailed reasoning
    let isSwingHigh = true;
    let swingHighReasoning = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PIVOT ANALYSIS: Checking if candle #${i} is a SWING HIGH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT CANDLE:
${formatCandle(current, i)}

Price being compared: $${currentHigh.toFixed(2)} (${priceType})

COMPARISON WITH SURROUNDING CANDLES:
`;

    // Check candles before
    swingHighReasoning += `\nLooking BACK (${lookback} candles before):\n`;
    for (let j = 1; j <= lookback; j++) {
      const compareCandle = candles[i - j];
      const compareHigh = getHigh(compareCandle);
      const comparison = currentHigh > compareHigh ? '>' : '≤';
      const result = currentHigh > compareHigh ? '✓ PASS' : '✗ FAIL';
      swingHighReasoning += `  • Candle #${i - j}: ${priceType}=$${compareHigh.toFixed(2)} → $${currentHigh.toFixed(2)} ${comparison} $${compareHigh.toFixed(2)} → ${result}\n`;

      if (compareHigh >= currentHigh) {
        isSwingHigh = false;
      }
    }

    // Check candles after (only if still passing)
    swingHighReasoning += `\nLooking AHEAD (${lookback} candles after):\n`;
    for (let j = 1; j <= lookback; j++) {
      const compareCandle = candles[i + j];
      const compareHigh = getHigh(compareCandle);
      const comparison = currentHigh > compareHigh ? '>' : '≤';
      const result = currentHigh > compareHigh ? '✓ PASS' : '✗ FAIL';
      swingHighReasoning += `  • Candle #${i + j}: ${priceType}=$${compareHigh.toFixed(2)} → $${currentHigh.toFixed(2)} ${comparison} $${compareHigh.toFixed(2)} → ${result}\n`;

      if (compareHigh >= currentHigh) {
        isSwingHigh = false;
      }
    }

    if (isSwingHigh) {
      swingHighReasoning += `\n▶ RESULT: SWING HIGH PIVOT DETECTED at $${currentHigh.toFixed(2)}
   All ${lookback} candles before have lower ${priceType.toLowerCase()}s
   All ${lookback} candles after have lower ${priceType.toLowerCase()}s\n`;
      pivots.push({ index: i, type: "high", price: currentHigh, time: current.time, pivotReasoning: swingHighReasoning });
    }

    // Check for swing low with detailed reasoning
    let isSwingLow = true;
    let swingLowReasoning = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PIVOT ANALYSIS: Checking if candle #${i} is a SWING LOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT CANDLE:
${formatCandle(current, i)}

Price being compared: $${currentLow.toFixed(2)} (${priceTypeLow})

COMPARISON WITH SURROUNDING CANDLES:
`;

    // Check candles before
    swingLowReasoning += `\nLooking BACK (${lookback} candles before):\n`;
    for (let j = 1; j <= lookback; j++) {
      const compareCandle = candles[i - j];
      const compareLow = getLow(compareCandle);
      const comparison = currentLow < compareLow ? '<' : '≥';
      const result = currentLow < compareLow ? '✓ PASS' : '✗ FAIL';
      swingLowReasoning += `  • Candle #${i - j}: ${priceTypeLow}=$${compareLow.toFixed(2)} → $${currentLow.toFixed(2)} ${comparison} $${compareLow.toFixed(2)} → ${result}\n`;

      if (compareLow <= currentLow) {
        isSwingLow = false;
      }
    }

    // Check candles after
    swingLowReasoning += `\nLooking AHEAD (${lookback} candles after):\n`;
    for (let j = 1; j <= lookback; j++) {
      const compareCandle = candles[i + j];
      const compareLow = getLow(compareCandle);
      const comparison = currentLow < compareLow ? '<' : '≥';
      const result = currentLow < compareLow ? '✓ PASS' : '✗ FAIL';
      swingLowReasoning += `  • Candle #${i + j}: ${priceTypeLow}=$${compareLow.toFixed(2)} → $${currentLow.toFixed(2)} ${comparison} $${compareLow.toFixed(2)} → ${result}\n`;

      if (compareLow <= currentLow) {
        isSwingLow = false;
      }
    }

    if (isSwingLow) {
      swingLowReasoning += `\n▶ RESULT: SWING LOW PIVOT DETECTED at $${currentLow.toFixed(2)}
   All ${lookback} candles before have higher ${priceTypeLow.toLowerCase()}s
   All ${lookback} candles after have higher ${priceTypeLow.toLowerCase()}s\n`;
      pivots.push({ index: i, type: "low", price: currentLow, time: current.time, pivotReasoning: swingLowReasoning });
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

        // Build confirmation reasoning
        let confirmationReasoning = `
═══════════════════════════════════════════════════════════════════════════════
CONFIRMATION: SWING LOW at candle #${pendingLow.index} is now CONFIRMED
═══════════════════════════════════════════════════════════════════════════════

CONFIRMATION TRIGGER:
  A swing HIGH pivot at candle #${pivot.index} with price $${pivot.price.toFixed(2)}
  broke above the last confirmed high ${lastConfirmedHigh ? `($${lastConfirmedHigh.price.toFixed(2)} at candle #${lastConfirmedHigh.index})` : '(none - first high)'}.

WHY THIS CONFIRMS THE LOW:
  The pending swing low at $${pendingLow.price.toFixed(2)} (candle #${pendingLow.index}) is confirmed
  because price has made a higher high. This validates that the low was indeed
  a significant turning point - price went down to that level, then reversed
  and went higher than before.

STRUCTURE ASSIGNMENT:
`;
        if (lastConfirmedLow) {
          const diff = pendingLow.price - lastConfirmedLow.price;
          confirmationReasoning += `  Previous confirmed low: $${lastConfirmedLow.price.toFixed(2)} at candle #${lastConfirmedLow.index}
  Current low: $${pendingLow.price.toFixed(2)}
  Difference: ${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}
  → Structure: ${structure} (${structure === 'HL' ? 'HIGHER LOW - bullish signal' : 'LOWER LOW - bearish signal'})\n`;
        } else {
          confirmationReasoning += `  This is the FIRST confirmed low, no previous to compare.
  → Structure: ${structure} (First Low)\n`;
        }

        detections.push({
          candleIndex: pendingLow.index,
          candleTime: new Date(pendingLow.time * 1000),
          price: pendingLow.price,
          detectionType: "swing_low",
          structure,
          confidence: 0.8,
          metadata: {
            confirmedAt: pivot.index,
            confirmedByPrice: pivot.price,
            pivotReasoning: pendingLow.pivotReasoning,
            confirmationReasoning,
            fullReasoning: pendingLow.pivotReasoning + confirmationReasoning,
          },
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

        // Build confirmation reasoning
        let confirmationReasoning = `
═══════════════════════════════════════════════════════════════════════════════
CONFIRMATION: SWING HIGH at candle #${pendingHigh.index} is now CONFIRMED
═══════════════════════════════════════════════════════════════════════════════

CONFIRMATION TRIGGER:
  A swing LOW pivot at candle #${pivot.index} with price $${pivot.price.toFixed(2)}
  broke below the last confirmed low ${lastConfirmedLow ? `($${lastConfirmedLow.price.toFixed(2)} at candle #${lastConfirmedLow.index})` : '(none - first low)'}.

WHY THIS CONFIRMS THE HIGH:
  The pending swing high at $${pendingHigh.price.toFixed(2)} (candle #${pendingHigh.index}) is confirmed
  because price has made a lower low. This validates that the high was indeed
  a significant turning point - price went up to that level, then reversed
  and went lower than before.

STRUCTURE ASSIGNMENT:
`;
        if (lastConfirmedHigh) {
          const diff = pendingHigh.price - lastConfirmedHigh.price;
          confirmationReasoning += `  Previous confirmed high: $${lastConfirmedHigh.price.toFixed(2)} at candle #${lastConfirmedHigh.index}
  Current high: $${pendingHigh.price.toFixed(2)}
  Difference: ${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}
  → Structure: ${structure} (${structure === 'HH' ? 'HIGHER HIGH - bullish continuation' : 'LOWER HIGH - bearish signal'})\n`;
        } else {
          confirmationReasoning += `  This is the FIRST confirmed high, no previous to compare.
  → Structure: ${structure} (First High)\n`;
        }

        detections.push({
          candleIndex: pendingHigh.index,
          candleTime: new Date(pendingHigh.time * 1000),
          price: pendingHigh.price,
          detectionType: "swing_high",
          structure,
          confidence: 0.8,
          metadata: {
            confirmedAt: pivot.index,
            confirmedByPrice: pivot.price,
            pivotReasoning: pendingHigh.pivotReasoning,
            confirmationReasoning,
            fullReasoning: pendingHigh.pivotReasoning + confirmationReasoning,
          },
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
