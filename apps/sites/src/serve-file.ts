import { SITE_R2_KEYS } from "@notra/sites-core/constants/sites";
import type { SiteManifestFile } from "@notra/sites-core/types/deployment";
import { TRACKER_SCRIPT_VERSION } from "@notra/web-tracker/script";

import { injectAnalyticsScript } from "./analytics";
import { EDGE_READ_TIMEOUT_MS, R2_READ_TIMEOUT_MS } from "./constants/cache";
import {
  ASSET_SEGMENT,
  EDGE_CACHE_MAX_FILE_BYTES,
  EDGE_CACHE_ORIGIN,
  IMMUTABLE_CACHE_CONTROL,
  PREVIEW_CACHE_CONTROL,
  REVALIDATE_CACHE_CONTROL,
} from "./constants/responses";
import { serviceErrorPage } from "./pages";
import type { ByteRange, ServeFileParams } from "./types/serving";
import type { SitesDeps } from "./types/worker";
import { byteRange, etagMatches } from "./utils/conditional";
import { withinDeadline } from "./utils/deadline";
import { html } from "./utils/responses";
import { readVerifiedBody } from "./utils/verified-body";

function fileCacheControl(file: SiteManifestFile, isPreview: boolean): string {
  if (isPreview) {
    return PREVIEW_CACHE_CONTROL;
  }
  return file.immutable || file.path.includes(ASSET_SEGMENT)
    ? IMMUTABLE_CACHE_CONTROL
    : REVALIDATE_CACHE_CONTROL;
}

async function readFileBody(
  deps: SitesDeps,
  siteId: string,
  deploymentId: string,
  file: SiteManifestFile
): Promise<ReadableStream | null> {
  // Keyed by content, so files a redeploy or another area didn't change stay
  // warm. The site ID keeps tenants from probing each other's cache.
  const cacheKey = `${EDGE_CACHE_ORIGIN}/${siteId}/${file.sha256}`;
  // A stuck edge lookup counts as a miss, and a stuck R2 read as a missing body
  // (the retry page), so neither can hang the request.
  const cached = deps.cache
    ? await withinDeadline(
        deps.cache.match(cacheKey),
        deps.edgeReadTimeoutMs ?? EDGE_READ_TIMEOUT_MS
      )
    : null;
  if (cached?.body) {
    return cached.body;
  }
  const object = await withinDeadline(
    deps.bucket.get(SITE_R2_KEYS.file(siteId, deploymentId, file.path)),
    deps.r2ReadTimeoutMs ?? R2_READ_TIMEOUT_MS
  );
  if (!(object?.body && deps.cache) || file.size > EDGE_CACHE_MAX_FILE_BYTES) {
    return object?.body ?? null;
  }
  const { cache } = deps;
  const [forClient, forCache] = object.body.tee();
  deps.waitUntil(
    readVerifiedBody(forCache, file).then(async (verified) => {
      if (!verified) {
        return;
      }
      await cache.put(
        cacheKey,
        new Response(verified, {
          headers: {
            "Content-Type": file.contentType,
            "Cache-Control": IMMUTABLE_CACHE_CONTROL,
          },
        })
      );
    })
  );
  return forClient;
}

/** A Range the file can answer: If-Range must name this exact (strong) ETag. */
function requestedRange(
  request: Request,
  file: SiteManifestFile,
  etag: string
): ByteRange | "unsatisfiable" | null {
  const ifRange = request.headers.get("If-Range");
  if (ifRange !== null && ifRange.trim() !== etag) {
    return null;
  }
  return byteRange(request.headers.get("Range"), file.size);
}

/**
 * Partial content straight from R2. Video players need it: iOS Safari will not
 * play a <video> whose server ignores Range, and seeking needs it everywhere.
 */
async function serveRange(
  params: ServeFileParams,
  headers: Headers,
  range: ByteRange | "unsatisfiable"
): Promise<Response> {
  const { deps, request, siteId, deploymentId, file } = params;
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${file.size}`);
    return new Response(null, { status: 416, headers });
  }
  const length = range.end - range.start + 1;
  headers.set(
    "Content-Range",
    `bytes ${range.start}-${range.end}/${file.size}`
  );
  headers.set("Content-Length", String(length));
  if (request.method === "HEAD") {
    return new Response(null, { status: 206, headers });
  }
  const object = await withinDeadline(
    deps.bucket.get(SITE_R2_KEYS.file(siteId, deploymentId, file.path), {
      range: { offset: range.start, length },
    }),
    deps.r2ReadTimeoutMs ?? R2_READ_TIMEOUT_MS
  );
  if (!object?.body) {
    return html(serviceErrorPage(), 503);
  }
  return new Response(object.body, { status: 206, headers });
}

export async function serveFile(params: ServeFileParams): Promise<Response> {
  const { deps, request, siteId, deploymentId, file, status, isPreview } =
    params;
  // 404 pages carry notra.js too, so visits to missing pages are counted.
  const analytics =
    (status === 200 || status === 404) &&
    file.contentType.startsWith("text/html")
      ? (params.analytics ?? null)
      : null;
  // The suffix names the injected notra.js build, so a page cached with an
  // older tag (or the retired insights.js) is not revalidated as unchanged.
  const etag = analytics
    ? `"${file.sha256}-n${TRACKER_SCRIPT_VERSION}"`
    : `"${file.sha256}"`;
  const headers = new Headers({
    "Content-Type": file.contentType,
    "Cache-Control": fileCacheControl(file, isPreview),
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  if (
    params.contentSecurityPolicy &&
    file.contentType.startsWith("text/html")
  ) {
    headers.set("Content-Security-Policy", params.contentSecurityPolicy);
  }
  for (const [name, value] of Object.entries(params.extraHeaders ?? {})) {
    headers.set(name, value);
  }
  if (isPreview) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  if (
    status === 200 &&
    etagMatches(request.headers.get("If-None-Match"), etag)
  ) {
    return new Response(null, { status: 304, headers });
  }
  // Pages can be rewritten (notra.js) and count as page views, so only other
  // files (video, images, fonts, downloads) are served in parts.
  if (status === 200 && !file.contentType.startsWith("text/html")) {
    headers.set("Accept-Ranges", "bytes");
    const range = requestedRange(request, file, etag);
    if (range) {
      return serveRange(params, headers, range);
    }
  }
  const body = await readFileBody(deps, siteId, deploymentId, file);
  if (!body) {
    return html(serviceErrorPage(), 503);
  }
  const response = new Response(request.method === "HEAD" ? null : body, {
    status,
    headers,
  });
  return analytics && request.method !== "HEAD"
    ? injectAnalyticsScript(response, analytics)
    : response;
}
