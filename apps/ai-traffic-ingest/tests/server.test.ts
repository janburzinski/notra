import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import {
  TRACKER_PLUS_RELEASE,
  TRACKER_RELEASE,
} from "@notra/web-tracker/release";

import { INGEST_MAX_BODY_BYTES } from "../src/constants/server";
import { startService } from "./utils/service";

let configured: Awaited<ReturnType<typeof startService>>;
let unconfigured: Awaited<ReturnType<typeof startService>>;

beforeAll(async () => {
  [configured, unconfigured] = await Promise.all([
    startService({
      DATABASE_URL: "postgres://test:test@127.0.0.1:1/test",
      UPSTASH_REDIS_REST_URL: "http://127.0.0.1:1",
      UPSTASH_REDIS_REST_TOKEN: "test",
      TINYBIRD_TOKEN: "test",
      GEO_INGEST_SECRET: "test-ingest-secret",
    }),
    startService(),
  ]);
});

afterAll(async () => {
  const exits = await Promise.all([configured?.stop(), unconfigured?.stop()]);
  expect(exits).toEqual([0, 0]);
});

describe("standalone ingest HTTP service", () => {
  test("rejects missing and invalid tokens before reading the payload", async () => {
    for (const authorization of ["", "Bearer invalid-token"]) {
      const response = await fetch(`${configured.url}/api/geo/ingest`, {
        method: "POST",
        headers: { authorization },
        body: "invalid-json",
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    }
  });

  test("bounds the request body", async () => {
    const response = await fetch(`${configured.url}/api/geo/ingest`, {
      method: "POST",
      body: "x".repeat(INGEST_MAX_BODY_BYTES + 1),
    });
    expect(response.status).toBe(413);
  });

  test.each(["notra.js", "notra.plus.js"])(
    "serves %s with a short cache and answers repeat requests with 304",
    async (file) => {
      const response = await fetch(`${configured.url}/api/${file}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("javascript");
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("cache-control")).toContain("max-age=3600");
      expect((await response.text()).includes("unhandledrejection")).toBe(
        file === "notra.plus.js"
      );
      const cached = await fetch(`${configured.url}/api/${file}`, {
        headers: { "if-none-match": response.headers.get("etag") ?? "" },
      });
      expect(cached.status).toBe(304);
    }
  );

  test("serves pinned builds byte for byte with their integrity", async () => {
    for (const release of [TRACKER_RELEASE, TRACKER_PLUS_RELEASE]) {
      const response = await fetch(`${configured.url}/api/${release.file}`);
      expect(response.status).toBe(200);
      const digest = createHash("sha384")
        .update(new Uint8Array(await response.arrayBuffer()))
        .digest("base64");
      expect(`sha384-${digest}`).toBe(release.integrity);
      expect(response.headers.get("cache-control")).toContain("immutable");
    }
    const missing = await fetch(`${configured.url}/api/notra.000000000000.js`);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
  });

  test.each([
    ["a preflight", "configured", { method: "OPTIONS" }, 204],
    [
      "a beacon with an unknown key",
      "configured",
      {
        method: "POST",
        body: JSON.stringify({
          k: "nwk.org.project.0000",
          v: "abcdefghijklmnop",
          u: "https://acme.com/",
        }),
      },
      401,
    ],
    [
      "an oversized beacon",
      "configured",
      { method: "POST", body: "x".repeat(5 * 1024) },
      413,
    ],
    [
      "a beacon without ingest configured",
      "unconfigured",
      { method: "POST", body: "{}" },
      503,
    ],
  ] as const)(
    "answers %s readable from any origin",
    async (_name, service, init, status) => {
      const { url } = service === "configured" ? configured : unconfigured;
      const response = await fetch(`${url}/api/collect`, {
        ...init,
        headers: { "content-type": "text/plain", origin: "https://acme.com" },
      });
      expect(response.status).toBe(status);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
    }
  );
});
