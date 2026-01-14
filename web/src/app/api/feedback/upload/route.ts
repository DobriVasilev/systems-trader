import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

// R2 Client
const r2Client =
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY
    ? new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      })
    : null;

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "pattern-tool-uploads";
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Allowed file types for feedback
const ALLOWED_TYPES: Record<string, { maxSize: number }> = {
  // Images
  "image/jpeg": { maxSize: 10 * 1024 * 1024 },
  "image/png": { maxSize: 10 * 1024 * 1024 },
  "image/gif": { maxSize: 5 * 1024 * 1024 },
  "image/webp": { maxSize: 10 * 1024 * 1024 },
  // Videos
  "video/mp4": { maxSize: 50 * 1024 * 1024 },
  "video/webm": { maxSize: 50 * 1024 * 1024 },
  "video/quicktime": { maxSize: 50 * 1024 * 1024 },
  // Audio (voice)
  "audio/mpeg": { maxSize: 10 * 1024 * 1024 },
  "audio/webm": { maxSize: 10 * 1024 * 1024 },
  "audio/ogg": { maxSize: 10 * 1024 * 1024 },
  "audio/wav": { maxSize: 20 * 1024 * 1024 },
  // Documents
  "application/pdf": { maxSize: 20 * 1024 * 1024 },
};

// POST /api/feedback/upload - Get presigned URL for direct upload
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!r2Client) {
    return NextResponse.json(
      { success: false, error: "File storage not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { filename, contentType, fileSize } = body;

    // Validate file type
    const typeConfig = ALLOWED_TYPES[contentType];
    if (!typeConfig) {
      return NextResponse.json(
        { success: false, error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize > typeConfig.maxSize) {
      const maxMB = Math.round(typeConfig.maxSize / (1024 * 1024));
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${maxMB}MB` },
        { status: 400 }
      );
    }

    // Generate unique key
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString("hex");
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `feedback/${session.user.id}/${timestamp}-${randomId}-${sanitizedFilename}`;

    // Generate presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSize,
      Metadata: {
        "user-id": session.user.id,
        "original-filename": filename,
        "uploaded-at": new Date().toISOString(),
        "context": "feedback",
      },
    });

    const presignedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 300, // 5 minutes
    });

    // Generate public URL
    const publicUrl = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : null;

    // Return upload URL and attachment ID (temporary ID for now)
    const attachmentId = crypto.randomUUID();

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: presignedUrl,
        key: key,
        publicUrl: publicUrl,
        attachmentId: attachmentId,
        expiresIn: 300,
      },
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { success: false, error: "Failed to prepare upload" },
      { status: 500 }
    );
  }
}

// PATCH /api/feedback/upload - Confirm upload completed
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { attachmentId } = body;

    if (!attachmentId) {
      return NextResponse.json(
        { success: false, error: "Attachment ID required" },
        { status: 400 }
      );
    }

    // For feedback uploads, we don't store attachment records until feedback is submitted
    // This just confirms the upload to R2 was successful
    return NextResponse.json({
      success: true,
      data: { attachmentId },
    });
  } catch (error) {
    console.error("Error confirming upload:", error);
    return NextResponse.json(
      { success: false, error: "Failed to confirm upload" },
      { status: 500 }
    );
  }
}
