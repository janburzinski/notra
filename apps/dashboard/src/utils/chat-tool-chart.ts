import { toolOutputChartSchema } from "@notra/ai/schemas/chart-artifact";
import type {
  ChartArtifact,
  ChartSegment,
  ChartSeries,
} from "@notra/ai/types/chart-artifact";

import {
  CHART_PERCENT_SCALE,
  CHAT_TOOL_SHARE_VISIBLE_SLICES,
} from "@/constants/charts";
import type {
  ToolOutputRankRow,
  ToolOutputShareRow,
} from "@/types/components/chat-tool-chart";
import { chartKey } from "@/utils/chart-keys";
import {
  formatChartEngineLabel,
  formatChartEngineRankLabel,
} from "@/utils/geo-model-display";

export const CHART_CATEGORY_KEY = "__category";

export function parseToolOutputChart(
  output: unknown
): ChartArtifact | undefined {
  const parsed = toolOutputChartSchema.safeParse(output);
  return parsed.success ? parsed.data.chart : undefined;
}

export function chartSeriesDataKey(name: string, index: number): string {
  return `${chartKey(name)}-${index}`;
}

export function pivotChartSeries(
  series: readonly ChartSeries[]
): Record<string, string | number | null>[] {
  const xs = [
    ...new Set(series.flatMap((entry) => entry.points.map((point) => point.x))),
  ];
  const keyedSeries = series.map((entry, index) => ({
    dataKey: chartSeriesDataKey(entry.name, index),
    points: new Map(entry.points.map((point) => [point.x, point.y] as const)),
  }));

  return xs.map((x) => {
    const row: Record<string, string | number | null> = {
      [CHART_CATEGORY_KEY]: x,
    };
    for (const entry of keyedSeries) {
      row[entry.dataKey] = entry.points.get(x) ?? null;
    }
    return row;
  });
}

function formatRankNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    value
  );
}

/**
 * Whether values are 0–100 percentages. Charts saved before `unit` existed
 * fall back to the old guess: everything at or below 100 reads as percent.
 */
export function isPercentChart(
  chart: Pick<ChartArtifact, "unit">,
  values: readonly number[]
): boolean {
  if (chart.unit) {
    return chart.unit === "percent";
  }
  return Math.max(0, ...values) <= CHART_PERCENT_SCALE;
}

export function formatChartValue(
  value: number,
  asPercent: boolean,
  locale: string
): string {
  const formatted = formatRankNumber(value, locale);
  return asPercent ? `${formatted}%` : formatted;
}

/**
 * Donut rows, largest first. Past the visible budget the tail folds into one
 * "Other" slice so the ring and the list stay readable at chat width. A
 * segment the server already folded (`other`) always joins that slice.
 */
export function buildShareChartRows(
  segments: readonly ChartSegment[],
  otherLabel: string
): ToolOutputShareRow[] {
  const positive = segments.filter((segment) => segment.value > 0);
  const total = positive.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) {
    return [];
  }
  const named = positive
    .filter((segment) => !segment.other)
    .toSorted((left, right) => right.value - left.value);
  const folded = positive
    .filter((segment) => segment.other)
    .reduce((sum, segment) => sum + segment.value, 0);
  const folds =
    named.length > CHAT_TOOL_SHARE_VISIBLE_SLICES + (folded > 0 ? 0 : 1);
  const visible = folds
    ? named.slice(0, CHAT_TOOL_SHARE_VISIBLE_SLICES)
    : named;
  const rows: ToolOutputShareRow[] = visible.map((segment, index) => ({
    key: `${chartKey(segment.label)}-${index}`,
    label: segment.label,
    value: segment.value,
    share: segment.value / total,
    other: false,
  }));
  const rest =
    folded +
    (folds
      ? named
          .slice(CHAT_TOOL_SHARE_VISIBLE_SLICES)
          .reduce((sum, segment) => sum + segment.value, 0)
      : 0);
  if (rest > 0) {
    rows.push({
      key: "other",
      label: otherLabel,
      value: rest,
      share: rest / total,
      other: true,
    });
  }
  return rows;
}

export function rankBarChartSegments(
  chart: Pick<ChartArtifact, "unit">,
  segments: readonly ChartSegment[],
  formatWithoutSearch: (engine: string) => string,
  locale: string
): ToolOutputRankRow[] {
  const maxValue = Math.max(0, ...segments.map((segment) => segment.value));
  const asPercent = isPercentChart(
    chart,
    segments.map((segment) => segment.value)
  );
  const scale = asPercent ? CHART_PERCENT_SCALE : maxValue || 1;

  const ranked = segments.toSorted((left, right) => right.value - left.value);
  const baseNames = ranked.map((segment) =>
    formatChartEngineLabel(segment.label)
  );
  const nameCounts = new Map<string, number>();
  for (const name of baseNames) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  return ranked.map((segment, index) => {
    const baseName = baseNames[index] ?? formatChartEngineLabel(segment.label);
    const showSearchMode = (nameCounts.get(baseName) ?? 0) > 1;
    return {
      engine: segment.label,
      name: formatChartEngineRankLabel(
        segment.label,
        showSearchMode,
        formatWithoutSearch
      ),
      value: segment.value,
      valueLabel: formatChartValue(segment.value, asPercent, locale),
      widthPercent: (segment.value / scale) * CHART_PERCENT_SCALE,
    };
  });
}
