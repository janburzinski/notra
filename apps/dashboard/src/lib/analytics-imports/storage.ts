import { createHash, createHmac } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ANALYTICS_IMPORT_ACTIVE_STATUSES } from "@notra/db/constants/analytics-imports";
import { db } from "@notra/db/drizzle";
import { analyticsImports } from "@notra/db/schema";
import { decodeIntegrationEncryptionKey } from "@notra/db/utils/integration-encryption";
import { IMPORT_CSV_MAX_ZIP_BYTES } from "@notra/geo-core/constants/analytics-imports";
import { and, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  ANALYTICS_IMPORT_INLINE_MAX_BYTES,
  ANALYTICS_IMPORT_UPLOAD_KEY_LABEL,
  ANALYTICS_IMPORT_UPLOAD_MAX_AGE_MS,
  ANALYTICS_IMPORT_UPLOAD_PREFIX,
  ANALYTICS_IMPORT_UPLOAD_SWEEP_BATCH,
  ANALYTICS_IMPORT_UPLOAD_URL_TTL_SECONDS,
  ANALYTICS_IMPORT_ZIP_MIME,
} from "@/constants/analytics-imports";
import {
  deleteR2Keys,
  getR2StorageConfig,
  isR2StorageConfigured,
} from "@/lib/upload/r2";
import type {
  AnalyticsImportRow,
  AnalyticsImportUploadEncryption,
  AnalyticsImportUploadTarget,
} from "@/types/analytics-imports";

/**
 * Exports live under their own top-level prefix, away from the public asset
 * paths, so one listing finds every upload and a bucket lifecycle rule can
 * expire them.
 */
function uploadPrefix(organizationId: string) {
  return `${ANALYTICS_IMPORT_UPLOAD_PREFIX}/${organizationId}/`;
}

export function isImportUploadKey(organizationId: string, key: string) {
  const prefix = uploadPrefix(organizationId);
  return (
    key.startsWith(prefix) && /^[\w-]+\.zip$/.test(key.slice(prefix.length))
  );
}

/**
 * Each export is stored with SSE-C under its own key, derived from the
 * object key and INTEGRATION_ENCRYPTION_KEY: storage only serves it to a
 * request that sends the key, so the object is unreadable through the
 * bucket's public URL. Only the uploading browser and the server know it.
 */
function uploadEncryption(key: string): AnalyticsImportUploadEncryption {
  const secret = createHmac(
    "sha256",
    decodeIntegrationEncryptionKey(process.env.INTEGRATION_ENCRYPTION_KEY)
  )
    .update(`${ANALYTICS_IMPORT_UPLOAD_KEY_LABEL}:${key}`)
    .digest();
  return {
    SSECustomerAlgorithm: "AES256",
    SSECustomerKey: secret.toString("base64"),
    SSECustomerKeyMD5: createHash("md5").update(secret).digest("base64"),
  };
}

/**
 * Where the browser sends a Plausible export: a presigned PUT when object
 * storage exists, otherwise the import request itself (local development).
 * The PUT must carry the returned headers; they are part of the signature.
 */
export async function createImportUploadTarget(
  organizationId: string,
  fileSize: number
): Promise<AnalyticsImportUploadTarget> {
  if (!isR2StorageConfigured()) {
    return { mode: "inline", maxBytes: ANALYTICS_IMPORT_INLINE_MAX_BYTES };
  }
  const { client, bucketName } = getR2StorageConfig();
  const key = `${uploadPrefix(organizationId)}${nanoid()}.zip`;
  const encryption = uploadEncryption(key);
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: ANALYTICS_IMPORT_ZIP_MIME,
      ContentLength: fileSize,
      ...encryption,
    }),
    { expiresIn: ANALYTICS_IMPORT_UPLOAD_URL_TTL_SECONDS }
  );
  return {
    mode: "storage",
    url,
    key,
    maxBytes: IMPORT_CSV_MAX_ZIP_BYTES,
    headers: {
      "Content-Type": ANALYTICS_IMPORT_ZIP_MIME,
      "x-amz-server-side-encryption-customer-algorithm":
        encryption.SSECustomerAlgorithm,
      "x-amz-server-side-encryption-customer-key": encryption.SSECustomerKey,
      "x-amz-server-side-encryption-customer-key-md5":
        encryption.SSECustomerKeyMD5,
    },
  };
}

export async function* readImportUpload(
  key: string
): AsyncGenerator<Uint8Array> {
  const { client, bucketName } = getR2StorageConfig();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      ...uploadEncryption(key),
    })
  );
  if (!response.Body) {
    throw new Error("Uploaded export is missing");
  }
  const reader = response.Body.transformToWebStream().getReader();
  try {
    for (;;) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- streams the object chunk by chunk
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/** The export an import uploaded; it is removed once the import ends. */
export function readImportRowUpload(
  row: AnalyticsImportRow
): AsyncGenerator<Uint8Array> {
  if (!row.uploadObjectKey) {
    throw new Error("The uploaded export is no longer available");
  }
  return readImportUpload(row.uploadObjectKey);
}

export async function deleteImportUpload(key: string): Promise<void> {
  if (!isR2StorageConfigured()) {
    return;
  }
  const { client, bucketName } = getR2StorageConfig();
  await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
}

/** Every upload older than `before`, from one paginated listing of the prefix. */
async function uploadsOlderThan(before: number): Promise<string[]> {
  const { client, bucketName } = getR2StorageConfig();
  const keys: string[] = [];
  let token: string | undefined;
  do {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- pages follow one continuation token
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: `${ANALYTICS_IMPORT_UPLOAD_PREFIX}/`,
        ContinuationToken: token,
      })
    );
    for (const object of page.Contents ?? []) {
      if (object.Key && (object.LastModified?.getTime() ?? 0) < before) {
        keys.push(object.Key);
      }
    }
    token = page.NextContinuationToken;
  } while (token);
  return keys;
}

async function keysStillRead(keys: readonly string[]): Promise<Set<string>> {
  const inUse = new Set<string>();
  for (
    let index = 0;
    index < keys.length;
    index += ANALYTICS_IMPORT_UPLOAD_SWEEP_BATCH
  ) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- bounded IN lists, one after another
    const rows = await db
      .select({ key: analyticsImports.uploadObjectKey })
      .from(analyticsImports)
      .where(
        and(
          inArray(
            analyticsImports.uploadObjectKey,
            keys.slice(index, index + ANALYTICS_IMPORT_UPLOAD_SWEEP_BATCH)
          ),
          inArray(analyticsImports.status, [
            ...ANALYTICS_IMPORT_ACTIVE_STATUSES,
          ])
        )
      );
    for (const row of rows) {
      if (row.key) {
        inUse.add(row.key);
      }
    }
  }
  return inUse;
}

/**
 * Deletes exports older than a day that no running import reads: ones that
 * were checked but never imported, and any a finished import failed to
 * delete. Returns how many objects were removed.
 */
export async function sweepImportUploads(now = Date.now()): Promise<number> {
  if (!isR2StorageConfigured()) {
    return 0;
  }
  const stale = await uploadsOlderThan(
    now - ANALYTICS_IMPORT_UPLOAD_MAX_AGE_MS
  );
  if (stale.length === 0) {
    return 0;
  }
  const inUse = await keysStillRead(stale);
  return await deleteR2Keys(stale.filter((key) => !inUse.has(key)));
}
