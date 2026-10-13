// Foto-berging. Verstek: in Postgres (eenvoudig vir die toetsfase).
// Stel S3_BUCKET (+ S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY) om na
// ’n S3-versoenbare bucket (bv. Railway Buckets, Cloudflare R2, AWS S3) oor te skakel.

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let s3: S3Client | null = null;

export function storageDriver(): "s3" | "db" {
  return process.env.S3_BUCKET ? "s3" : "db";
}

function client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
          : undefined
    });
  }
  return s3;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await client().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(key: string): Promise<Buffer> {
  const res = await client().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function deleteObject(key: string) {
  await client().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}
