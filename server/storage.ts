import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { env, hasS3 } from "./env";

const s3 = hasS3
  ? new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    })
  : null;

function fullKey(key: string) {
  return env.S3_PREFIX + key;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: fullKey(key), Body: body, ContentType: contentType }));
    return;
  }
  const p = path.join(env.LOCAL_UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body);
}

export async function getObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    if (s3) {
      const out = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: fullKey(key) }));
      const chunks: Buffer[] = [];
      for await (const c of out.Body as Readable) chunks.push(Buffer.from(c));
      return { body: Buffer.concat(chunks), contentType: out.ContentType ?? "application/octet-stream" };
    }
    const body = await fs.readFile(path.join(env.LOCAL_UPLOAD_DIR, key));
    return { body, contentType: key.endsWith(".png") ? "image/png" : "image/jpeg" };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string) {
  try {
    if (s3) {
      await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: fullKey(key) }));
      return;
    }
    await fs.unlink(path.join(env.LOCAL_UPLOAD_DIR, key));
  } catch {
    /* כבר נמחק */
  }
}
