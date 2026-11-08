import { IMPORT_PROVIDERS } from "@notra/geo-core/constants/analytics-imports";
import { importChunks } from "@notra/geo-core/utils/analytics-import-range";

import type { AnalyticsImportSummary } from "@/types/analytics-imports";
import type {
  ImportProgressRunOptions,
  ImportProgressScenario,
  ImportProgressSimulatedFrame,
} from "@/types/design-system/import-progress";

const BASE: AnalyticsImportSummary = {
  id: "imp_demo",
  projectId: "project_demo",
  provider: "plausible",
  kind: "web",
  sourceLabel: "acme.test",
  host: "acme.test",
  status: "pending",
  startDay: null,
  endDay: null,
  cutoffDay: null,
  chunksTotal: 0,
  chunksDone: 0,
  pageviewsImported: 0,
  rowsWritten: 0,
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
  createdAt: "2026-11-04T14:41:00.000Z",
  completedAt: null,
};

const QUEUED_MS = 1200;
const SETTLE_MS = 1500;
const DELETE_MS = 2400;

/**
 * Builds the frames a real import writes: planned, one chunk at a time
 * (newest first), optionally pausing for a rate limit, stopping or being
 * deleted.
 */
function run({
  chunks,
  stepMs,
  pauseAfter,
  pauseMs = 0,
  failAfter,
  error,
  deleteAfter,
}: ImportProgressRunOptions) {
  const frames: ImportProgressSimulatedFrame[] = [
    { at: 0, patch: { status: "pending" } },
    {
      at: QUEUED_MS,
      patch: { status: "running", chunksTotal: chunks.length },
    },
  ];
  let at = QUEUED_MS;
  let pageviews = 0;
  for (const [index, written] of chunks.entries()) {
    if (failAfter !== undefined && index === failAfter) {
      frames.push({
        at: at + stepMs,
        patch: { status: "failed", lastError: error ?? null },
      });
      return { frames, duration: at + stepMs + SETTLE_MS };
    }
    if (deleteAfter !== undefined && index === deleteAfter) {
      // The list shows it deleting, then drops it; the dialog then marks it deleted.
      frames.push(
        { at: at + stepMs, patch: { status: "deleting" } },
        { at: at + stepMs + DELETE_MS, patch: { status: "deleted" } }
      );
      return { frames, duration: at + stepMs + DELETE_MS + SETTLE_MS };
    }
    at += stepMs;
    pageviews += written;
    frames.push({
      at,
      patch: { chunksDone: index + 1, pageviewsImported: pageviews },
    });
    if (pauseAfter !== undefined && index + 1 === pauseAfter) {
      frames.push({
        at: at + 200,
        patch: { status: "waiting_rate_limit" },
        retryInMs: pauseMs,
      });
      at += 200 + pauseMs;
      frames.push({ at, patch: { status: "running", retryAt: null } });
    }
  }
  frames.push({
    at: at + 300,
    patch: { status: "completed", completedAt: "2026-11-04T14:44:00.000Z" },
  });
  return { frames, duration: at + 300 + SETTLE_MS };
}

/** Page views per month, newest first, for a site that grew over the year. */
const MONTHLY_PAGEVIEWS = [
  9120, 8740, 8410, 8890, 7650, 7210, 6980, 6400, 6120, 5830, 5410, 4980,
];

const vercelRange = { start: "2026-05-01", end: "2026-09-30" };
const vercelChunks = importChunks(
  vercelRange,
  IMPORT_PROVIDERS.vercel.maxChunkDays
).map((_, index) => 1900 - index * 35);

const vercelTwoYears = { start: "2024-10-01", end: "2026-09-30" };
const vercelTwoYearChunks = importChunks(
  vercelTwoYears,
  IMPORT_PROVIDERS.vercel.maxChunkDays
).map((_, index) => 2400 - (index % 9) * 110);

const API_SCENARIO: ImportProgressScenario = {
  id: "api",
  label: "12-month API import",
  note: "Plausible API, one chunk per month, a rate-limit pause after month 5.",
  base: {
    ...BASE,
    startDay: "2025-10-01",
    endDay: "2026-09-30",
    cutoffDay: "2026-10-01",
  },
  ...run({
    chunks: MONTHLY_PAGEVIEWS,
    stepMs: 900,
    pauseAfter: 5,
    pauseMs: 6000,
  }),
};

export const IMPORT_PROGRESS_DEFAULT_SCENARIO = API_SCENARIO;

export const IMPORT_PROGRESS_SCENARIOS: ImportProgressScenario[] = [
  API_SCENARIO,
  {
    id: "csv",
    label: "Single-chunk CSV",
    note: "A Plausible export small enough for one chunk: queued, read, done.",
    base: {
      ...BASE,
      provider: "plausible_csv",
      sourceLabel: "plausible-export-acme.test.zip",
      startDay: "2024-03-12",
      endDay: "2026-09-30",
      cutoffDay: "2026-10-01",
    },
    ...run({ chunks: [184_302], stepMs: 3600 }),
  },
  {
    id: "failure",
    label: "Failure",
    note: "Vercel, one chunk per week; the token loses access after 9 weeks.",
    base: {
      ...BASE,
      provider: "vercel",
      sourceLabel: "acme-web",
      startDay: vercelRange.start,
      endDay: vercelRange.end,
      cutoffDay: "2026-10-01",
      capabilities: { ...BASE.capabilities, visits: false, bounces: false },
    },
    ...run({
      chunks: vercelChunks,
      stepMs: 450,
      failAfter: 9,
      error:
        "Vercel answered 403 Forbidden. Check that the token can still read this project.",
    }),
  },
  {
    id: "crawlers",
    label: "Cloudflare crawler hits",
    note: "Cloudflare's last 31 days of AI crawler hits: two partial months.",
    base: {
      ...BASE,
      provider: "cloudflare",
      kind: "geo",
      sourceLabel: "acme.test zone",
      startDay: "2026-10-05",
      endDay: "2026-11-04",
      cutoffDay: "2026-11-05",
      capabilities: {
        ...BASE.capabilities,
        visitors: false,
        bounces: false,
        utm: false,
        entryPages: false,
        sampled: true,
      },
    },
    ...run({ chunks: [3120, 11_480], stepMs: 1400 }),
  },
  {
    id: "vercel-24",
    label: "24 months of Vercel weeks",
    note: `Vercel, two years in ${vercelTwoYearChunks.length} weekly chunks: too many to draw one by one, so the bar shows a segment per month, filled by the share of its weeks done and striped while one of them runs.`,
    base: {
      ...BASE,
      provider: "vercel",
      sourceLabel: "acme-web",
      startDay: vercelTwoYears.start,
      endDay: vercelTwoYears.end,
      cutoffDay: "2026-10-01",
      capabilities: { ...BASE.capabilities, visits: false, bounces: false },
    },
    ...run({ chunks: vercelTwoYearChunks, stepMs: 160 }),
  },
  {
    id: "deleted",
    label: "Deleted while open",
    note: "Someone deletes the import while its progress is open: it reads as deleting, then deleted, with a way back to the list.",
    base: {
      ...BASE,
      startDay: "2025-10-01",
      endDay: "2026-09-30",
      cutoffDay: "2026-10-01",
    },
    ...run({ chunks: MONTHLY_PAGEVIEWS, stepMs: 700, deleteAfter: 4 }),
  },
];

/** How many of the scenario's frames have landed `elapsed` ms in. */
export function scenarioFrame(
  scenario: ImportProgressScenario,
  elapsed: number
): number {
  return scenario.frames.filter((frame) => frame.at <= elapsed).length;
}

/** The import as it stood `elapsed` ms into the scenario. */
export function scenarioSummary(
  scenario: ImportProgressScenario,
  elapsed: number,
  now: number
): AnalyticsImportSummary {
  let summary = scenario.base;
  for (const frame of scenario.frames) {
    if (frame.at > elapsed) {
      break;
    }
    summary = { ...summary, ...frame.patch };
    if (frame.retryInMs !== undefined) {
      summary.retryAt = new Date(
        now + frame.at + frame.retryInMs - elapsed
      ).toISOString();
    }
  }
  return summary;
}
