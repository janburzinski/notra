import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import {
  TRACKER_PLUS_SCRIPT_VERSION,
  TRACKER_SCRIPT_INTEGRITY,
  TRACKER_SCRIPT_VERSION,
} from "@notra/web-tracker/script";

import { handleScriptRequest } from "../src/handler";

const get = (path: string, init?: RequestInit) =>
  handleScriptRequest(new Request(`https://js.example${path}`, init));

describe("script worker", () => {
  test.each([
    ["/notra.js", TRACKER_SCRIPT_VERSION],
    ["/api/notra.js", TRACKER_SCRIPT_VERSION],
    ["/notra.plus.js", TRACKER_PLUS_SCRIPT_VERSION],
    ["/api/notra.plus.js", TRACKER_PLUS_SCRIPT_VERSION],
  ])(
    "%s is the current build, cached briefly and readable from any origin",
    async (path, version) => {
      const response = get(path);
      expect(response.status).toBe(200);
      expect(response.headers.get("etag")).toBe(`"${version}"`);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("cache-control")).not.toContain("immutable");
      const again = get(path, { headers: { "if-none-match": `"${version}"` } });
      expect(again.status).toBe(304);
    }
  );

  test("a pinned build is byte for byte the one its integrity names, immutable", async () => {
    const response = get(`/notra.${TRACKER_SCRIPT_VERSION}.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("immutable");
    const digest = createHash("sha384")
      .update(new Uint8Array(await response.arrayBuffer()))
      .digest("base64");
    expect(`sha384-${digest}`).toBe(TRACKER_SCRIPT_INTEGRITY);
    const redirected = get(`/notra.${TRACKER_SCRIPT_VERSION}.js?v=1`);
    expect(redirected.status).toBe(308);
    expect(redirected.headers.get("location")).toBe(
      `/notra.${TRACKER_SCRIPT_VERSION}.js`
    );
  });

  test.each([
    ["/notra.000000000000.js", undefined, 404],
    ["/", undefined, 404],
    ["/other.js", undefined, 404],
    // Page views go to the ingest through data-api, never to the script host.
    ["/api/collect", { method: "POST", body: "{}" }, 404],
    ["/notra.js", { method: "POST" }, 405],
  ] as const)("%s answers %s", (path, init, status) => {
    const response = get(path, init);
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
