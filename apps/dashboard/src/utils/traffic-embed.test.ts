import { describe, expect, test } from "bun:test";

import { getTrafficEmbedSecurityHeaders } from "./framework-request";
import {
  normalizeTrafficEmbedOrigin,
  storedTrafficEmbedCharts,
  trafficEmbedCharts,
  trafficEmbedFrameAncestors,
  trafficEmbedIdFromPath,
  trafficEmbedOriginAllowed,
  trafficEmbedRequestAllowed,
  trafficEmbedUrl,
} from "./traffic-embed";

describe("traffic embed origins", () => {
  test("normalizes what users type into CSP host sources", () => {
    expect(normalizeTrafficEmbedOrigin(" Example.com ")).toEqual({
      ok: true,
      origin: "https://example.com",
    });
    expect(normalizeTrafficEmbedOrigin("https://blog.example.com/")).toEqual({
      ok: true,
      origin: "https://blog.example.com",
    });
    expect(normalizeTrafficEmbedOrigin("*.example.com")).toEqual({
      ok: true,
      origin: "https://*.example.com",
    });
    expect(normalizeTrafficEmbedOrigin("http://localhost:3000")).toEqual({
      ok: true,
      origin: "http://localhost:3000",
    });
  });

  test("rejects anything that would widen or break frame-ancestors", () => {
    for (const value of [
      "*",
      "",
      "http://example.com",
      "https://example.com/path",
      "https://example.com?x=1",
      "https://user:pass@example.com",
      "example.com 'self'",
      "example.com; script-src *",
      "*.com",
      "ftp://example.com",
      "https://example.com;script-src",
      "https://exa mple.com",
    ]) {
      expect(normalizeTrafficEmbedOrigin(value).ok).toBe(false);
    }
  });

  test("embed pages allow only their origins and drop X-Frame-Options", () => {
    const headers = getTrafficEmbedSecurityHeaders(
      trafficEmbedFrameAncestors(["https://example.com"])
    );
    expect(headers["Content-Security-Policy"]).toBe(
      "frame-ancestors 'self' https://example.com"
    );
    expect("X-Frame-Options" in headers).toBe(false);
  });

  test("only well-formed ids are looked up", () => {
    const id = "a".repeat(24);
    expect(trafficEmbedIdFromPath(`/embed/ai-traffic/${id}`)).toBe(id);
    expect(trafficEmbedIdFromPath("/embed/ai-traffic/short")).toBeNull();
    expect(trafficEmbedIdFromPath(`/geo/${id}`)).toBeNull();
  });
});

describe("traffic embed charts", () => {
  test("the URL can only narrow the charts the embed allows", () => {
    const allowed = ["traffic", "visibility"] as const;
    expect(trafficEmbedCharts("visibility", allowed)).toEqual(["visibility"]);
    expect(trafficEmbedCharts("share-of-voice,visibility", allowed)).toEqual([
      "visibility",
    ]);
    expect(trafficEmbedCharts("share-of-voice", allowed)).toEqual([
      "traffic",
      "visibility",
    ]);
    expect(trafficEmbedCharts(undefined, allowed)).toEqual([
      "traffic",
      "visibility",
    ]);
    expect(trafficEmbedCharts(["visibility"], allowed)).toEqual([
      "traffic",
      "visibility",
    ]);
  });

  test("keeps page order and drops unknown stored charts", () => {
    expect(storedTrafficEmbedCharts(["countries", "bogus", "traffic"])).toEqual(
      ["traffic", "countries"]
    );
    expect(storedTrafficEmbedCharts(["bogus"])).toEqual(["traffic"]);
    expect(storedTrafficEmbedCharts(null)).toEqual(["traffic"]);
  });

  test("writes the chart pick into the URL only when given", () => {
    const options = {
      range: "30d",
      theme: "auto",
      parts: ["metrics", "chart"],
    } as const;
    expect(trafficEmbedUrl("https://app.test", "a".repeat(24), options)).toBe(
      `https://app.test/embed/ai-traffic/${"a".repeat(24)}`
    );
    expect(
      trafficEmbedUrl("https://app.test", "a".repeat(24), {
        ...options,
        charts: ["visibility", "countries"],
      })
    ).toBe(
      `https://app.test/embed/ai-traffic/${"a".repeat(24)}?charts=visibility%2Ccountries`
    );
  });
});

describe("traffic embed access", () => {
  const allowed = [
    "https://example.com",
    "https://*.blog.test",
    "http://localhost:3000",
  ];
  const self = "https://app.usenotra.com";
  const page = (dest: string | null, referer: string | null) =>
    trafficEmbedRequestAllowed(
      { kind: "page", dest, site: "cross-site", referer, selfOrigin: self },
      allowed
    );
  const data = (
    site: string | null,
    dest: string | null,
    referer: string | null
  ) =>
    trafficEmbedRequestAllowed(
      { kind: "data", dest, site, referer, selfOrigin: self },
      allowed
    );

  test("matches origins like frame-ancestors", () => {
    expect(trafficEmbedOriginAllowed("https://example.com", allowed)).toBe(
      true
    );
    expect(trafficEmbedOriginAllowed("https://www.example.com", allowed)).toBe(
      false
    );
    expect(trafficEmbedOriginAllowed("http://example.com", allowed)).toBe(
      false
    );
    expect(trafficEmbedOriginAllowed("https://a.blog.test", allowed)).toBe(
      true
    );
    expect(trafficEmbedOriginAllowed("https://blog.test", allowed)).toBe(false);
    expect(trafficEmbedOriginAllowed("https://a.blog.test:8443", allowed)).toBe(
      false
    );
    expect(trafficEmbedOriginAllowed("https://evilblog.test", allowed)).toBe(
      false
    );
    expect(trafficEmbedOriginAllowed("http://localhost:3000", allowed)).toBe(
      true
    );
    expect(trafficEmbedOriginAllowed("http://localhost:3001", allowed)).toBe(
      false
    );
  });

  test("the page only renders framed by an allowed site", () => {
    expect(page("iframe", "https://example.com/stats")).toBe(true);
    expect(page("iframe", "https://a.blog.test/")).toBe(true);
    expect(page("iframe", `${self}/acme/geo/traffic`)).toBe(true);
    expect(page("iframe", null)).toBe(true);
    expect(page("iframe", "https://evil.test/")).toBe(false);
    // Opened directly, in a new tab, or by a browser without fetch metadata
    // that names no framing site.
    expect(page("document", null)).toBe(false);
    expect(page("document", "https://example.com/")).toBe(false);
    expect(page(null, null)).toBe(false);
    expect(page(null, "https://example.com/")).toBe(true);
  });

  test("the data only answers the embed page's own polls", () => {
    expect(data("same-origin", "empty", `${self}/embed/ai-traffic/x`)).toBe(
      true
    );
    expect(data("same-origin", "document", null)).toBe(false);
    expect(data("none", "document", null)).toBe(false);
    expect(data("cross-site", "empty", "https://example.com/")).toBe(false);
    expect(data(null, null, `${self}/embed/ai-traffic/x`)).toBe(true);
    expect(data(null, null, "https://example.com/")).toBe(false);
    expect(data(null, null, null)).toBe(false);
  });
});
