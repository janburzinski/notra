import { describe, expect, test } from "bun:test";

import { GEO_MAX_RANGE_DAYS } from "@notra/geo-core/constants/geo";
import type { WebAnalyticsResponse } from "@notra/geo-core/types/geo";
import { trafficSparklineDays } from "@notra/geo-core/utils/ai-traffic";

import { WEB_TABLE_EMPTY_HEIGHT } from "@/constants/web-analytics";

import {
  buildWebTrendRows,
  formatWebVital,
  formatWebVitalRangeStart,
  hasPreviousWebPeriod,
  hasWebAnalytics,
  importStartMarker,
  languageFlagCountry,
  webSourceName,
  webTableHeight,
  webVitalParts,
  webVitalRating,
  withWebBreakdowns,
} from "./web-analytics";

test.each([
  [undefined, undefined],
  ["2026-10-01", "2026-10-04"],
  ["invalid", "2026-10-04"],
  ["2026-10-04", "2026-10-01"],
  ["2020-01-01", "2030-01-01"],
] as const)(
  "web day inputs preserve the old synthetic domain for %s/%s",
  (from, to) => {
    const web = [
      { day: "2026-10-01 12:00:00", views: 3, visitors: 2 },
      { day: "2026-10-01", views: 2, visitors: 1 },
    ];
    const ai = [
      {
        day: "2026-10-03",
        visitorType: "crawler" as const,
        source: "openai",
        visits: 7,
      },
      {
        day: "2026-10-04",
        visitorType: "ai_referral" as const,
        source: "openai",
        visits: 9,
      },
    ];
    for (const webPoints of [[], web]) {
      for (const aiPoints of [[], ai]) {
        const oldDays = trafficSparklineDays(
          [
            ...aiPoints,
            ...webPoints.map((point) => ({
              day: point.day,
              visitorType: "human" as const,
              source: "",
              visits: point.views,
            })),
          ],
          from,
          to
        );
        const rows = buildWebTrendRows(webPoints, aiPoints, "de", from, to);
        expect(rows.map((row) => row.rawDay)).toEqual(oldDays);
        expect(rows.length).toBeLessThanOrEqual(GEO_MAX_RANGE_DAYS);
        for (const row of rows) {
          expect(row.people).toBe(
            webPoints.length && row.rawDay === "2026-10-01" ? 5 : 0
          );
          expect(row.agents).toBe(
            aiPoints.length && row.rawDay === "2026-10-03" ? 7 : 0
          );
        }
      }
    }
  }
);

function analytics(views: number): WebAnalyticsResponse {
  return {
    configured: true,
    hosts: [{ host: "example.com", siteId: "", views: 10 }],
    totals: {
      views,
      previousViews: 10,
      visitors: views,
      previousVisitors: 10,
      sessions: views,
      previousSessions: 10,
      engagedSessions: 0,
      aiVisitors: 0,
      previousAiVisitors: 0,
    },
    points: [],
    pages: [],
    sources: [],
    countries: [],
    devices: [],
    outcomes: [],
  };
}

test("visitor statistics appear only with views in the selected scope", () => {
  expect(hasWebAnalytics(undefined)).toBe(false);
  expect(hasWebAnalytics(analytics(0))).toBe(false);
  expect(hasWebAnalytics(analytics(1))).toBe(true);
});

test("comparisons need page views in the previous period", () => {
  const firstPeriod = analytics(5);
  firstPeriod.totals.previousViews = 0;
  expect(hasPreviousWebPeriod(undefined)).toBe(false);
  expect(hasPreviousWebPeriod(firstPeriod)).toBe(false);
  expect(hasPreviousWebPeriod(analytics(5))).toBe(true);
});

test("empty visitor tables leave room for the default empty state", () => {
  expect(webTableHeight(0)).toBe(WEB_TABLE_EMPTY_HEIGHT);
  expect(webTableHeight(1)).toBe(176);
  expect(webTableHeight(8)).toBe(396);
});

test("unlisted referrer names never resolve through the object prototype", () => {
  for (const source of ["constructor", "__proto__", "toString"]) {
    expect(
      webSourceName(
        {
          group: "other",
          source,
          aiProduct: "",
          sessions: 1,
          previousSessions: 0,
          visitors: 1,
        },
        "Direct"
      )
    ).toBe(source);
  }
});

describe("importStartMarker", () => {
  const rows = buildWebTrendRows(
    [
      { day: "2026-09-30", views: 4, visitors: 3 },
      { day: "2026-10-01", views: 2, visitors: 2 },
    ],
    [],
    "en",
    "2026-09-29",
    "2026-10-02"
  );

  test.each([
    ["the first day Notra tracked", "2026-09-29", "2026-10-01", 2],
    ["the day after the import", "2026-09-30", null, 2],
    ["nothing when the import ends outside the chart", "2026-12-01", null, -1],
  ])("marks %s", (_name, until, nativeStart, index) => {
    const marker = importStartMarker(rows, {
      provider: "vercel",
      until,
      nativeStart,
    });
    expect(marker).toEqual(
      index < 0 ? null : { day: rows[index]?.day ?? "", provider: "vercel" }
    );
  });

  test("stays off without an import", () => {
    expect(importStartMarker(rows, null)).toBeNull();
  });
});

test("web vitals use Google's p75 thresholds, inclusive at the good end", () => {
  expect(webVitalRating("lcp", 2500)).toBe("good");
  expect(webVitalRating("lcp", 2501)).toBe("needs-improvement");
  expect(webVitalRating("lcp", 4001)).toBe("poor");
  expect(webVitalRating("cls", 100)).toBe("good");
  expect(webVitalRating("cls", 260)).toBe("poor");
});

test("web vitals read as ms, s or a unitless CLS score, naming a band's unit once", () => {
  expect(formatWebVital("inp", 240, "en")).toBe("240ms");
  expect(formatWebVital("lcp", 1840, "en")).toBe("1.8s");
  expect(formatWebVital("cls", 14, "de")).toBe("0,01");
  expect(webVitalParts("lcp", 2280, "en")).toEqual({
    number: "2.3",
    unit: "s",
  });
  expect(webVitalParts("cls", 56, "en")).toEqual({ number: "0.06", unit: "" });
  expect(formatWebVitalRangeStart("lcp", 2500, 4000, "en")).toBe("2.5");
  expect(formatWebVitalRangeStart("ttfb", 800, 1800, "en")).toBe("800ms");
});

test("languages map to their country of origin, unknown ones to none", () => {
  expect(languageFlagCountry("en")).toBe("GB");
  expect(languageFlagCountry("PT")).toBe("PT");
  expect(languageFlagCountry("qq")).toBeUndefined();
  expect(languageFlagCountry("constructor")).toBeUndefined();
});

test("breakdowns carry the notra.js reports onto the summary", () => {
  const summary = analytics(1);
  const script = {
    outboundLinks: [],
    vitals: [],
    vitalsByDevice: { mobile: [], desktop: [] },
    errors: [],
    languages: [],
  };
  expect(withWebBreakdowns(summary, { ...summary, script })?.script).toBe(
    script
  );
  expect(withWebBreakdowns(summary, summary)).not.toHaveProperty("script");
});
