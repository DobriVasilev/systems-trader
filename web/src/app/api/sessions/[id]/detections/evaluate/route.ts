import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Helper to check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "admin";
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface RuleEvaluation {
  rule: string;
  passed: boolean;
  details: string;
  comparedValue?: number;
  currentValue?: number;
  comparedIndex?: number;
}

interface EvaluationResult {
  candleIndex: number;
  candle: Candle;
  swingHighEvaluation: {
    isPivot: boolean;
    rules: RuleEvaluation[];
    summary: string;
    wouldBeConfirmed?: boolean;
    confirmationDetails?: string;
  };
  swingLowEvaluation: {
    isPivot: boolean;
    rules: RuleEvaluation[];
    summary: string;
    wouldBeConfirmed?: boolean;
    confirmationDetails?: string;
  };
  existingDetection?: {
    type: string;
    price: number;
  } | null;
}

// POST /api/sessions/[id]/detections/evaluate - Evaluate why a candle wasn't detected
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
    const { candleIndex, mode = "wicks" } = body;

    if (typeof candleIndex !== "number") {
      return NextResponse.json(
        { success: false, error: "candleIndex is required" },
        { status: 400 }
      );
    }

    // Check if user is admin (admins can access any session)
    const userIsAdmin = await isAdmin(session.user.id);

    // Check session access
    const patternSession = await prisma.patternSession.findFirst({
      where: userIsAdmin
        ? { id } // Admin: no access restrictions
        : {
            id,
            OR: [
              { createdById: session.user.id },
              { isPublic: true },
              { shares: { some: { userId: session.user.id } } },
            ],
          },
      include: {
        detections: {
          where: { candleIndex },
          select: { detectionType: true, price: true },
        },
      },
    });

    if (!patternSession) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    // Parse candle data (handle both string and already-parsed object)
    const candles: Candle[] = typeof patternSession.candleData === "string"
      ? JSON.parse(patternSession.candleData)
      : (patternSession.candleData as Candle[]);

    if (candleIndex < 0 || candleIndex >= candles.length) {
      return NextResponse.json(
        { success: false, error: "Invalid candle index" },
        { status: 400 }
      );
    }

    const lookback = 3;
    const useWicks = mode === "wicks";
    const getHigh = (c: Candle) => useWicks ? c.high : c.close;
    const getLow = (c: Candle) => useWicks ? c.low : c.close;
    const priceType = useWicks ? "HIGH" : "CLOSE";
    const priceTypeLow = useWicks ? "LOW" : "CLOSE";

    const current = candles[candleIndex];
    const currentHigh = getHigh(current);
    const currentLow = getLow(current);

    // Check if candle is at edges (not enough surrounding candles)
    const atLeftEdge = candleIndex < lookback;
    const atRightEdge = candleIndex >= candles.length - lookback;

    // Evaluate swing high
    const swingHighRules: RuleEvaluation[] = [];
    let isSwingHigh = true;

    if (atLeftEdge) {
      swingHighRules.push({
        rule: "Minimum lookback (left edge)",
        passed: false,
        details: `Candle #${candleIndex} is too close to the start. Need at least ${lookback} candles before it.`,
      });
      isSwingHigh = false;
    } else if (atRightEdge) {
      swingHighRules.push({
        rule: "Minimum lookback (right edge)",
        passed: false,
        details: `Candle #${candleIndex} is too close to the end. Need at least ${lookback} candles after it.`,
      });
      isSwingHigh = false;
    } else {
      // Check candles before
      for (let j = 1; j <= lookback; j++) {
        const compareCandle = candles[candleIndex - j];
        const compareHigh = getHigh(compareCandle);
        const passed = currentHigh >= compareHigh;

        swingHighRules.push({
          rule: `Higher than candle #${candleIndex - j} (${j} before)`,
          passed,
          details: passed
            ? `$${currentHigh.toFixed(2)} >= $${compareHigh.toFixed(2)}`
            : `$${currentHigh.toFixed(2)} < $${compareHigh.toFixed(2)} - This candle has a higher ${priceType.toLowerCase()}`,
          currentValue: currentHigh,
          comparedValue: compareHigh,
          comparedIndex: candleIndex - j,
        });

        if (!passed) isSwingHigh = false;
      }

      // Check candles after
      for (let j = 1; j <= lookback; j++) {
        const compareCandle = candles[candleIndex + j];
        const compareHigh = getHigh(compareCandle);
        const passed = currentHigh >= compareHigh;

        swingHighRules.push({
          rule: `Higher than candle #${candleIndex + j} (${j} after)`,
          passed,
          details: passed
            ? `$${currentHigh.toFixed(2)} >= $${compareHigh.toFixed(2)}`
            : `$${currentHigh.toFixed(2)} < $${compareHigh.toFixed(2)} - This candle has a higher ${priceType.toLowerCase()}`,
          currentValue: currentHigh,
          comparedValue: compareHigh,
          comparedIndex: candleIndex + j,
        });

        if (!passed) isSwingHigh = false;
      }
    }

    // Evaluate swing low
    const swingLowRules: RuleEvaluation[] = [];
    let isSwingLow = true;

    if (atLeftEdge) {
      swingLowRules.push({
        rule: "Minimum lookback (left edge)",
        passed: false,
        details: `Candle #${candleIndex} is too close to the start. Need at least ${lookback} candles before it.`,
      });
      isSwingLow = false;
    } else if (atRightEdge) {
      swingLowRules.push({
        rule: "Minimum lookback (right edge)",
        passed: false,
        details: `Candle #${candleIndex} is too close to the end. Need at least ${lookback} candles after it.`,
      });
      isSwingLow = false;
    } else {
      // Check candles before
      for (let j = 1; j <= lookback; j++) {
        const compareCandle = candles[candleIndex - j];
        const compareLow = getLow(compareCandle);
        const passed = currentLow <= compareLow;

        swingLowRules.push({
          rule: `Lower than candle #${candleIndex - j} (${j} before)`,
          passed,
          details: passed
            ? `$${currentLow.toFixed(2)} <= $${compareLow.toFixed(2)}`
            : `$${currentLow.toFixed(2)} > $${compareLow.toFixed(2)} - This candle has a lower ${priceTypeLow.toLowerCase()}`,
          currentValue: currentLow,
          comparedValue: compareLow,
          comparedIndex: candleIndex - j,
        });

        if (!passed) isSwingLow = false;
      }

      // Check candles after
      for (let j = 1; j <= lookback; j++) {
        const compareCandle = candles[candleIndex + j];
        const compareLow = getLow(compareCandle);
        const passed = currentLow <= compareLow;

        swingLowRules.push({
          rule: `Lower than candle #${candleIndex + j} (${j} after)`,
          passed,
          details: passed
            ? `$${currentLow.toFixed(2)} <= $${compareLow.toFixed(2)}`
            : `$${currentLow.toFixed(2)} > $${compareLow.toFixed(2)} - This candle has a lower ${priceTypeLow.toLowerCase()}`,
          currentValue: currentLow,
          comparedValue: compareLow,
          comparedIndex: candleIndex + j,
        });

        if (!passed) isSwingLow = false;
      }
    }

    // Check confirmation status if it's a pivot
    let swingHighConfirmation: { wouldBeConfirmed: boolean; confirmationDetails: string } | undefined;
    let swingLowConfirmation: { wouldBeConfirmed: boolean; confirmationDetails: string } | undefined;

    if (isSwingHigh || isSwingLow) {
      // Find all pivots to check confirmation
      const pivots = findAllPivots(candles, lookback, useWicks);

      if (isSwingHigh) {
        swingHighConfirmation = checkConfirmation(candleIndex, "high", pivots, candles);
      }

      if (isSwingLow) {
        swingLowConfirmation = checkConfirmation(candleIndex, "low", pivots, candles);
      }
    }

    // Generate summaries
    const swingHighSummary = generateSummary("Swing High", isSwingHigh, swingHighRules, swingHighConfirmation);
    const swingLowSummary = generateSummary("Swing Low", isSwingLow, swingLowRules, swingLowConfirmation);

    const result: EvaluationResult = {
      candleIndex,
      candle: current,
      swingHighEvaluation: {
        isPivot: isSwingHigh,
        rules: swingHighRules,
        summary: swingHighSummary,
        ...swingHighConfirmation,
      },
      swingLowEvaluation: {
        isPivot: isSwingLow,
        rules: swingLowRules,
        summary: swingLowSummary,
        ...swingLowConfirmation,
      },
      existingDetection: patternSession.detections[0]
        ? { type: patternSession.detections[0].detectionType, price: patternSession.detections[0].price }
        : null,
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error evaluating candle:", error);
    return NextResponse.json(
      { success: false, error: "Failed to evaluate candle" },
      { status: 500 }
    );
  }
}

// Find all pivots in the candle data
function findAllPivots(
  candles: Candle[],
  lookback: number,
  useWicks: boolean
): Array<{ index: number; type: "high" | "low"; price: number }> {
  const getHigh = (c: Candle) => useWicks ? c.high : c.close;
  const getLow = (c: Candle) => useWicks ? c.low : c.close;

  const pivots: Array<{ index: number; type: "high" | "low"; price: number }> = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    const currentHigh = getHigh(current);
    const currentLow = getLow(current);

    // Check swing high
    let isSwingHigh = true;
    for (let j = 1; j <= lookback; j++) {
      if (getHigh(candles[i - j]) > currentHigh || getHigh(candles[i + j]) > currentHigh) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) {
      pivots.push({ index: i, type: "high", price: currentHigh });
    }

    // Check swing low
    let isSwingLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (getLow(candles[i - j]) < currentLow || getLow(candles[i + j]) < currentLow) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow) {
      pivots.push({ index: i, type: "low", price: currentLow });
    }
  }

  return pivots.sort((a, b) => a.index - b.index);
}

// Check if a pivot would be confirmed
function checkConfirmation(
  candleIndex: number,
  type: "high" | "low",
  pivots: Array<{ index: number; type: "high" | "low"; price: number }>,
  candles: Candle[]
): { wouldBeConfirmed: boolean; confirmationDetails: string } {
  const oppositeType = type === "high" ? "low" : "high";

  // Find the next opposite pivot after this one
  const nextOppositePivot = pivots.find(
    (p) => p.index > candleIndex && p.type === oppositeType
  );

  if (nextOppositePivot) {
    const candleDate = new Date(candles[nextOppositePivot.index].time * 1000);
    return {
      wouldBeConfirmed: true,
      confirmationDetails: `Would be confirmed by ${oppositeType === "high" ? "swing high" : "swing low"} at candle #${nextOppositePivot.index} ($${nextOppositePivot.price.toFixed(2)}, ${candleDate.toLocaleString()})`,
    };
  } else {
    return {
      wouldBeConfirmed: false,
      confirmationDetails: `No opposite pivot found after this candle. The swing would remain unconfirmed (pending) because no ${oppositeType === "high" ? "swing high" : "swing low"} appeared afterwards to confirm it.`,
    };
  }
}

// Generate summary message
function generateSummary(
  type: string,
  isPivot: boolean,
  rules: RuleEvaluation[],
  confirmation?: { wouldBeConfirmed: boolean; confirmationDetails: string }
): string {
  const failedRules = rules.filter((r) => !r.passed);

  if (failedRules.length > 0) {
    const failedDescriptions = failedRules
      .slice(0, 2)
      .map((r) => r.rule)
      .join(", ");
    return `Not a ${type} pivot: Failed ${failedRules.length} rule(s) - ${failedDescriptions}${failedRules.length > 2 ? ` and ${failedRules.length - 2} more` : ""}`;
  }

  if (isPivot && confirmation) {
    if (confirmation.wouldBeConfirmed) {
      return `This IS a valid ${type} pivot and would be confirmed. Check if there's a detection already or if another swing took priority.`;
    } else {
      return `This IS a valid ${type} pivot but remains UNCONFIRMED. ${confirmation.confirmationDetails}`;
    }
  }

  return `Passed all pivot rules for ${type}.`;
}
