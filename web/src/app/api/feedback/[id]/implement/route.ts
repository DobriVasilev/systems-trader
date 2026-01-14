import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Only admins can mark as implemented
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { implementationNotes } = body;

    // Fetch feedback to get user email and indicator info
    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      // Include indicator fields for email
    });

    if (!feedback) {
      return NextResponse.json(
        { success: false, error: "Feedback not found" },
        { status: 404 }
      );
    }

    // Update feedback status
    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: {
        status: "IMPLEMENTED",
        implementedAt: new Date(),
        implementedById: session.user.id,
        implementationNotes: implementationNotes || undefined,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        implementedBy: {
          select: {
            name: true,
          },
        },
      },
    });

    // Send email notification to user
    if (feedback.user.email) {
      try {
        const RESEND_API_KEY = process.env.RESEND_API_KEY;

        if (RESEND_API_KEY) {
          const indicatorText = feedback.indicator
            ? ` about ${feedback.indicator === "Other" && feedback.customIndicator
                ? feedback.customIndicator
                : feedback.indicator}`
            : "";

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || "noreply@dobri.org",
              to: feedback.user.email,
              subject: "Your feedback has been implemented! 🎉",
              html: `
                <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #1a1a1a; margin-bottom: 20px;">Great news!</h2>
                  <p style="color: #4a4a4a; margin-bottom: 20px;">
                    Hi ${feedback.user.name || "there"},
                  </p>
                  <p style="color: #4a4a4a; margin-bottom: 20px;">
                    Your feedback${indicatorText} has been implemented and is now live on the platform.
                  </p>
                  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="color: #1a1a1a; margin: 0 0 10px 0; font-size: 16px;">Your Feedback:</h3>
                    <p style="color: #4a4a4a; margin: 0; font-weight: 600;">${feedback.title || "Feedback"}</p>
                  </div>
                  ${implementationNotes ? `
                    <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
                      <h3 style="color: #2e7d32; margin: 0 0 10px 0; font-size: 16px;">Implementation Notes:</h3>
                      <p style="color: #1b5e20; margin: 0;">${implementationNotes}</p>
                    </div>
                  ` : ""}
                  <p style="color: #4a4a4a; margin-bottom: 20px;">
                    Thank you for helping us improve! Your contributions make a real difference.
                  </p>
                  <p style="color: #888; font-size: 14px; margin-top: 30px;">
                    Best regards,<br>
                    The Systems Trader Team
                  </p>
                </div>
              `,
            }),
          });
        }
      } catch (emailError) {
        console.error("Failed to send implementation email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedFeedback,
    });
  } catch (error) {
    console.error("Error marking feedback as implemented:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update feedback" },
      { status: 500 }
    );
  }
}
