import type { AnalyticsImportProvider } from "@notra/db/types/analytics-imports";
import { IMPORT_PROVIDERS } from "@notra/geo-core/constants/analytics-imports";
import { GEO_MAX_RANGE_DAYS } from "@notra/geo-core/constants/geo";
import {
  addDays,
  importChunks,
} from "@notra/geo-core/utils/analytics-import-range";

import {
  ANALYTICS_IMPORT_PROGRESS_PHASES,
  ANALYTICS_IMPORT_REMOVED_PHASES,
} from "@/constants/analytics-import-progress";
import { WEB_ANALYTICS_NAV_LINK } from "@/constants/geo-traffic-pages";
import { GEO_TRAFFIC_NAV_LINK } from "@/constants/nav";
import type {
  AnalyticsImportChunkSegment,
  AnalyticsImportChunkState,
  AnalyticsImportChunkUnit,
  AnalyticsImportProgressModel,
  AnalyticsImportProgressPhase,
  AnalyticsImportProgressContext,
  AnalyticsImportProgressMessage,
  AnalyticsImportProgressPart,
  AnalyticsImportProgressView,
  AnalyticsImportSummary,
  AnalyticsImportViewActions,
  AnalyticsImportViewPlace,
  AnalyticsImportViewTarget,
} from "@/types/analytics-imports";
import type { GeoDateRange } from "@/types/geo";
import { importDayDate } from "@/utils/analytics-imports";
import { formatElapsedSeconds } from "@/utils/format-elapsed-seconds";
import { withGeoProject } from "@/utils/geo-paths";
import { serializeGeoCustomRange } from "@/utils/geo-range";

const DAY_MS = 86_400_000;

function daysBetween(start: string, end: string): number {
  return (
    (importDayDate(end).getTime() - importDayDate(start).getTime()) / DAY_MS + 1
  );
}

function importChunkUnit(
  provider: AnalyticsImportProvider
): AnalyticsImportChunkUnit {
  if (provider === "plausible_csv") {
    return "part";
  }
  const { maxChunkDays } = IMPORT_PROVIDERS[provider];
  if (!maxChunkDays) {
    return "month";
  }
  return maxChunkDays === 7 ? "week" : "batch";
}

/**
 * Days each chunk covers, newest first, as the runner plans them: calendar
 * months for API imports (split into weeks for Vercel), the whole range for a
 * single-part export. Null when the client cannot know the split.
 */
function plannedRanges(item: AnalyticsImportSummary) {
  if (!(item.startDay && item.endDay)) {
    return null;
  }
  const range = { start: item.startDay, end: item.endDay };
  if (item.provider === "plausible_csv") {
    return item.chunksTotal <= 1 ? [range] : null;
  }
  const ranges = importChunks(
    range,
    IMPORT_PROVIDERS[item.provider].maxChunkDays
  );
  // An import planned before a chunking change keeps its own count.
  return item.chunksTotal === 0 || ranges.length === item.chunksTotal
    ? ranges
    : null;
}

function chunkState(
  phase: AnalyticsImportProgressPhase,
  index: number,
  done: number
): AnalyticsImportChunkState {
  // Its rows are gone or going: nothing on the bar is imported any more.
  if (ANALYTICS_IMPORT_REMOVED_PHASES.has(phase)) {
    return "pending";
  }
  if (phase === "completed" || index < done) {
    return "done";
  }
  if (index > done) {
    return "pending";
  }
  if (phase === "failed") {
    return "failed";
  }
  return phase === "queued" ? "pending" : "active";
}

/** Where an import stands, from its real chunk counts; nothing is estimated. */
export function importProgressModel(
  item: AnalyticsImportSummary
): AnalyticsImportProgressModel {
  const phase = ANALYTICS_IMPORT_PROGRESS_PHASES[item.status];
  const ranges = plannedRanges(item);
  const total = Math.max(item.chunksTotal || ranges?.length || 1, 1);
  const done = phase === "completed" ? total : Math.min(item.chunksDone, total);
  const newestFirst: AnalyticsImportChunkSegment[] = Array.from(
    { length: ranges?.length ?? total },
    (_, index) => {
      const range = ranges?.[index];
      return {
        key: range ? range.start : `part-${index}`,
        start: range?.start ?? null,
        end: range?.end ?? null,
        days: range ? daysBetween(range.start, range.end) : 1,
        state: chunkState(phase, index, done),
      };
    }
  );
  return {
    phase,
    unit: importChunkUnit(item.provider),
    segments: newestFirst.toReversed(),
    exact: ranges !== null,
    done,
    total,
    current:
      newestFirst.find(
        (segment) => segment.state === "active" || segment.state === "failed"
      ) ?? null,
  };
}

/**
 * The import the progress view shows: the polled copy once the list has it.
 * One the list had (`lastSeen`) and then dropped was deleted; until the list
 * has it, the copy the start call returned.
 */
export function shownImport(
  started: AnalyticsImportSummary,
  imports: readonly AnalyticsImportSummary[] | undefined,
  lastSeen: AnalyticsImportSummary | null
): AnalyticsImportSummary {
  const listed = imports?.find((entry) => entry.id === started.id);
  if (listed) {
    return listed;
  }
  if (lastSeen?.id !== started.id) {
    return started;
  }
  return imports ? { ...lastSeen, status: "deleted" } : lastSeen;
}

/** Whether a chunk is one whole calendar month, so it reads as "September 2026". */
export function isWholeMonth(start: string, end: string): boolean {
  return (
    start.endsWith("-01") &&
    start.slice(0, 7) === end.slice(0, 7) &&
    addDays(end, 1).endsWith("-01")
  );
}

/** Whole seconds until `retryAt`, never below zero. */
export function secondsUntil(retryAt: string | null, now: number): number {
  if (!retryAt) {
    return 0;
  }
  return Math.max(0, Math.ceil((Date.parse(retryAt) - now) / 1000));
}

/**
 * The analytics range that shows an import: null when `range` already covers
 * its days, otherwise its first day through today, no longer than the charts
 * allow.
 */
export function rangeCoveringImport(
  range: GeoDateRange,
  item: Pick<AnalyticsImportSummary, "startDay" | "endDay">,
  today: string
): GeoDateRange | null {
  if (!(item.startDay && item.endDay)) {
    return null;
  }
  if (range.dateFrom <= item.startDay && range.dateTo >= item.endDay) {
    return null;
  }
  const earliest = addDays(today, 1 - GEO_MAX_RANGE_DAYS);
  return {
    dateFrom: item.startDay < earliest ? earliest : item.startDay,
    dateTo: today,
  };
}

/**
 * Where "View analytics" shows an import: crawler hits in AI analytics, page
 * views in Web analytics. On that page already, only the range widens.
 */
export function importedAnalyticsTarget(
  item: Pick<
    AnalyticsImportSummary,
    "kind" | "projectId" | "startDay" | "endDay"
  >,
  where: AnalyticsImportViewPlace
): AnalyticsImportViewTarget {
  const covering = rangeCoveringImport(where.range, item, where.today);
  const page = `/${where.slug}${
    item.kind === "geo" ? GEO_TRAFFIC_NAV_LINK : WEB_ANALYTICS_NAV_LINK
  }`;
  const pathname = where.pathname.replace(/\/+$/, "");
  // AI analytics' path is the start of Web analytics' and MCP's, so only an exact match counts.
  const onPage =
    item.kind === "geo"
      ? pathname === page
      : pathname === page || pathname.startsWith(`${page}/`);
  if (onPage) {
    return { mode: "inPlace", range: covering };
  }
  const range = covering ? serializeGeoCustomRange(covering) : where.rangeParam;
  return {
    mode: "navigate",
    href: withGeoProject(
      range ? `${page}?range=${range}` : page,
      item.projectId
    ),
  };
}

/** Shows an import where its data lands: navigates there, or widens the range in place. */
export function viewImportedAnalytics(
  item: Pick<
    AnalyticsImportSummary,
    "kind" | "projectId" | "startDay" | "endDay"
  >,
  where: AnalyticsImportViewPlace,
  actions: AnalyticsImportViewActions
): void {
  const target = importedAnalyticsTarget(item, where);
  if (target.mode === "navigate") {
    actions.push(target.href);
    return;
  }
  if (target.range) {
    actions.setRange(target.range);
  }
  actions.closeSettings?.();
}

/**
 * What the progress view shows in each phase: the octopus sways while an
 * import waits or runs and cheers when it's done; a stopped or deleted one
 * gets an icon. Long imports name the chunk they're on in the subtext.
 */
export function importProgressView(
  item: Pick<
    AnalyticsImportSummary,
    "kind" | "waitingFor" | "pageviewsImported" | "lastError"
  >,
  model: Pick<
    AnalyticsImportProgressModel,
    "phase" | "unit" | "done" | "total"
  >,
  {
    period,
    provider,
    seconds,
    startDate,
    endDate,
  }: AnalyticsImportProgressContext
): AnalyticsImportProgressView {
  const importing: AnalyticsImportProgressMessage = {
    key: "importing",
    values: { kind: item.kind },
  };
  const range: AnalyticsImportProgressMessage[] =
    startDate && endDate
      ? [{ key: "period", values: { start: startDate, end: endDate } }]
      : [];
  const view = (
    detail: AnalyticsImportProgressPart[],
    title = importing
  ): AnalyticsImportProgressView => ({
    mascot: "sway",
    icon: null,
    title,
    detail,
    showError: false,
  });
  switch (model.phase) {
    case "queued":
      return view([
        item.waitingFor
          ? { key: "queuedBehind", values: { source: item.waitingFor } }
          : { key: "queuedLine", values: {} },
      ]);
    case "waiting":
      return view([
        seconds > 0
          ? {
              key: "waitingLine",
              values: { provider, time: formatElapsedSeconds(seconds) },
            }
          : { key: "waitingSoon", values: { provider } },
      ]);
    case "running": {
      // An export is one file: its days say enough.
      if (model.unit === "part") {
        return view(range);
      }
      const chunks: AnalyticsImportProgressMessage = {
        key: `chunks.${model.unit}`,
        values: {
          done: Math.min(model.done + 1, model.total),
          total: model.total,
        },
      };
      return view(period ? [{ text: period }, chunks] : [chunks]);
    }
    case "completed":
      return {
        ...view(
          startDate
            ? [{ key: "completedLine", values: { date: startDate } }]
            : [],
          {
            key: item.kind === "geo" ? "importedRequests" : "importedPageviews",
            values: { count: item.pageviewsImported },
          }
        ),
        mascot: "cheer",
      };
    case "deleting":
    case "deleted":
      return {
        mascot: null,
        icon: "deleted",
        title: {
          key: model.phase === "deleting" ? "deletingLine" : "deletedLine",
          values: {},
        },
        detail: [],
        showError: false,
      };
    default:
      return {
        mascot: null,
        icon: "stopped",
        title: { key: "stopped", values: {} },
        detail: item.lastError
          ? []
          : [
              period
                ? { key: "failedLine", values: { period } }
                : { key: "failedAny", values: {} },
            ],
        showError: Boolean(item.lastError),
      };
  }
}
