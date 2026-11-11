import { describe, expect, test } from "bun:test";

import { ANALYTICS_IMPORT_BUDGET_WAIT } from "../src/constants/analytics-imports";
import type { AnalyticsImportSummary } from "../src/types/analytics-imports";
import {
  importedAnalyticsTarget,
  importProgressModel,
  importProgressView,
  isWholeMonth,
  rangeCoveringImport,
  secondsUntil,
  shownImport,
  viewImportedAnalytics,
} from "../src/utils/analytics-import-progress";
import { importSpan, zipRejectionReason } from "../src/utils/analytics-imports";

const base: AnalyticsImportSummary = {
  id: "imp_1",
  projectId: "project",
  provider: "plausible",
  kind: "web",
  sourceLabel: "example.com",
  host: "example.com",
  status: "running",
  startDay: "2026-07-12",
  endDay: "2026-09-30",
  cutoffDay: "2026-10-01",
  chunksTotal: 3,
  chunksDone: 1,
  pageviewsImported: 900,
  rowsWritten: 10,
  capabilities: {
    visitors: true,
    visits: true,
    bounces: true,
    utm: true,
    entryPages: true,
    sampled: false,
  },
  lastError: null,
  retryAt: null,
  waitingFor: null,
  createdAt: "2026-11-04T00:00:00.000Z",
  completedAt: null,
};

describe("importProgressModel", () => {
  test("API imports show one segment per month, oldest first, filled from the newest", () => {
    const model = importProgressModel(base);
    expect(model).toMatchObject({ unit: "month", exact: true });
    expect(
      model.segments.map(({ start, end, days, state }) => [
        start,
        end,
        days,
        state,
      ])
    ).toEqual([
      ["2026-07-12", "2026-07-31", 20, "pending"],
      ["2026-08-01", "2026-08-31", 31, "active"],
      ["2026-09-01", "2026-09-30", 30, "done"],
    ]);
    expect(model.current?.start).toBe("2026-08-01");
  });

  test.each([
    ["queued", { status: "pending", chunksTotal: 0, chunksDone: 0 }, "ppp"],
    ["failed", { status: "failed" }, "pfd"],
    ["completed", { status: "completed" }, "ddd"],
    ["deleting", { status: "deleting" }, "ppp"],
    ["deleted", { status: "deleted" }, "ppp"],
  ] as const)("a %s import", (_name, overrides, states) => {
    const model = importProgressModel({ ...base, ...overrides });
    const letter = { pending: "p", failed: "f", done: "d", active: "a" };
    expect(model.segments.map(({ state }) => letter[state]).join("")).toBe(
      states
    );
    if (overrides.status !== "failed") {
      expect(model.current).toBeNull();
    }
  });

  test("Vercel imports run in weeks; a multi-part export has parts without days", () => {
    const vercel = importProgressModel({
      ...base,
      provider: "vercel",
      startDay: "2026-09-01",
      endDay: "2026-09-30",
      chunksTotal: 5,
      chunksDone: 0,
    });
    expect(vercel.unit).toBe("week");
    expect(vercel.segments.map(({ days }) => days)).toEqual([2, 7, 7, 7, 7]);
    const csv = importProgressModel({
      ...base,
      provider: "plausible_csv",
      chunksDone: 2,
    });
    expect(csv).toMatchObject({ unit: "part", exact: false });
    expect(csv.segments.map(({ state }) => state)).toEqual([
      "active",
      "done",
      "done",
    ]);
  });
});

test("shownImport prefers the polled copy and reads a dropped import as deleted", () => {
  const polled = { ...base, chunksDone: 2 };
  expect(shownImport(base, [polled], null)).toBe(polled);
  expect(shownImport(base, [], null)).toBe(base);
  expect(shownImport(base, [], polled)).toEqual({
    ...polled,
    status: "deleted",
  });
  // While the list is loading again, nothing is concluded.
  expect(shownImport(base, undefined, polled)).toBe(polled);
  expect(shownImport(base, [], { ...polled, id: "imp_other" })).toBe(base);
});

describe("View analytics", () => {
  const where = {
    slug: "acme",
    pathname: "/acme/geo/overview",
    range: { dateFrom: "2026-10-09", dateTo: "2026-11-07" },
    rangeParam: null,
    today: "2026-11-07",
  };
  const web = { ...base, startDay: "2026-08-01", endDay: "2026-09-30" };
  const crawlers = {
    ...web,
    kind: "geo" as const,
    provider: "cloudflare" as const,
  };
  const wide = { dateFrom: "2026-01-01", dateTo: "2026-11-07" };

  test("opens the import's analytics page, widened to the import", () => {
    expect(importedAnalyticsTarget(web, where)).toEqual({
      mode: "navigate",
      href: "/acme/geo/traffic/web?range=custom_2026-08-01_2026-11-07&project=project",
    });
    expect(importedAnalyticsTarget(crawlers, where)).toEqual({
      mode: "navigate",
      href: "/acme/geo/traffic?range=custom_2026-08-01_2026-11-07&project=project",
    });
    expect(
      importedAnalyticsTarget(crawlers, {
        ...where,
        pathname: "/acme/geo/traffic/web",
      }).mode
    ).toBe("navigate");
    // A range that already covers the import is kept.
    expect(
      importedAnalyticsTarget(web, { ...where, range: wide, rangeParam: "12m" })
    ).toEqual({
      mode: "navigate",
      href: "/acme/geo/traffic/web?range=12m&project=project",
    });
  });

  test("on the right page, widens the range in place and closes Settings", () => {
    const done: string[] = [];
    const actions = {
      push: (href: string) => done.push(`push ${href}`),
      setRange: (range: { dateFrom: string; dateTo: string }) =>
        done.push(`range ${range.dateFrom}..${range.dateTo}`),
      closeSettings: () => done.push("close settings"),
    };
    viewImportedAnalytics(
      crawlers,
      { ...where, pathname: "/acme/geo/traffic" },
      actions
    );
    expect(done).toEqual(["range 2026-08-01..2026-11-07", "close settings"]);

    // Settings closed already and the range covers the import: nothing to do.
    done.length = 0;
    const { closeSettings: _closed, ...withoutSettings } = actions;
    viewImportedAnalytics(
      web,
      { ...where, pathname: "/acme/geo/traffic/web", range: wide },
      withoutSettings
    );
    expect(done).toEqual([]);
  });

  test.each([
    ["keeps a range that shows the whole import", "2026-07-01", {}, null],
    [
      "widens a recent range back to the import's first day",
      "2026-10-09",
      {},
      "2026-08-01",
    ],
    [
      "stops at the longest range the charts allow",
      "2026-10-09",
      { startDay: "2023-03-01" },
      "2025-11-07",
    ],
    [
      "leaves the range alone when the import has no days",
      "2026-10-09",
      { startDay: null, endDay: null },
      null,
    ],
  ] as const)("rangeCoveringImport %s", (_name, dateFrom, days, widened) => {
    const today = "2026-11-07";
    expect(
      rangeCoveringImport(
        { dateFrom, dateTo: today },
        { startDay: "2026-08-01", endDay: "2026-09-30", ...days },
        today
      )
    ).toEqual(widened ? { dateFrom: widened, dateTo: today } : null);
  });
});

test("small helpers: ZIP rejections, whole months, spans and countdowns", () => {
  const rejection = (...codes: string[]) =>
    zipRejectionReason(codes.map((code) => ({ errors: [{ code }] })));
  expect(rejection("too-many-files", "too-many-files")).toBe("tooManyFiles");
  expect(rejection("file-too-large")).toBe("rejected");
  expect(rejection("file-invalid-type")).toBe("rejected");
  expect(isWholeMonth("2026-02-01", "2026-02-28")).toBe(true);
  expect(isWholeMonth("2026-07-12", "2026-07-31")).toBe(false);
  expect(importSpan("2026-11-08", "2026-11-08")).toEqual({
    unit: "days",
    count: 1,
  });
  expect(importSpan("2026-10-09", "2026-11-08")).toEqual({
    unit: "days",
    count: 31,
  });
  expect(importSpan("2026-07-10", "2026-11-06")).toEqual({
    unit: "months",
    count: 4,
  });
  expect(importSpan("2024-11-09", "2026-11-08")).toEqual({
    unit: "months",
    count: 24,
  });
  expect(secondsUntil(null, 0)).toBe(0);
  expect(secondsUntil("1970-01-01T00:00:41.200Z", 0)).toBe(42);
  expect(secondsUntil("1970-01-01T00:00:01.000Z", 5000)).toBe(0);
});

describe("importProgressView", () => {
  const ctx: Parameters<typeof importProgressView>[2] = {
    period: "June 2026",
    provider: "Vercel",
    seconds: 0,
    startDate: "Aug 1, 2026",
    endDate: "Sep 30, 2026",
  };
  const item: Parameters<typeof importProgressView>[0] = {
    kind: "web",
    waitingFor: null,
    pageviewsImported: 6619,
    lastError: null,
  };
  const model = (
    phase: Parameters<typeof importProgressView>[1]["phase"],
    unit: "month" | "week" | "part" = "month"
  ) => ({ phase, unit, done: 2, total: 12 });

  test("a running, queued or paused import sways and says what it's doing", () => {
    expect(importProgressView(item, model("running"), ctx)).toEqual({
      mascot: "sway",
      icon: null,
      title: { key: "importing", values: { kind: "web" } },
      detail: [
        { text: "June 2026" },
        { key: "chunks.month", values: { done: 3, total: 12 } },
      ],
      showError: false,
    });
    // An export is one file: its days are enough.
    expect(
      importProgressView(item, model("running", "part"), ctx).detail
    ).toEqual([
      { key: "period", values: { start: "Aug 1, 2026", end: "Sep 30, 2026" } },
    ]);
    const queued = importProgressView(
      { ...item, waitingFor: "marketing" },
      model("queued"),
      ctx
    );
    expect(queued).toMatchObject({
      mascot: "sway",
      detail: [{ key: "queuedBehind", values: { source: "marketing" } }],
    });
    expect(
      importProgressView(item, model("waiting"), { ...ctx, seconds: 75 }).detail
    ).toEqual([
      { key: "waitingLine", values: { provider: "Vercel", time: "1m 15s" } },
    ]);
  });

  test("a pause for Notra's own request budget never blames the provider", () => {
    const budget = { ...item, lastError: ANALYTICS_IMPORT_BUDGET_WAIT };
    expect(
      importProgressView(budget, model("waiting"), { ...ctx, seconds: 75 })
        .detail
    ).toEqual([
      {
        key: "waitingBudgetLine",
        values: { provider: "Vercel", time: "1m 15s" },
      },
    ]);
    expect(importProgressView(budget, model("waiting"), ctx).detail).toEqual([
      { key: "waitingBudgetSoon", values: { provider: "Vercel" } },
    ]);
    expect(importProgressView(item, model("waiting"), ctx).detail).toEqual([
      { key: "waitingSoon", values: { provider: "Vercel" } },
    ]);
  });

  test("a finished import cheers; a stopped or deleted one gets an icon", () => {
    expect(importProgressView(item, model("completed"), ctx)).toMatchObject({
      mascot: "cheer",
      title: { key: "importedPageviews", values: { count: 6619 } },
    });
    expect(
      importProgressView({ ...item, kind: "geo" }, model("completed"), ctx)
        .title.key
    ).toBe("importedRequests");
    expect(importProgressView(item, model("failed"), ctx)).toMatchObject({
      mascot: null,
      icon: "stopped",
      detail: [{ key: "failedLine", values: { period: "June 2026" } }],
      showError: false,
    });
    expect(
      importProgressView({ ...item, lastError: "boom" }, model("failed"), ctx)
    ).toMatchObject({ detail: [], showError: true });
    expect(importProgressView(item, model("deleted"), ctx)).toMatchObject({
      mascot: null,
      icon: "deleted",
    });
  });
});
