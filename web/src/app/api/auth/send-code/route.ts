import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Generate a random 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Rate limiting: Check if a code was sent recently (within 60 seconds)
    const recentToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        expires: {
          gt: new Date(Date.now() - 60 * 1000), // Code sent within last 60 seconds
        },
      },
    });

    if (recentToken) {
      return NextResponse.json(
        { error: "Please wait before requesting another code" },
        { status: 429 }
      );
    }

    // Generate 6-digit code
    const code = generateCode();

    // Delete any existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    // Store the code with 10-minute expiration
    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: code,
        expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    // Send email with code
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Systems Trader <noreply@systemstrader.io>",
        to: normalizedEmail,
        subject: "Your Systems Trader login code",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3B82F6; font-size: 24px; margin: 0;">Systems Trader</h1>
            </div>
            <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
              Enter this code to sign in to your account:
            </p>
            <div style="background: #F3F4F6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1F2937;">
                ${code}
              </span>
            </div>
            <p style="color: #6B7280; font-size: 14px; margin-bottom: 8px;">
              This code will expire in 10 minutes.
            </p>
            <p style="color: #6B7280; font-size: 14px;">
              If you didn't request this code, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    } else {
      // Development: log the code to console
      console.log(`[DEV] Login code for ${normalizedEmail}: ${code}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending verification code:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
