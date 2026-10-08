import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ── 10 GB hard cap (not a single byte over) ─────────────────────────────────
export const STORAGE_CAP_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB exactly

// ── Per-file size limit (5 MB to keep things manageable) ────────────────────
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ── Allowed MIME types ──────────────────────────────────────────────────────
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export function isAllowedFileType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().split(";")[0].trim();

  if (ALLOWED_TYPES.has(normalized)) {
    return true;
  }

  // Common aliases from browser capture APIs.
  if (normalized === "audio/x-wav") return true;
  if (normalized === "audio/x-m4a") return true;
  if (normalized === "video/x-matroska") return true;

  return false;
}

// ── R2 Client (S3-compatible) ───────────────────────────────────────────────

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME not configured");
  return bucket;
}

// ── Key format: cases/{caseId}/{fileName} ───────────────────────────────────
// Each case gets its own "folder" in the single bucket.
// This avoids creating multiple buckets (R2 free tier = 1 bucket recommended).

export function buildObjectKey(caseId: number, fileName: string): string {
  // Sanitize file name: keep alphanumeric, dots, hyphens, underscores only
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ts = Date.now();
  return `cases/${caseId}/${ts}_${safe}`;
}

// ── Upload a file to R2 ────────────────────────────────────────────────────

export async function uploadFile(
  caseId: number,
  fileName: string,
  body: Buffer,
  contentType: string
): Promise<{ key: string; size: number }> {
  const client = getR2Client();
  const bucket = getBucket();
  const key = buildObjectKey(caseId, fileName);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return { key, size: body.length };
}

// ── Delete a file from R2 ──────────────────────────────────────────────────

export async function deleteFile(key: string): Promise<void> {
  const client = getR2Client();
  const bucket = getBucket();

  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key })
  );
}

// ── Generate a time-limited download URL (15 min) ──────────────────────────

export async function getDownloadUrl(key: string): Promise<string> {
  const client = getR2Client();
  const bucket = getBucket();

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 900 } // 15 minutes
  );
}

// ── List all objects under a case prefix ────────────────────────────────────

export async function listCaseFiles(caseId: number) {
  const client = getR2Client();
  const bucket = getBucket();

  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `cases/${caseId}/`,
    })
  );

  return (res.Contents ?? []).map((obj) => ({
    key: obj.Key!,
    size: obj.Size ?? 0,
    lastModified: obj.LastModified,
  }));
}

// ── Get total storage usage across all cases ────────────────────────────────

export async function getTotalStorageUsed(): Promise<number> {
  const client = getR2Client();
  const bucket = getBucket();

  let totalSize = 0;
  let continuationToken: string | undefined;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of res.Contents ?? []) {
      totalSize += obj.Size ?? 0;
    }

    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return totalSize;
}

// ── Check if a file exists ─────────────────────────────────────────────────

export async function fileExists(key: string): Promise<boolean> {
  const client = getR2Client();
  const bucket = getBucket();

  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ── Human-readable size ────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
}
