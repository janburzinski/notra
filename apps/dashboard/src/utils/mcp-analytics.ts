import type {
  McpAnalyticsDay,
  McpAnalyticsRequest,
  McpAnalyticsResponse,
  McpAnalyticsSession,
  McpSessionEvent,
  McpToolNeighbor,
} from "@notra/geo-core/types/mcp-analytics";
import {
  trafficDayKey,
  trafficSparklineDays,
} from "@notra/geo-core/utils/ai-traffic";
import { formatDayLabel } from "@notra/geo-core/utils/day-label";

import {
  MCP_AXIS_MAX_STEPS,
  MCP_AXIS_NICE_STEPS,
  type MCP_ELICITATION_OUTCOME_VARIANTS,
  MCP_HOUR_MS,
  MCP_HOURS_PER_DAY,
  MCP_METRIC_SERIES_KEY,
  MCP_TABLE_EMPTY_HEIGHT,
  MCP_TABLE_MAX_ROWS,
} from "@/constants/mcp-analytics";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import type {
  McpAxisScale,
  McpChartMetric,
  McpNeighborRow,
  McpSessionAverages,
  McpTrendRow,
} from "@/types/mcp-analytics";

export function percentChange(current: number, previous: number): number {
  return previous === 0 ? 0 : ((current - previous) / previous) * 100;
}

export function errorRate(errors: number, requests: number): number {
  return requests === 0 ? 0 : (errors / requests) * 100;
}

export function prettyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function sessionDurationSeconds(startedAt: string, endedAt: string) {
  return Math.max(
    0,
    Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000)
  );
}

export function acceptRate(accepted: number, requests: number): number {
  return requests > 0 ? (accepted / requests) * 100 : 0;
}

export function elicitationOutcome(
  value: string | undefined
): keyof typeof MCP_ELICITATION_OUTCOME_VARIANTS | null {
  if (value === "accept" || value === "decline" || value === "cancel") {
    return value;
  }
  return null;
}

/** One day's or hour's totals, whichever the chart is bucketing by. */
interface McpBucket {
  toolsCall: number;
  requests: number;
  errors: number;
  sessions: number;
  p95Ms: number;
}

function mcpMetricValue(
  metric: McpChartMetric,
  bucket: McpBucket | undefined
): number {
  if (metric === "toolCalls") {
    return bucket?.toolsCall ?? 0;
  }
  if (metric === "sessions") {
    return bucket?.sessions ?? 0;
  }
  // Buckets without requests sit on the zero line like every other metric.
  if (metric === "p95Latency") {
    return bucket?.p95Ms ?? 0;
  }
  return errorRate(bucket?.errors ?? 0, bucket?.requests ?? 0);
}

function dayBucket(day: McpAnalyticsDay): McpBucket {
  return {
    toolsCall: day.toolsCall,
    requests: day.toolsCall + day.resourcesRead + day.promptsGet + day.other,
    errors: day.errors,
    sessions: day.sessions,
    p95Ms: day.p95Ms,
  };
}

/** The UTC hours of `day`, stopping at the current hour when `day` is today. */
function mcpDayHours(day: string, now: Date): string[] {
  const start = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(start)) {
    return [];
  }
  const hours: string[] = [];
  for (let hour = 0; hour < MCP_HOURS_PER_DAY; hour += 1) {
    const time = start + hour * MCP_HOUR_MS;
    if (time > now.getTime()) {
      break;
    }
    hours.push(new Date(time).toISOString());
  }
  return hours;
}

/**
 * One row per day of the range with the metric under `value`. A single-day
 * range has one daily point and no line, so it charts by hour instead.
 */
export function buildMcpMetricRows(
  data: Pick<McpAnalyticsResponse, "daily" | "hourly">,
  metric: McpChartMetric,
  locale: string,
  range: { from?: string; to?: string },
  now = new Date()
): McpTrendRow[] {
  if (range.from && range.from === range.to) {
    const byHour = new Map(
      data.hourly.map((row) => [new Date(row.hour).toISOString(), row])
    );
    const label = new Intl.DateTimeFormat(locale, { hour: "numeric" });
    return mcpDayHours(range.from, now).map((hour) => ({
      day: label.format(new Date(hour)),
      rawDay: hour,
      [MCP_METRIC_SERIES_KEY]: mcpMetricValue(metric, byHour.get(hour)),
    }));
  }
  const byDay = new Map(data.daily.map((row) => [trafficDayKey(row.day), row]));
  const observed =
    data.daily.length > 0 ? data.daily : [{ day: range.from ?? "" }];
  return trafficSparklineDays(observed, range.from, range.to)
    .filter(Boolean)
    .map((day) => {
      const row = byDay.get(day);
      return {
        day: formatDayLabel(day, locale),
        rawDay: day,
        [MCP_METRIC_SERIES_KEY]: mcpMetricValue(
          metric,
          row ? dayBucket(row) : undefined
        ),
      };
    });
}

/**
 * A y axis with at most `MCP_AXIS_MAX_STEPS` evenly spaced, distinct ticks.
 * Counts step in whole numbers; `decimals` is what a tick label needs to show.
 */
export function mcpAxisScale(
  values: readonly number[],
  wholeNumbers: boolean
): McpAxisScale {
  const peak = Math.max(0, ...values);
  if (peak === 0) {
    return { max: 1, interval: 1, decimals: 0 };
  }
  const raw = peak / MCP_AXIS_MAX_STEPS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    MCP_AXIS_NICE_STEPS.map((factor) => factor * magnitude).find(
      (candidate) =>
        candidate >= raw && (!wholeNumbers || Number.isInteger(candidate))
    ) ?? 10 * magnitude;
  const interval = wholeNumbers ? Math.max(1, Math.round(step)) : step;
  const fraction = String(Number(interval.toPrecision(3))).split(".")[1];
  return {
    // toPrecision drops float noise such as 0.30000000000000004.
    max: Number((Math.ceil(peak / interval) * interval).toPrecision(12)),
    interval,
    decimals: fraction?.length ?? 0,
  };
}

/** Fits the rows plus header, capped so long tables scroll inside the card. */
export function mcpTableHeight(
  rowCount: number,
  rowHeight = TABLE_ROW_HEIGHT
): number {
  if (rowCount === 0) {
    return MCP_TABLE_EMPTY_HEIGHT;
  }
  return (Math.min(rowCount, MCP_TABLE_MAX_ROWS) + 1) * rowHeight;
}

/** Neighbor hops as table rows with their share of all hops. */
export function mcpNeighborRows(
  neighbors: readonly McpToolNeighbor[]
): McpNeighborRow[] {
  const total = neighbors.reduce((sum, hop) => sum + hop.calls, 0);
  return neighbors.map((hop, index) => ({
    key: hop.tool || `edge-${String(index)}`,
    tool: hop.tool,
    calls: hop.calls,
    afterFailure: hop.afterFailure,
    share: total === 0 ? 0 : (hop.calls / total) * 100,
  }));
}

/** A session timeline event as a request log entry, for the request sheet. */
export function mcpSessionRequest(
  event: McpSessionEvent,
  session: McpAnalyticsSession
): McpAnalyticsRequest {
  return {
    ...event,
    sessionId: session.id,
    clientName: session.clientName,
    clientVersion: "",
    protocolVersion: "",
    userId: session.userId,
    model: session.model,
  };
}

/**
 * The average session of the window, the baseline for a single session's
 * deltas. Duration averages the listed (most recent) sessions.
 */
export function mcpSessionAverages(
  data: Pick<McpAnalyticsResponse, "totals" | "sessions">
): McpSessionAverages | null {
  const { totals, sessions } = data;
  if (totals.sessions === 0) {
    return null;
  }
  const durations = sessions.map((session) =>
    sessionDurationSeconds(session.startedAt, session.endedAt)
  );
  return {
    requests: totals.requests / totals.sessions,
    toolCalls: totals.toolCalls / totals.sessions,
    durationSeconds:
      durations.length > 0
        ? durations.reduce((sum, value) => sum + value, 0) / durations.length
        : 0,
  };
}

/** Percent above or below the average session, or null without a baseline. */
export function mcpVsAverage(value: number, average: number): number | null {
  return average > 0 ? percentChange(value, average) : null;
}

/**
 * The highest version by numeric segments (1.10.0 above 1.9.2), not the one
 * that answered most recently: an old deployment can still serve requests.
 */
export function latestMcpVersion(
  versions: readonly string[]
): string | undefined {
  return versions.reduce<string | undefined>(
    (latest, version) =>
      latest === undefined ||
      version.localeCompare(latest, undefined, { numeric: true }) > 0
        ? version
        : latest,
    undefined
  );
}
