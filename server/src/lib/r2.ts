/**
 * Cloudflare R2 Client
 * S3-compatible storage for video files and HLS streams
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";

// R2 Configuration from environment
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "watch-together-streams";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

// Create S3-compatible client for R2
export const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate a presigned PUT URL for direct browser upload to R2
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(r2Client, command, { expiresIn });
  return url;
}

/**
 * Upload a local file to R2
 */
export async function uploadFile(
  key: string,
  filePath: string,
  contentType: string
): Promise<void> {
  const fileStream = fs.createReadStream(filePath);
  const stat = fs.statSync(filePath);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
    ContentLength: stat.size,
  });

  await r2Client.send(command);
  console.log(`[R2] Uploaded: ${key} (${(stat.size / 1024).toFixed(1)} KB)`);
}

/**
 * Delete a single object from R2
 */
export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
  console.log(`[R2] Deleted: ${key}`);
}

/**
 * Delete all objects under a prefix (e.g., videos/{videoId}/)
 */
export async function deletePrefix(prefix: string): Promise<void> {
  let continuationToken: string | undefined;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const listResult = await r2Client.send(listCommand);

    if (listResult.Contents && listResult.Contents.length > 0) {
      // Delete each object (R2 doesn't support DeleteObjects batch)
      for (const obj of listResult.Contents) {
        if (obj.Key) {
          await deleteObject(obj.Key);
        }
      }
    }

    continuationToken = listResult.NextContinuationToken;
  } while (continuationToken);

  console.log(`[R2] Deleted all objects under prefix: ${prefix}`);
}

/**
 * Download a file from R2 to local path
 */
export async function downloadFile(key: string, localPath: string): Promise<void> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await r2Client.send(command);

  if (!response.Body) {
    throw new Error(`[R2] No body in response for key: ${key}`);
  }

  // Ensure directory exists
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write stream to file
  const writeStream = fs.createWriteStream(localPath);
  const bodyStream = response.Body as NodeJS.ReadableStream;

  await new Promise<void>((resolve, reject) => {
    bodyStream.pipe(writeStream);
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  console.log(`[R2] Downloaded: ${key} → ${localPath}`);
}

/**
 * Get the public URL for a key
 */
export function getPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Get content type based on file extension
 */
export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".m3u8": "application/vnd.apple.mpegurl",
    ".ts": "video/mp2t",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
  };
  return types[ext] || "application/octet-stream";
}
