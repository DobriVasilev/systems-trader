import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateUlid } from "@/lib/ulid";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

// POST /api/upload - Upload a file
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const context = formData.get("context") as string | null; // "correction" | "comment"
    const contextId = formData.get("contextId") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "File type not allowed. Supported: JPEG, PNG, GIF, WebP, PDF" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileId = generateUlid();
    const ext = path.extname(file.name) || getExtension(file.type);
    const filename = `${fileId}${ext}`;

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    // Return file info
    const fileInfo = {
      id: fileId,
      url: `/uploads/${filename}`,
      type: file.type,
      name: file.name,
      size: file.size,
      context: context || null,
      contextId: contextId || null,
      uploadedBy: session.user.id,
      uploadedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: fileInfo,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

function getExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
  };
  return extensions[mimeType] || "";
}
