import { describe, expect, test } from "bun:test";

import {
  importHostScope,
  importHostScopesOverlap,
  providerHostScope,
} from "../src/utils/analytics-import-host";
import {
  importChunks,
  importCutoffDay,
  monthChunks,
  pageviewsInRange,
  resolveImportRange,
  sharedDays,
  weightedChunks,
} from "../src/utils/analytics-import-range";

test("the earliest native day is the cut-off and 1970 means no data", () => {
  expect(
    importCutoffDay(["2026-03-10", "1970-01-01", "2026-02-01"], "2026-11-04")
  ).toBe("2026-02-01");
  expect(importCutoffDay(["1970-01-01", null], "2026-11-04")).toBe(
    "2026-11-04"
  );
});

describe("range", () => {
  const base = {
    requestedStart: null,
    requestedEnd: null,
    earliestDay: "2024-01-01",
    cutoffDay: "2026-03-10",
    covered: [],
  };

  test.each([
    [
      "ends the day before native tracking starts",
      {},
      { start: "2024-01-01", end: "2026-03-09" },
    ],
    [
      "clips requests to retention and the cut-off",
      { requestedStart: "2023-01-01", requestedEnd: "2027-01-01" },
      { start: "2024-01-01", end: "2026-03-09" },
    ],
    [
      "skips days another import covers at the end",
      { covered: [{ start: "2025-06-01", end: "2026-03-09" }] },
      { start: "2024-01-01", end: "2025-05-31" },
    ],
    [
      "keeps the newest stretch around a covered middle",
      { covered: [{ start: "2025-01-01", end: "2025-06-30" }] },
      { start: "2025-07-01", end: "2026-03-09" },
    ],
    [
      "is empty when fully covered",
      { covered: [{ start: "2023-01-01", end: "2026-12-31" }] },
      null,
    ],
    [
      "is empty when nothing precedes the cut-off",
      { earliestDay: "2026-03-10" },
      null,
    ],
  ])("an import range %s", (_label, overrides, expected) => {
    expect(resolveImportRange({ ...base, ...overrides })).toEqual(expected);
  });

  test("overlaps keep only the days another import shares with the range", () => {
    expect(
      sharedDays({ start: "2026-08-01", end: "2026-09-30" }, [
        { id: "a", start: "2026-07-01", end: "2026-08-15" },
        { id: "b", start: "2026-09-10", end: "2026-12-31" },
        { id: "c", start: "2026-01-01", end: "2026-07-31" },
      ])
    ).toEqual([
      { id: "a", start: "2026-08-01", end: "2026-08-15" },
      { id: "b", start: "2026-09-10", end: "2026-09-30" },
    ]);
  });

  test("chunks run newest first, by month or by budget, never crossing a month", () => {
    const range = { start: "2026-01-15", end: "2026-03-09" };
    expect(monthChunks(range)).toEqual([
      { start: "2026-03-01", end: "2026-03-09" },
      { start: "2026-02-01", end: "2026-02-28" },
      { start: "2026-01-15", end: "2026-01-31" },
    ]);
    expect(importChunks(range)).toEqual(monthChunks(range));
    expect(importChunks({ start: "2026-02-25", end: "2026-03-09" }, 7)).toEqual(
      [
        { start: "2026-03-03", end: "2026-03-09" },
        { start: "2026-03-01", end: "2026-03-02" },
        { start: "2026-02-25", end: "2026-02-28" },
      ]
    );
  });

  test("weighted chunks cut at day boundaries, newest first, so no chunk passes the limit", () => {
    expect(
      weightedChunks(
        { start: "2026-01-01", end: "2026-01-06" },
        {
          "2026-01-01": 4,
          "2026-01-02": 4,
          "2026-01-04": 9,
          "2026-01-05": 3,
          "2026-01-06": 3,
        },
        8
      )
    ).toEqual([
      { start: "2026-01-05", end: "2026-01-06" },
      { start: "2026-01-04", end: "2026-01-04" },
      { start: "2026-01-01", end: "2026-01-03" },
    ]);
    expect(
      weightedChunks({ start: "2026-01-01", end: "2026-03-31" }, {}, 10)
    ).toEqual([{ start: "2026-01-01", end: "2026-03-31" }]);
  });

  test("page views in a range sum its days and count partial months pro rata", () => {
    const days = { "2026-07-31": 1, "2026-08-01": 10, "2026-08-31": 20 };
    expect(
      pageviewsInRange(
        days,
        { start: "2026-08-01", end: "2026-08-31" },
        "2026-11-10"
      )
    ).toBe(30);
    expect(
      pageviewsInRange(
        days,
        { start: "2026-09-01", end: "2026-09-30" },
        "2026-11-10"
      )
    ).toBe(0);
    const months = { "2026-02": 280, "2026-03": 310 };
    // All of February (28 days) and 10 of March's 31 days.
    expect(
      pageviewsInRange(
        months,
        { start: "2026-02-01", end: "2026-03-10" },
        "2026-11-10"
      )
    ).toBe(380);
    expect(
      pageviewsInRange(
        months,
        { start: "2026-02-15", end: "2026-02-15" },
        "2026-11-10"
      )
    ).toBe(10);
    // November so far has 10 days, so 9 of them hold 9/10 of its count.
    expect(
      pageviewsInRange(
        { "2026-11": 4550 },
        { start: "2026-11-01", end: "2026-11-09" },
        "2026-11-10"
      )
    ).toBe(4095);
  });
});

test("an import's host scope covers the host, the www alias and subdomains", () => {
  const wide = (host: string) => ({ host, subdomains: true });
  expect(importHostScope("www.example.com")).toBe("example.com");
  for (const other of ["example.com", "www.example.com", "docs.example.com"]) {
    expect(importHostScopesOverlap(wide("example.com"), wide(other))).toBe(
      true
    );
    expect(importHostScopesOverlap(wide(other), wide("www.example.com"))).toBe(
      true
    );
  }
  expect(
    importHostScopesOverlap(wide("docs.example.com"), wide("blog.example.com"))
  ).toBe(false);
  expect(
    importHostScopesOverlap(wide("example.com"), wide("notexample.com"))
  ).toBe(false);
});

test("Vercel projects on a domain and its subdomain don't overlap", () => {
  const vercel = (host: string) => providerHostScope("vercel", host);
  expect(
    importHostScopesOverlap(vercel("example.com"), vercel("docs.example.com"))
  ).toBe(false);
  expect(
    importHostScopesOverlap(vercel("www.example.com"), vercel("example.com"))
  ).toBe(true);
  // A Plausible import of the domain can still write the subdomain's rows.
  expect(
    importHostScopesOverlap(
      providerHostScope("plausible", "example.com"),
      vercel("docs.example.com")
    )
  ).toBe(true);
});
