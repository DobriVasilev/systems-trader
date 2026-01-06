import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateUlid } from "@/lib/ulid";
import { broadcastCorrectionCreated, broadcastDetectionUpdated } from "@/lib/realtime";
import { logCorrectionCreated, logDetectionStatusChanged } from "@/lib/events";
import { validate, createCorrectionSchema } from "@/lib/validation";

// GET /api/sessions/[id]/corrections - Get all corrections for a session
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

    const corrections = await prisma.patternCorrection.findMany({
      where: { sessionId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        detection: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: corrections,
    });
  } catch (error) {
    console.error("Error fetching corrections:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch corrections" },
      { status: 500 }
    );
  }
}

// POST /api/sessions/[id]/corrections - Create a new correction
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

    // Validate input with Zod
    const validation = validate(createCorrectionSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const {
      detectionId,
      correctionType,
      reason,
      originalIndex,
      originalTime,
      originalPrice,
      originalType,
      correctedIndex,
      correctedTime,
      correctedPrice,
      correctedType,
      correctedStructure,
    } = validation.data;

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

    // Get original detection status before any modifications (for undo support)
    let originalDetectionStatus: string | null = null;
    let originalDetection: Awaited<ReturnType<typeof prisma.patternDetection.findUnique>> | null = null;

    if (detectionId) {
      originalDetection = await prisma.patternDetection.findUnique({
        where: { id: detectionId },
      });
      originalDetectionStatus = originalDetection?.status || null;
    }

    // Use a transaction to ensure atomic updates
    const result = await prisma.$transaction(async (tx) => {
      // Create the correction with original status stored in metadata
      const correction = await tx.patternCorrection.create({
        data: {
          id: generateUlid(),
          sessionId: id,
          detectionId: detectionId || null,
          userId: session.user.id,
          correctionType,
          reason,
          originalIndex: originalIndex || null,
          originalTime: originalTime ? new Date(originalTime) : null,
          originalPrice: originalPrice || null,
          originalType: originalType || null,
          correctedIndex: correctedIndex || null,
          correctedTime: correctedTime ? new Date(correctedTime) : null,
          correctedPrice: correctedPrice || null,
          correctedType: correctedType || null,
          correctedStructure: correctedStructure || null,
          status: "pending",
          metadata: JSON.parse(JSON.stringify({
            originalStatus: originalDetectionStatus, // Store for undo support
          })),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          detection: true,
        },
      });

      let newDetectionId: string | null = null;

      // If it's a delete or confirm correction, update the detection status
      if (correctionType === "delete" && detectionId) {
        await tx.patternDetection.update({
          where: { id: detectionId },
          data: { status: "rejected" },
        });
      } else if (correctionType === "confirm" && detectionId) {
        await tx.patternDetection.update({
          where: { id: detectionId },
          data: { status: "confirmed" },
        });
      } else if (correctionType === "unconfirm" && detectionId) {
        // Revert confirmed status back to pending
        await tx.patternDetection.update({
          where: { id: detectionId },
          data: { status: "pending" },
        });
      } else if (correctionType === "move" && detectionId) {
        // Mark original as moved
        await tx.patternDetection.update({
          where: { id: detectionId },
          data: { status: "moved" },
        });

        // Create new detection at the moved position
        if (correctedTime && correctedPrice) {
          // Preserve detection_mode and ORIGINAL STATUS from original detection
          const originalMetadata = originalDetection?.metadata as Record<string, unknown> | null;
          const detectionMode = originalMetadata?.detection_mode || "wicks";

          const movedDetection = await tx.patternDetection.create({
            data: {
              id: generateUlid(),
              sessionId: id,
              candleIndex: correctedIndex || 0,
              candleTime: new Date(correctedTime),
              price: correctedPrice,
              detectionType: correctedType || originalType || "swing_low",
              structure: correctedStructure || null,
              // FIXED: Preserve original status instead of always setting to "confirmed"
              status: originalDetectionStatus || "confirmed",
              metadata: JSON.parse(JSON.stringify({
                source: "moved",
                movedFrom: detectionId,
                movedBy: session.user.id,
                correctionId: correction.id,
                detection_mode: detectionMode,
                originalStatus: originalDetectionStatus, // Store for reference
              })),
            },
          });

          newDetectionId = movedDetection.id;
        }
      }

      // If it's an "add" correction, create a new detection
      if (correctionType === "add" && correctedTime && correctedPrice) {
        // Get session settings for detection mode
        const sessionSettings = patternSession.patternSettings as { detection_mode?: "wicks" | "closes" } | null;
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { preferences: true },
        });
        const userPrefs = user?.preferences as { swingDetectionMode?: "wicks" | "closes" } | null;
        const detectionMode = sessionSettings?.detection_mode || userPrefs?.swingDetectionMode || "wicks";

        const newDetection = await tx.patternDetection.create({
          data: {
            id: generateUlid(),
            sessionId: id,
            candleIndex: correctedIndex || 0,
            candleTime: new Date(correctedTime),
            price: correctedPrice,
            detectionType: correctedType || "swing_low",
            structure: correctedStructure || null,
            status: "confirmed",
            metadata: JSON.parse(JSON.stringify({
              source: "manual",
              addedBy: session.user.id,
              correctionId: correction.id,
              detection_mode: detectionMode,
            })),
          },
        });

        // Update the correction with the new detection ID
        await tx.patternCorrection.update({
          where: { id: correction.id },
          data: { detectionId: newDetection.id },
        });

        newDetectionId = newDetection.id;
      }

      return { correction, newDetectionId };
    });

    const { correction, newDetectionId } = result;

    // Broadcast real-time updates (outside transaction for better performance)
    if (newDetectionId) {
      await broadcastDetectionUpdated(id, newDetectionId);
    }

    // Broadcast real-time updates
    await broadcastCorrectionCreated(id, correction.id, session.user.id);
    if (detectionId) {
      await broadcastDetectionUpdated(id, detectionId);
    }

    // Log events
    await logCorrectionCreated(id, session.user.id, correction.id, {
      correctionType,
      detectionId,
      reason,
      originalIndex,
      originalTime,
      originalPrice,
      correctedIndex,
      correctedTime,
      correctedPrice,
      correctedType,
    });

    // Log detection status change if applicable
    if (detectionId && ["delete", "confirm", "unconfirm", "move"].includes(correctionType)) {
      const newStatus =
        correctionType === "delete"
          ? "rejected"
          : correctionType === "confirm"
          ? "confirmed"
          : correctionType === "unconfirm"
          ? "pending"
          : "moved";
      const oldStatus = correctionType === "unconfirm" ? "confirmed" : "pending";
      await logDetectionStatusChanged(id, session.user.id, detectionId, oldStatus, newStatus);
    }

    return NextResponse.json({
      success: true,
      data: correction,
    });
  } catch (error) {
    console.error("Error creating correction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create correction" },
      { status: 500 }
    );
  }
}
