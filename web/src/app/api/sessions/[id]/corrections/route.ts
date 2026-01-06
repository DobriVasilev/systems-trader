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

    // Create the correction
    const correction = await prisma.patternCorrection.create({
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

    // If it's a delete or confirm correction, update the detection status
    if (correctionType === "delete" && detectionId) {
      await prisma.patternDetection.update({
        where: { id: detectionId },
        data: { status: "rejected" },
      });
    } else if (correctionType === "confirm" && detectionId) {
      await prisma.patternDetection.update({
        where: { id: detectionId },
        data: { status: "confirmed" },
      });
    } else if (correctionType === "unconfirm" && detectionId) {
      // Revert confirmed status back to pending
      await prisma.patternDetection.update({
        where: { id: detectionId },
        data: { status: "pending" },
      });
    } else if (correctionType === "move" && detectionId) {
      // Mark original as moved
      await prisma.patternDetection.update({
        where: { id: detectionId },
        data: { status: "moved" },
      });

      // Create new detection at the moved position
      if (correctedTime && correctedPrice) {
        const movedDetection = await prisma.patternDetection.create({
          data: {
            id: generateUlid(),
            sessionId: id,
            candleIndex: correctedIndex || 0,
            candleTime: new Date(correctedTime),
            price: correctedPrice,
            detectionType: correctedType || originalType || "swing_low",
            structure: correctedStructure || null,
            status: "confirmed",
            metadata: JSON.parse(JSON.stringify({
              source: "moved",
              movedFrom: detectionId,
              movedBy: session.user.id,
              correctionId: correction.id
            })),
          },
        });

        // Broadcast the new detection
        await broadcastDetectionUpdated(id, movedDetection.id);
      }
    }

    // If it's an "add" correction, create a new detection
    if (correctionType === "add" && correctedTime && correctedPrice) {
      const newDetection = await prisma.patternDetection.create({
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
            correctionId: correction.id
          })),
        },
      });

      // Update the correction with the new detection ID
      await prisma.patternCorrection.update({
        where: { id: correction.id },
        data: { detectionId: newDetection.id },
      });
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
