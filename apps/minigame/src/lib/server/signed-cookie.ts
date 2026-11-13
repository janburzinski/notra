import type { z } from "zod";

import { sessionSecret } from "@/lib/server/config";
import { fromBase64Url, toBase64Url } from "@/utils/base64url";

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

function signingKey(secret: string) {
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return keyPromise;
}

/** `payload.signature`, both base64url. Returns null when signing isn't configured. */
export async function signValue(value: object) {
  const secret = sessionSecret();
  if (!secret) {
    return null;
  }
  const payload = toBase64Url(encoder.encode(JSON.stringify(value)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    encoder.encode(payload)
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Checks the signature, the schema and the `exp` field; anything off reads as no cookie. */
export async function readSignedValue<T extends { exp: number }>(
  raw: string | undefined,
  schema: z.ZodType<T>
): Promise<T | null> {
  const secret = sessionSecret();
  if (!(raw && secret)) {
    return null;
  }
  const [payload, signature] = raw.split(".");
  if (!(payload && signature)) {
    return null;
  }
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      fromBase64Url(signature),
      encoder.encode(payload)
    );
    if (!valid) {
      return null;
    }
    const parsed = schema.safeParse(
      JSON.parse(new TextDecoder().decode(fromBase64Url(payload)))
    );
    if (!parsed.success || parsed.data.exp < Date.now()) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
