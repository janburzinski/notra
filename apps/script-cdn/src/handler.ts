import {
  trackerPlusScriptResponse,
  trackerReleaseResponse,
  trackerScriptResponse,
} from "@notra/web-tracker/response";

import { PLUS_SCRIPT_FILE, SCRIPT_FILE } from "./constants/routes";

/**
 * Serves notra.js the way the ingest does, from Cloudflare's edge: the same
 * response code, so headers, ETags, pinned builds and their integrity match.
 * Files answer at `/notra.js` and at the ingest's `/api/notra.js` paths.
 * Page views never come here: tags set `data-api` to the ingest. A redirect
 * would not help, since a cross-origin redirect sends `Origin: null` and the
 * ingest drops beacons from other origins, so `/api/collect` is a 404.
 */
export function handleScriptRequest(request: Request): Response {
  const url = new URL(request.url);
  const file = url.pathname.replace(/^\/(api\/)?/, "");
  if (!(file.startsWith("notra.") && file.endsWith(".js"))) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" },
    });
  }
  if (file === SCRIPT_FILE) {
    return trackerScriptResponse(request);
  }
  if (file === PLUS_SCRIPT_FILE) {
    return trackerPlusScriptResponse(request);
  }
  return trackerReleaseResponse(request);
}
