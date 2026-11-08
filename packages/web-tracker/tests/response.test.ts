import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import { TRACKER_RELEASES } from "../src/generated/releases";
import { TRACKER_PLUS_RELEASE, TRACKER_RELEASE } from "../src/release";
import { trackerReleaseResponse, trackerScriptResponse } from "../src/response";

const ORIGIN = "https://ingest.example";

function get(path: string, headers: Record<string, string> = {}) {
  return trackerReleaseResponse(new Request(`${ORIGIN}${path}`, { headers }));
}

describe("pinned tracker builds", () => {
  test("serve the archived bytes their integrity was computed over", async () => {
    expect(Object.keys(TRACKER_RELEASES)).toContain(TRACKER_PLUS_RELEASE.file);
    for (const [file, release] of Object.entries(TRACKER_RELEASES)) {
      const response = get(`/api/${file}`);
      expect(response.status).toBe(200);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const digest = createHash("sha384").update(bytes).digest("base64");
      expect(`sha384-${digest}`).toBe(release.integrity);
    }
    expect(TRACKER_RELEASES[TRACKER_RELEASE.file]?.integrity).toBe(
      TRACKER_RELEASE.integrity
    );
  });

  test("are immutable, untransformed and readable cross-origin, 304s included", () => {
    const response = get(`/api/${TRACKER_PLUS_RELEASE.file}`);
    expect(response.headers.get("content-type")).toBe(
      "text/javascript; charset=utf-8"
    );
    const notModified = get(`/api/${TRACKER_PLUS_RELEASE.file}`, {
      "if-none-match": response.headers.get("etag") ?? "",
    });
    expect(notModified.status).toBe(304);
    for (const cached of [response, notModified]) {
      expect(cached.headers.get("cache-control")).toBe(
        "public, max-age=31536000, immutable, no-transform"
      );
      expect(cached.headers.get("access-control-allow-origin")).toBe("*");
    }
  });

  test.each([
    "/api/notra.000000000000.js",
    `/api/${TRACKER_RELEASE.file.toUpperCase()}`,
    `/api/${TRACKER_RELEASE.file}.map`,
    "/api/notra.js",
    "/api/notra.%2e%2e%2fpackage.json.js",
    "/api/__proto__",
    "/api/notra.constructor.js",
  ])("answer %s with a 404 that is never cached", (path) => {
    const response = get(path);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("a query string redirects to the bare file, so caches hold one copy", () => {
    const response = get(`/api/${TRACKER_RELEASE.file}?v=2`);
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      `/api/${TRACKER_RELEASE.file}`
    );
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable, no-transform"
    );
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    // An empty query is no query at all.
    expect(get(`/api/${TRACKER_RELEASE.file}?`).status).toBe(200);
    expect(get("/api/notra.000000000000.js?v=2").status).toBe(404);
  });

  test("the auto-updating script keeps its short cache", () => {
    const response = trackerScriptResponse(
      new Request(`${ORIGIN}/api/notra.js`)
    );
    expect(response.headers.get("cache-control")).toContain("max-age=3600");
  });
});
