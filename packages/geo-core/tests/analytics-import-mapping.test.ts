import { describe, expect, test } from "bun:test";

import {
  mapImportBrowser,
  mapImportCountry,
  mapImportDevice,
  mapImportOs,
  mapImportReferrer,
  normalizeImportHost,
  sanitizeImportPath,
} from "../src/imports/map-dimensions";
import {
  aggregateGeoRows,
  aggregateWebRows,
  toGeoImportedRow,
  toWebImportedRow,
} from "../src/imports/rows";
import type {
  ImportReferrerInput,
  ImportRowContext,
} from "../src/types/analytics-imports";

const PAGE_HOST = "example.com";

describe("referrers", () => {
  test.each([
    ["ChatGPT", "ai", "chatgpt", "openai"],
    ["Google Gemini", "ai", "gemini", "google"],
    ["Google", "search", "google", ""],
    ["Hacker News", "social", "hacker-news", ""],
    ["Direct / None", "direct", "", ""],
    ["", "direct", "", ""],
    ["Newsletter", "other", "newsletter", ""],
    ["Gmail", "other", "gmail", ""],
    ["Slack", "social", "slack", ""],
    ["WhatsApp", "social", "whatsapp", ""],
  ])("Plausible source %j maps to %s/%s", (sourceName, group, source, ai) => {
    expect(mapImportReferrer({ sourceName, pageHost: PAGE_HOST })).toEqual({
      host: "",
      group: group as never,
      source,
      aiProduct: ai,
    });
  });

  test.each([
    ["chatgpt.com", "ai", "chatgpt", "openai"],
    ["https://chat.openai.com/c/123", "ai", "chatgpt", "openai"],
    ["www.bing.com/chat", "ai", "copilot", "microsoft"],
    ["google.de", "search", "google", ""],
    ["t.co", "social", "x", ""],
    ["news.ycombinator.com/item?id=1", "social", "hacker-news", ""],
    ["www.someblog.dev", "other", "someblog.dev", ""],
    ["www.example.com", "internal", "", ""],
    ["mail.google.com", "other", "gmail", ""],
    ["app.slack.com", "social", "slack", ""],
    ["android-app://com.google.android.gm/", "other", "gmail", ""],
    ["android-app://com.linkedin.android", "social", "linkedin", ""],
    ["android-app://com.example.reader/", "other", "com.example.reader", ""],
    ["android-app://com.openai.chatgpt/", "ai", "chatgpt", "openai"],
  ])("referrer host %j maps to %s/%s", (referrer, group, source, ai) => {
    expect(mapImportReferrer({ referrer, pageHost: PAGE_HOST })).toMatchObject({
      group,
      source,
      aiProduct: ai,
    });
  });

  test.each<[string, Omit<ImportReferrerInput, "pageHost">, string, string]>([
    [
      "utm_source=chatgpt.com without a referrer",
      { utmSource: "chatgpt.com", sourceName: "chatgpt.com" },
      "ai",
      "chatgpt",
    ],
    [
      "an AI campaign tag over a non-AI referrer",
      { referrer: "www.google.com", utmSource: "chatgpt.com" },
      "ai",
      "chatgpt",
    ],
    ["a named campaign source", { utmSource: "Twitter" }, "social", "x"],
    [
      "a source name that is an Android app",
      { sourceName: "android-app://com.google.android.gm" },
      "other",
      "gmail",
    ],
    [
      "another campaign source, lowercased",
      { utmSource: "Spring-Launch" },
      "other",
      "spring-launch",
    ],
  ])("%s maps to %s/%s", (_label, input, group, source) => {
    expect(mapImportReferrer({ ...input, pageHost: PAGE_HOST })).toMatchObject({
      group,
      source,
    });
  });
});

const DIMENSIONS = {
  device: mapImportDevice,
  browser: mapImportBrowser,
  os: mapImportOs,
  country: mapImportCountry,
  path: sanitizeImportPath,
  host: normalizeImportHost,
};

test.each<[keyof typeof DIMENSIONS, string, string]>([
  ["device", "Laptop", "desktop"],
  ["device", "Mobile", "mobile"],
  ["device", "Tablet", "tablet"],
  ["device", "smart tv", "desktop"],
  ["device", "(not set)", ""],
  ["browser", "Microsoft Edge", "Edge"],
  ["browser", "Samsung Browser", "Samsung Internet"],
  ["browser", "Chromium", "Chrome"],
  ["browser", "Android WebView", "Chrome"],
  ["browser", "Safari (in-app)", "Safari"],
  ["browser", "Vivaldi", "Other"],
  ["browser", "", ""],
  ["os", "Mac", "macOS"],
  ["os", "iPadOS", "iPadOS"],
  ["os", "Chrome OS", "ChromeOS"],
  ["os", "Ubuntu", "Linux"],
  ["os", "FreeBSD", "Other"],
  ["os", "(not set)", ""],
  ["country", "de", "DE"],
  ["country", "ZZ", ""],
  ["country", "Germany", ""],
  ["path", "/pricing?utm_source=x&email=a@b.c", "/pricing"],
  ["path", "/docs#install", "/docs"],
  ["path", "blog/post", "/blog/post"],
  ["path", "https://example.com/a?b=c", "/a"],
  ["path", "", "/"],
  ["host", "https://WWW.Example.com:8080/path", "www.example.com"],
  ["host", "example.com.", "example.com"],
  ["host", "not a host", ""],
  ["host", "localhost", ""],
])("%s %j → %j", (dimension, value, expected) => {
  expect(DIMENSIONS[dimension](value)).toBe(expected);
});

const CONTEXT: ImportRowContext = {
  organizationId: "org",
  projectId: "project",
  siteId: "",
  importId: "imp",
  provider: "plausible_csv",
  host: "example.com",
  importedAt: "2026-11-04 00:00:00",
};
const DAY = "2026-01-02";

describe("rows", () => {
  test("grains only carry their own dimensions and strip query strings", () => {
    expect(
      toWebImportedRow(
        {
          grain: "page",
          day: DAY,
          path: "/a?token=secret",
          country: "DE",
          pageviews: 3,
          visitors: 2,
        },
        CONTEXT
      )
    ).toMatchObject({
      grain: "page",
      host: "example.com",
      path: "/a",
      country: "",
      visits: null,
      pageviews: 3,
      visitors: 2,
    });
  });

  test("source rows keep every UTM parameter, scrubbed like native views; other grains none", () => {
    expect(
      toWebImportedRow(
        {
          grain: "source",
          day: DAY,
          sourceName: "Newsletter",
          utmSource: "Newsletter",
          utmMedium: "Email",
          utmCampaign: "Spring_2026",
          utmTerm: "running shoes",
          utmContent: "550e8400-e29b-41d4-a716-446655440000",
          visits: 3,
          visitors: 2,
        },
        CONTEXT
      )
    ).toMatchObject({
      utm_source: "newsletter",
      utm_medium: "email",
      utm_campaign: "Spring_2026",
      utm_term: "running shoes",
      utm_content: ":id",
    });
    expect(
      toWebImportedRow(
        { grain: "country", day: DAY, country: "DE", utmTerm: "x" },
        CONTEXT
      )
    ).toMatchObject({ utm_term: "", utm_content: "" });
  });

  test("rows that collapse after mapping are summed", () => {
    const rows = aggregateWebRows(
      ["/a?x=1", "/a?x=2"].map((path) =>
        toWebImportedRow(
          { grain: "page", day: DAY, path, pageviews: 2, visitors: 1 },
          CONTEXT
        )
      )
    );
    expect(rows).toEqual([
      expect.objectContaining({ pageviews: 4, visitors: 2, visits: null }),
    ]);
  });

  test("source rows that differ only in UTM term or content stay apart", () => {
    const source = (utmTerm: string, utmContent: string) =>
      toWebImportedRow(
        {
          grain: "source",
          day: DAY,
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "spring",
          utmTerm,
          utmContent,
          visits: 1,
        },
        CONTEXT
      );
    const rows = aggregateWebRows([
      source("shoes", "ad-a"),
      source("boots", "ad-a"),
      source("shoes", "ad-b"),
      source("shoes", "ad-a"),
    ]);
    expect(
      rows.map(({ utm_term, utm_content, visits }) => ({
        utm_term,
        utm_content,
        visits,
      }))
    ).toEqual([
      { utm_term: "shoes", utm_content: "ad-a", visits: 2 },
      { utm_term: "boots", utm_content: "ad-a", visits: 1 },
      { utm_term: "shoes", utm_content: "ad-b", visits: 1 },
    ]);
  });

  test("hosts outside the import's domain are mapped onto it", () => {
    const hostOf = (host: string) =>
      toWebImportedRow(
        { grain: "page", day: DAY, host, pageviews: 1 },
        { ...CONTEXT, allowedHosts: ["example.com"] }
      ).host;
    expect(hostOf("old-domain.test")).toBe("example.com");
    expect(hostOf("docs.example.com")).toBe("docs.example.com");
  });

  const crawler = {
    day: "2026-10-01",
    host: "example.com",
    path: "/",
    verified: true,
    status: 200,
    requests: 10,
    sampleInterval: 10,
    userAgent: "ClaudeBot/1.0",
  };

  test("crawler rows keep AI agents only and drop scanner paths", () => {
    expect(
      toGeoImportedRow(
        {
          ...crawler,
          userAgent:
            "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
        },
        CONTEXT
      )
    ).toMatchObject({
      visitor_type: "crawler",
      source: "GPTBot",
      category: "training-crawler",
      verified: 1,
      requests: 10,
    });
    expect(
      toGeoImportedRow(
        {
          ...crawler,
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
        },
        CONTEXT
      )
    ).toBeNull();
    for (const path of ["/.env", "/wp-login.php", "/terraform.tfvars"]) {
      expect(toGeoImportedRow({ ...crawler, path }, CONTEXT)).toBeNull();
    }
  });

  test("crawler rows for the same page and day merge with a weighted sample rate", () => {
    const row = toGeoImportedRow({ ...crawler, verified: false }, CONTEXT);
    if (!row) {
      throw new Error("row expected");
    }
    const [merged] = aggregateGeoRows([
      row,
      { ...row, requests: 30, sample_interval: 1 },
    ]);
    expect(merged?.requests).toBe(40);
    expect(merged?.sample_interval).toBeCloseTo(3.25);
  });
});
