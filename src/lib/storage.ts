import "server-only";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3-compatible object storage (MinIO). Browsers upload/download directly via
// presigned URLs so file bytes never pass through the Next.js server.
//
// Two endpoints because the app and the browser may reach MinIO differently:
//   S3_ENDPOINT         internal host the app uses (e.g. http://minio:9000 in Docker)
//   S3_PUBLIC_ENDPOINT  host the browser uses to hit presigned URLs (defaults to S3_ENDPOINT)

const BUCKET = process.env.S3_BUCKET ?? "idstudio";
const REGION = process.env.S3_REGION ?? "us-east-1";
const ACCESS = process.env.S3_ACCESS_KEY ?? "";
const SECRET = process.env.S3_SECRET_KEY ?? "";
const INTERNAL_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const PUBLIC_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT ?? INTERNAL_ENDPOINT;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

function makeClient(endpoint: string) {
  return new S3Client({
    region: REGION,
    endpoint,
    forcePathStyle: true, // MinIO needs path-style addressing
    credentials: { accessKeyId: ACCESS, secretAccessKey: SECRET },
  });
}

const serverClient = makeClient(INTERNAL_ENDPOINT);
const presignClient = makeClient(PUBLIC_ENDPOINT);

let bucketReady: Promise<void> | null = null;
function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        await serverClient.send(new HeadBucketCommand({ Bucket: BUCKET }));
      } catch {
        try {
          await serverClient.send(new CreateBucketCommand({ Bucket: BUCKET }));
        } catch {
          // racing creators / already exists — ignore
        }
      }
    })();
  }
  return bucketReady;
}

export function buildObjectKey(workspaceId: string, cardId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
  return `workspace/${workspaceId}/card/${cardId}/${crypto.randomUUID()}-${safe}`;
}

export async function presignUpload(key: string, contentType: string): Promise<string> {
  await ensureBucket();
  return getSignedUrl(
    presignClient,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  );
}

export async function presignDownload(key: string, fileName: string): Promise<string> {
  return getSignedUrl(
    presignClient,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
    }),
    { expiresIn: 300 },
  );
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await serverClient.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // best-effort; the DB record is the source of truth
  }
}
