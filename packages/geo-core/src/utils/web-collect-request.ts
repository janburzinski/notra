import { getClientIp } from "@notra/utils/client-ip";

import { GEO_CF_RAY_PATTERN } from "../constants/ingest";
import type { GeoIngestPayload, WebCollectOptions } from "../types/ingest";

const UNKNOWN_COUNTRY = "XX";

/** A beacon can set any header; keep cf-ray only when it looks like one. */
function cloudflareRayId(headers: Headers): string | undefined {
  const ray = headers.get("cf-ray");
  return ray && GEO_CF_RAY_PATTERN.test(ray) ? ray : undefined;
}

/**
 * The body as text, or null once it is larger than `maxBytes`: the declared
 * length is checked first and the stream is never read past the limit.
 */
export async function readLimitedText(
  request: Request,
  maxBytes: number
): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > maxBytes) {
    return null;
  }
  if (!request.body) {
    return "";
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- a stream is read in order
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return "";
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * Rebuilds the request envelope the server SDK would have sent, from the
 * headers of the browser's beacon. The page view itself was a GET; the
 * referrer is the page's, not the beacon's (which is the page URL).
 */
export function webCollectEnvelope(
  headers: Headers,
  url: string,
  referrer: string | undefined,
  options: WebCollectOptions = {}
): GeoIngestPayload {
  const ip = getClientIp(headers);
  // Only Vercel's country header is set by the edge itself; elsewhere the
  // country comes from the in-process lookup of the trusted client IP.
  const country =
    (process.env.VERCEL === "1"
      ? headers.get("x-vercel-ip-country")
      : undefined) ?? (ip ? options.lookupCountry?.(ip) : undefined);
  return {
    method: "GET",
    url,
    ...(ip ? { ip } : {}),
    ...(country && country !== UNKNOWN_COUNTRY ? { geo: { country } } : {}),
    ...(referrer ? { referer: referrer } : {}),
    userAgent: headers.get("user-agent") ?? undefined,
    acceptLanguage: headers.get("accept-language") ?? undefined,
    requestId: cloudflareRayId(headers),
    // The beacon is a fetch made by the page's own JavaScript, so a missing
    // Sec-Fetch-Mode only means an older browser (Safari before 16.4) or a
    // privacy proxy, not a bot: "" says "not known", where null would mark
    // a crawler. Tracing headers come from fetch instrumentation in the
    // page's scripts, as for a beacon a Notra Site relays.
    signals: {
      clientHints: headers.has("sec-ch-ua"),
      fetchMode: headers.get("sec-fetch-mode") ?? "",
      tracing: false,
    },
  };
}
