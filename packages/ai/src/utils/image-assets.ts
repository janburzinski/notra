import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  GENERATED_COVER_KEY_SUFFIX,
  GENERATED_COVER_URL,
} from "@notra/ai/constants/post-metadata";

import type { ExcalidrawScene } from "../types/excalidraw-diagram";
import type { UploadIntegrationBrandingAssetParams } from "../types/integrations";

interface R2Env {
  accessKeyId: string;
  bucketName: string;
  endpoint: string;
  publicUrl: string;
  secretAccessKey: string;
}

let cachedClient: S3Client | undefined;
let cachedEnv: R2Env | undefined;

const TRAILING_SLASHES_RE = /\/+$/;

function normalizeEndpoint(endpoint: string, bucketName: string) {
  const trimmed = endpoint.replace(TRAILING_SLASHES_RE, "");
  const suffix = `/${bucketName}`;
  return trimmed.endsWith(suffix) ? trimmed.slice(0, -suffix.length) : trimmed;
}

function getR2Env(): R2Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_BUCKET_NAME;
  const endpoint = process.env.CLOUDFLARE_S3_ENDPOINT;
  const publicUrl = process.env.CLOUDFLARE_PUBLIC_URL;

  if (
    !accessKeyId ||
    !secretAccessKey ||
    !bucketName ||
    !endpoint ||
    !publicUrl
  ) {
    throw new Error("Missing R2 environment variables");
  }

  cachedEnv = {
    accessKeyId,
    bucketName,
    endpoint: normalizeEndpoint(endpoint, bucketName),
    publicUrl,
    secretAccessKey,
  };

  return cachedEnv;
}

function getR2Client() {
  if (cachedClient) {
    return cachedClient;
  }

  const env = getR2Env();
  cachedClient = new S3Client({
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
    endpoint: env.endpoint,
    forcePathStyle: true,
    region: "auto",
  });

  return cachedClient;
}

export async function uploadIntegrationBrandingAsset(
  params: UploadIntegrationBrandingAssetParams
) {
  const env = getR2Env();
  const key = `organization/${params.organizationId}/integration-branding/${params.kind}-${crypto.randomUUID()}.${params.extension}`;

  await getR2Client().send(
    new PutObjectCommand({
      Body: params.body,
      Bucket: env.bucketName,
      CacheControl: "public, max-age=31536000",
      ContentLength: params.body.byteLength,
      ContentType: params.contentType,
      ...(params.contentType === "image/svg+xml"
        ? { ContentDisposition: "attachment" }
        : {}),
      Key: key,
    })
  );

  return `${env.publicUrl.replace(TRAILING_SLASHES_RE, "")}/${key}`;
}

async function uploadContentAsset(params: {
  organizationId: string;
  postId: string;
  extension: string;
  body: Buffer;
  contentType: string;
  signal?: AbortSignal;
}) {
  const env = getR2Env();
  const key = `organization/${params.organizationId}/content/${params.postId}-${Date.now()}.${params.extension}`;

  await getR2Client().send(
    new PutObjectCommand({
      Body: params.body,
      Bucket: env.bucketName,
      CacheControl: "public, max-age=31536000",
      ContentLength: params.body.byteLength,
      ContentType: params.contentType,
      Key: key,
    }),
    { abortSignal: params.signal }
  );

  return `${env.publicUrl.replace(TRAILING_SLASHES_RE, "")}/${key}`;
}

export function uploadGeneratedImageAsset(params: {
  organizationId: string;
  pngBase64: string;
  postId: string;
  signal?: AbortSignal;
}) {
  return uploadContentAsset({
    organizationId: params.organizationId,
    postId: params.postId,
    extension: "png",
    body: Buffer.from(params.pngBase64, "base64"),
    contentType: "image/png",
    signal: params.signal,
  });
}

export function uploadGeneratedCoverAsset(params: {
  organizationId: string;
  pngBase64: string;
  postId: string;
  signal?: AbortSignal;
}) {
  return uploadGeneratedImageAsset({
    ...params,
    postId: `${params.postId}${GENERATED_COVER_KEY_SUFFIX}-${crypto.randomUUID()}`,
  });
}

/** Deletes a generated cover; any other URL, or another bucket's, is left alone. */
export async function deleteGeneratedCoverAsset(url: string) {
  const env = getR2Env();
  const prefix = `${env.publicUrl.replace(TRAILING_SLASHES_RE, "")}/`;
  if (!(url.startsWith(prefix) && GENERATED_COVER_URL.test(url))) {
    return;
  }
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: env.bucketName,
      Key: url.slice(prefix.length),
    })
  );
}

export function uploadGeneratedHtmlAsset(params: {
  organizationId: string;
  html: string;
  postId: string;
}) {
  return uploadContentAsset({
    organizationId: params.organizationId,
    postId: params.postId,
    extension: "html",
    body: Buffer.from(params.html, "utf-8"),
    contentType: "text/html; charset=utf-8",
  });
}

export function uploadGeneratedExcalidrawAsset(params: {
  organizationId: string;
  scene: ExcalidrawScene;
  postId: string;
}) {
  return uploadContentAsset({
    organizationId: params.organizationId,
    postId: params.postId,
    extension: "excalidraw",
    body: Buffer.from(JSON.stringify(params.scene), "utf-8"),
    contentType: "application/json; charset=utf-8",
  });
}
