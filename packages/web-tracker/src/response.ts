import {
  TRACKER_RELEASE_CACHE_CONTROL,
  TRACKER_RELEASE_FILE_PATTERN,
  TRACKER_SCRIPT_CACHE_CONTROL,
  TRACKER_SCRIPT_CONTENT_TYPE,
} from "./constants/script";
import { TRACKER_RELEASES } from "./generated/releases";
import {
  TRACKER_PLUS_SCRIPT,
  TRACKER_PLUS_SCRIPT_VERSION,
  TRACKER_SCRIPT,
  TRACKER_SCRIPT_VERSION,
} from "./generated/script";

function scriptResponse(
  request: Request,
  script: string,
  version: string,
  cacheControl: string
): Response {
  const etag = `"${version}"`;
  // Every response, 304s included, allows any origin: pinned tags load with
  // crossorigin="anonymous", which fails without it.
  const headers = {
    "Cache-Control": cacheControl,
    ETag: etag,
    "Access-Control-Allow-Origin": "*",
  };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(script, {
    headers: { ...headers, "Content-Type": TRACKER_SCRIPT_CONTENT_TYPE },
  });
}

/** notra.js with an ETag, so repeat loads cost a 304 and no body. */
export function trackerScriptResponse(request: Request): Response {
  return scriptResponse(
    request,
    TRACKER_SCRIPT,
    TRACKER_SCRIPT_VERSION,
    TRACKER_SCRIPT_CACHE_CONTROL
  );
}

/** notra.plus.js: notra.js plus error reporting, served the same way. */
export function trackerPlusScriptResponse(request: Request): Response {
  return scriptResponse(
    request,
    TRACKER_PLUS_SCRIPT,
    TRACKER_PLUS_SCRIPT_VERSION,
    TRACKER_SCRIPT_CACHE_CONTROL
  );
}

/**
 * A pinned build, `/api/notra.<version>.js` or `/api/notra.plus.<version>.js`,
 * from the release archive. Its bytes never change, so it caches for a year.
 * A query string is redirected to the bare file, so caches keep one copy of
 * the bytes however the tag was written; any other file name is a 404 that
 * is never cached, since that version may still be deploying.
 */
export function trackerReleaseResponse(request: Request): Response {
  const url = new URL(request.url);
  const file = url.pathname.split("/").at(-1) ?? "";
  const version = TRACKER_RELEASE_FILE_PATTERN.exec(file)?.[2];
  const release = version ? TRACKER_RELEASES[file] : undefined;
  if (!(version && release)) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (url.search) {
    return new Response(null, {
      status: 308,
      headers: {
        Location: url.pathname,
        "Cache-Control": TRACKER_RELEASE_CACHE_CONTROL,
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
  return scriptResponse(
    request,
    release.script,
    version,
    TRACKER_RELEASE_CACHE_CONTROL
  );
}
