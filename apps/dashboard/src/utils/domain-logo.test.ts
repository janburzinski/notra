import { afterEach, describe, expect, test } from "bun:test";

import { getDomainLogoSources, normalizeDomain } from "./domain-logo";

const originalClientId = process.env.NEXT_PUBLIC_LOGOLINK_CLIENT_ID;

afterEach(() => {
  if (originalClientId === undefined) {
    delete process.env.NEXT_PUBLIC_LOGOLINK_CLIENT_ID;
    return;
  }
  process.env.NEXT_PUBLIC_LOGOLINK_CLIENT_ID = originalClientId;
});

describe("normalizeDomain", () => {
  test("normalizes domains and website URLs", () => {
    expect(normalizeDomain(" Example.COM. ")).toBe("example.com");
    expect(normalizeDomain("https://WWW.Example.com/path?q=1")).toBe(
      "www.example.com"
    );
  });

  test("rejects missing, invalid, and unsupported values", () => {
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("ftp://example.com")).toBeNull();
  });
});

describe("getDomainLogoSources", () => {
  test("orders Context.dev before DuckDuckGo when configured", () => {
    process.env.NEXT_PUBLIC_LOGOLINK_CLIENT_ID = "public client";

    expect(getDomainLogoSources("https://Example.com/path")).toEqual([
      "https://logos.context.dev/?publicClientId=public+client&domain=example.com",
      "https://icons.duckduckgo.com/ip3/example.com.ico",
    ]);
  });

  test("falls back to DuckDuckGo when Context.dev is not configured", () => {
    delete process.env.NEXT_PUBLIC_LOGOLINK_CLIENT_ID;

    expect(getDomainLogoSources("example.com")).toEqual([
      "https://icons.duckduckgo.com/ip3/example.com.ico",
    ]);
  });

  test("keeps supplied logos first and removes empty duplicates", () => {
    process.env.NEXT_PUBLIC_LOGOLINK_CLIENT_ID = "client";

    expect(
      getDomainLogoSources("example.com", [
        " https://cdn.example.com/logo.png ",
        null,
        "https://cdn.example.com/logo.png",
      ])
    ).toEqual([
      "https://cdn.example.com/logo.png",
      "https://logos.context.dev/?publicClientId=client&domain=example.com",
      "https://icons.duckduckgo.com/ip3/example.com.ico",
    ]);
  });
});
