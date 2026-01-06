import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { broadcastDetectionUpdated } from "@/lib/realtime";

// DELETE /api/sessions/[id]/corrections/[correctionId] - Undo a correction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; correctionId: string }> }
) {
  const session = await auth();
  const { id, correctionId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
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

    // Get the correction to undo
    const correction = await prisma.patternCorrection.findUnique({
      where: { id: correctionId },
      include: { detection: true },
    });

    if (!correction) {
      return NextResponse.json(
        { success: false, error: "Correction not found" },
        { status: 404 }
      );
    }

    // Verify the correction belongs to this session
    if (correction.sessionId !== id) {
      return NextResponse.json(
        { success: false, error: "Correction does not belong to this session" },
        { status: 400 }
      );
    }

    // Get original status from correction metadata (for proper undo)
    const correctionMetadata = correction.metadata as { originalStatus?: string } | null;
    const originalStatus = correctionMetadata?.originalStatus || "pending";

    // Reverse the correction based on type
    switch (correction.correctionType) {
      case "delete":
        // Undo delete: restore detection to its original status
        if (correction.detectionId) {
          await prisma.patternDetection.update({
            where: { id: correction.detectionId },
            data: { status: originalStatus },
          });
          await broadcastDetectionUpdated(id, correction.detectionId);
        }
        break;

      case "confirm":
        // Undo confirm: restore detection to its original status (was pending before confirm)
        if (correction.detectionId) {
          await prisma.patternDetection.update({
            where: { id: correction.detectionId },
            data: { status: originalStatus },
          });
          await broadcastDetectionUpdated(id, correction.detectionId);
        }
        break;

      case "unconfirm":
        // Undo unconfirm: restore detection to its original status (was confirmed before unconfirm)
        if (correction.detectionId) {
          await prisma.patternDetection.update({
            where: { id: correction.detectionId },
            data: { status: originalStatus },
          });
          await broadcastDetectionUpdated(id, correction.detectionId);
        }
        break;

      case "move":
        // Undo move: delete the moved detection, restore original to its previous status
        if (correction.detectionId) {
          // Find the detection that was created by this move
          const movedDetection = await prisma.patternDetection.findFirst({
            where: {
              sessionId: id,
              metadata: {
                path: ["correctionId"],
                equals: correctionId,
              },
            },
          });

          if (movedDetection) {
            // Delete the moved detection
            await prisma.patternDetection.delete({
              where: { id: movedDetection.id },
            });
          }

          // Restore the original detection to its previous status
          await prisma.patternDetection.update({
            where: { id: correction.detectionId },
            data: { status: originalStatus },
          });
          await broadcastDetectionUpdated(id, correction.detectionId);
        }
        break;

      case "add":
        // Undo add: delete the detection that was created
        if (correction.detectionId) {
          await prisma.patternDetection.delete({
            where: { id: correction.detectionId },
          });
        }
        break;
    }

    // Mark the correction as undone (soft delete)
    await prisma.patternCorrection.update({
      where: { id: correctionId },
      data: { status: "undone" },
    });

    return NextResponse.json({
      success: true,
      message: `Correction ${correction.correctionType} undone successfully`,
    });
  } catch (error) {
    console.error("Error undoing correction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to undo correction" },
      { status: 500 }
    );
  }
}
