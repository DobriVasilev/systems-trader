/**
 * R2 File Storage for Pattern Tool
 *
 * Handles file uploads for session attachments, screenshots, etc.
 * Uses Cloudflare R2 (S3-compatible) for cost-effective blob storage.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3-compatible client for R2
const r2Client = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'pattern-tool-uploads';
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

/**
 * Generate a unique key for a file upload
 */
function generateFileKey(sessionId: string, userId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `sessions/${sessionId}/${userId}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Upload a file to R2
 */
export async function uploadFile(
  sessionId: string,
  userId: string,
  filename: string,
  content: Buffer | string,
  contentType: string
): Promise<UploadResult> {
  if (!r2Client) {
    console.warn('[r2] R2 not configured, file upload disabled');
    return { success: false, error: 'File storage not configured' };
  }

  try {
    const key = generateFileKey(sessionId, userId, filename);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: content,
        ContentType: contentType,
        Metadata: {
          'user-id': userId,
          'session-id': sessionId,
          'original-filename': filename,
          'uploaded-at': new Date().toISOString(),
        },
      })
    );

    // Generate public URL if configured
    const url = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : undefined;

    return { success: true, key, url };
  } catch (error) {
    console.error('[r2] uploadFile error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file',
    };
  }
}

/**
 * Get a signed URL for private file access
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!r2Client) {
    return { success: false, error: 'File storage not configured' };
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn });

    return { success: true, url };
  } catch (error) {
    console.error('[r2] getSignedDownloadUrl error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate signed URL',
    };
  }
}

/**
 * Delete a file from R2
 */
export async function deleteFile(key: string): Promise<{ success: boolean; error?: string }> {
  if (!r2Client) {
    return { success: false, error: 'File storage not configured' };
  }

  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    return { success: true };
  } catch (error) {
    console.error('[r2] deleteFile error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete file',
    };
  }
}

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  return r2Client !== null;
}
