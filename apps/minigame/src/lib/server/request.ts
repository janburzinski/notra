import {
  MAX_REPLAY_BYTES,
  MAX_REPLAY_INFLATED_BYTES,
} from "@/constants/server";
import { publicOrigin } from "@/lib/server/config";
import { toBase64Url } from "@/utils/base64url";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * A write sent from another origin. SameSite=Lax still sends the session cookie from sibling
 * subdomains, and a text/plain POST needs no preflight, so writes must come from the game itself.
 */
function crossOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return (
    origin !== null &&
    origin !== new URL(request.url).origin &&
    origin !== publicOrigin(request)
  );
}

/**
 * Runs an API handler and turns anything it throws (Redis down, a timeout) into a JSON 503 the game
 * can show, instead of an HTML error page. Pass the request for writes to refuse other origins.
 */
export async function guarded(
  handler: () => Promise<Response>,
  request?: Request
) {
  if (request && crossOrigin(request)) {
    return jsonError("Not allowed", 403);
  }
  try {
    return await handler();
  } catch (error) {
    console.error("[minigame] api error", error);
    return jsonError(
      "Scores are unavailable right now, try again in a bit",
      503
    );
  }
}

/**
 * A short-lived rate-limit key for the caller's IP. The address is hashed and never stored as is,
 * and the key expires with its window.
 */
export async function clientKey(request: Request) {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`minigame:${ip}`)
  );
  return toBase64Url(new Uint8Array(digest).slice(0, 12));
}

/**
 * Reads a gzip-compressed replay from the request body, refusing anything oversized. Returns the
 * inflated bytes, and the compressed ones for storing.
 */
export async function readReplayBody(request: Request) {
  // refuse a declared oversize body before buffering it
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_REPLAY_BYTES) {
    return null;
  }
  const compressed = new Uint8Array(await request.arrayBuffer());
  if (compressed.byteLength === 0 || compressed.byteLength > MAX_REPLAY_BYTES) {
    return null;
  }
  try {
    const stream = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_REPLAY_INFLATED_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { bytes, compressed };
  } catch {
    return null;
  }
}
