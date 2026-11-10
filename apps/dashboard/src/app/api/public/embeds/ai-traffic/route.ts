import { createHash } from "node:crypto";

import { logError } from "@notra/ai/utils/server-log";
import { isDemoMode } from "@notra/utils/demo-mode";

import { TRAFFIC_EMBED_DATA_CDN_TTL_SECONDS } from "@/constants/traffic-embed";
import { loadPublicTrafficEmbed } from "@/lib/geo/traffic-embeds";
import {
  isTrafficEmbedId,
  trafficEmbedRange,
  trafficEmbedRequestAllowed,
  trafficEmbedRequestContext,
} from "@/utils/traffic-embed";

const NOT_FOUND_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
};

/**
 * The numbers an open embed polls for. Only the embed page's own requests
 * get them (see `trafficEmbedRequestAllowed`); opening the URL in a browser
 * or fetching it from another site is refused. Browsers revalidate every
 * poll (an unchanged payload is a bodiless 304), while the CDN answers for a
 * few seconds, keyed by the headers the check reads, so many displays on one
 * embed cost one origin request.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id?: string | string[] }> }
) {
  const { id } = await params;
  const embedId = typeof id === "string" ? id : "";
  if (isDemoMode() || !isTrafficEmbedId(embedId)) {
    return new Response(null, { status: 404, headers: NOT_FOUND_HEADERS });
  }
  const url = new URL(request.url);
  const context = trafficEmbedRequestContext(
    "data",
    request.url,
    request.headers
  );
  let embed: Awaited<ReturnType<typeof loadPublicTrafficEmbed>>;
  try {
    embed = await loadPublicTrafficEmbed(
      embedId,
      trafficEmbedRange(url.searchParams.get("range") ?? undefined),
      url.searchParams.get("charts") ?? undefined,
      (config) => trafficEmbedRequestAllowed(context, config.allowedOrigins)
    );
  } catch (error) {
    logError("Traffic embed data failed", error);
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!embed) {
    return new Response(null, { status: 404, headers: NOT_FOUND_HEADERS });
  }
  if (embed === "blocked") {
    return new Response(null, { status: 403, headers: NOT_FOUND_HEADERS });
  }
  const body = JSON.stringify(embed);
  const etag = `"${createHash("sha256").update(body).digest("base64url").slice(0, 27)}"`;
  const headers = {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Vercel-CDN-Cache-Control": `max-age=${TRAFFIC_EMBED_DATA_CDN_TTL_SECONDS}`,
    ETag: etag,
    // The access check reads these, so cached answers are kept apart by them.
    Vary: "Sec-Fetch-Site, Sec-Fetch-Dest, Referer",
    "X-Robots-Tag": "noindex",
  };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, {
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
