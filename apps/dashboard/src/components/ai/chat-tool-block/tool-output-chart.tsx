"use client";

import type {
  AreaChartArtifact,
  BarChartArtifact,
  PieChartArtifact,
} from "@notra/ai/types/chart-artifact";
import { formatDayLabel } from "@notra/geo-core/utils/day-label";
import { EChartsAreaChart } from "@notra/ui/components/evilcharts/charts/echarts-area-chart";
import { EChartsPieChart } from "@notra/ui/components/evilcharts/charts/echarts-pie-chart";
import type { ChartConfig } from "@notra/ui/types/charts";
import type { CSSProperties } from "react";
import { InstrumentEmpty, InstrumentModule } from "ui/card";
import { useLocale, useTranslations } from "use-intl";

import { ChartColorScope } from "@/components/charts/chart-color-scope";
import { EngineIcon } from "@/components/geo/engine-icon";
import {
  CHAT_TOOL_CHART_HEIGHT_CLASS,
  CHAT_TOOL_CHART_OPTIONS,
  CHAT_TOOL_DONUT_CORNER_RADIUS,
  CHAT_TOOL_DONUT_INNER_RADIUS,
  CHAT_TOOL_DONUT_OUTER_RADIUS,
  CHAT_TOOL_DONUT_PADDING_ANGLE,
  CHAT_TOOL_RANK_TRACK_CLASS,
  CHART_SEARCH_FILL_CLASS,
  FLUSH_CHART_OPTIONS,
} from "@/constants/charts";
import { cn } from "@/lib/utils";
import type {
  ToolOutputChartPlotProps,
  ToolOutputChartProps,
  ToolOutputRankRow,
  ToolOutputShareRow,
} from "@/types/components/chat-tool-chart";
import { formatFullDayLabel } from "@/utils/analytics-charts";
import { accountSeriesColors, softGradientColors } from "@/utils/chart-colors";
import {
  buildShareChartRows,
  CHART_CATEGORY_KEY,
  chartSeriesDataKey,
  formatChartValue,
  isPercentChart,
  pivotChartSeries,
  rankBarChartSegments,
} from "@/utils/chat-tool-chart";
import { formatChartInteger, formatUsageShare } from "@/utils/geo-charts";
import { formatChartEngineLabel } from "@/utils/geo-model-display";

const RANK_STAGGER_MS = 40;
const RANK_STAGGER_MAX_STEPS = 8;
const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function legendDotStyle(key: string): CSSProperties {
  return { "--legend-color": `var(--color-${key}-0)` } as CSSProperties;
}

function LegendDot({ colorKey }: { colorKey: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full bg-(--legend-color)"
      style={legendDotStyle(colorKey)}
    />
  );
}

function AreaArtifactChart({
  chart,
  flush = false,
}: {
  chart: AreaChartArtifact;
  flush?: boolean;
}) {
  const t = useTranslations("ai.toolBlock");
  const locale = useLocale();
  const series = chart.series;
  const data = pivotChartSeries(series);
  const asPercent = isPercentChart(
    chart,
    series.flatMap((entry) => entry.points.map((point) => point.y))
  );
  const isDaily = data.every((row) =>
    ISO_DAY_PATTERN.test(String(row[CHART_CATEGORY_KEY]))
  );
  const keyedSeries = series.map((entry, index) => ({
    dataKey: chartSeriesDataKey(entry.name, index),
    label: formatChartEngineLabel(entry.name),
  }));
  const config: ChartConfig = {};
  for (const [index, entry] of keyedSeries.entries()) {
    config[entry.dataKey] = {
      label: entry.label,
      colors: accountSeriesColors(index),
    };
  }

  if (data.length === 0) {
    return (
      <InstrumentEmpty className="min-h-32" message={t("chartEmptySeries")} />
    );
  }

  return (
    <ChartColorScope className="flex flex-col gap-3" config={config}>
      <EChartsAreaChart
        animation={false}
        chartOptions={flush ? FLUSH_CHART_OPTIONS : CHAT_TOOL_CHART_OPTIONS}
        className={cn("w-full cursor-crosshair", CHAT_TOOL_CHART_HEIGHT_CLASS)}
        config={config}
        curveType="monotone"
        data={data}
        renderer="svg"
        xDataKey={CHART_CATEGORY_KEY}
      >
        <EChartsAreaChart.Grid variant="solid" />
        <EChartsAreaChart.XAxis
          dataKey={CHART_CATEGORY_KEY}
          tickFormatter={
            isDaily ? (value) => formatDayLabel(value, locale) : undefined
          }
        />
        <EChartsAreaChart.YAxis
          tickFormatter={(value) => formatChartValue(value, asPercent, locale)}
        />
        {keyedSeries.map((entry) => (
          <EChartsAreaChart.Area
            dataKey={entry.dataKey}
            gapMissing
            key={entry.dataKey}
            strokeVariant="solid"
            variant={keyedSeries.length > 1 ? "none" : "gradient"}
          >
            <EChartsAreaChart.ActiveDot variant="border" />
          </EChartsAreaChart.Area>
        ))}
        <EChartsAreaChart.Tooltip
          confine={false}
          labelFormatter={
            isDaily
              ? (day: string) => formatFullDayLabel(day, locale)
              : undefined
          }
          roundness="xl"
          valueFormatter={(value: number) =>
            formatChartValue(value, asPercent, locale)
          }
        />
      </EChartsAreaChart>
      {/* With one line the title names it; with more, a wrapping legend
          below the plot says which is which without clipping. */}
      {keyedSeries.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {keyedSeries.map((entry) => (
            <li
              className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs"
              key={entry.dataKey}
            >
              <LegendDot colorKey={entry.dataKey} />
              <span className="truncate">{entry.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </ChartColorScope>
  );
}

function RankMeter({ index, row }: { index: number; row: ToolOutputRankRow }) {
  return (
    <li className="flex items-center gap-2.5">
      <EngineIcon className="size-4" engine={row.engine} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{row.name}</span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {row.valueLabel}
          </span>
        </div>
        <div
          aria-label={`${row.name} ${row.valueLabel}`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(row.widthPercent)}
          className={cn(
            "mt-1.5 h-1.5 overflow-hidden rounded-full",
            CHAT_TOOL_RANK_TRACK_CLASS
          )}
          role="meter"
        >
          <div
            className={cn(
              "h-full origin-left scale-x-100 rounded-full transition-transform delay-(--rank-delay) duration-500 ease-out motion-reduce:transition-none starting:scale-x-0",
              CHART_SEARCH_FILL_CLASS
            )}
            style={
              {
                "--rank-delay": `${Math.min(index, RANK_STAGGER_MAX_STEPS) * RANK_STAGGER_MS}ms`,
                width: `${row.widthPercent}%`,
              } as CSSProperties
            }
          />
        </div>
      </div>
    </li>
  );
}

function BarArtifactChart({ chart }: { chart: BarChartArtifact }) {
  const tMode = useTranslations("geo.shared.engineMode");
  const locale = useLocale();
  const rows = rankBarChartSegments(
    chart,
    chart.segments,
    (engine) => tMode("engineWithoutSearch", { engine }),
    locale
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <RankMeter index={index} key={row.engine} row={row} />
      ))}
    </ul>
  );
}

function ShareListRow({
  row,
  asPercent,
  locale,
}: {
  row: ToolOutputShareRow;
  asPercent: boolean;
  locale: string;
}) {
  return (
    <li className="border-border flex h-8 min-w-0 items-center gap-2 border-b last:border-b-0">
      <LegendDot colorKey={row.key} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          row.other ? "text-muted-foreground" : "font-medium"
        )}
        title={row.label}
      >
        {row.label}
      </span>
      {asPercent ? null : (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {formatChartInteger(row.value, locale)}
        </span>
      )}
      <span className="w-12 shrink-0 text-right text-sm tabular-nums">
        {formatUsageShare(row.share)}
      </span>
    </li>
  );
}

function PieArtifactChart({ chart }: { chart: PieChartArtifact }) {
  const t = useTranslations("ai.toolBlock");
  const locale = useLocale();
  const rows = buildShareChartRows(chart.segments, t("chartOther"));
  // Pies always showed raw values; only an explicit unit makes them percent.
  const asPercent = chart.unit === "percent";
  const config: ChartConfig = {};
  for (const [index, row] of rows.entries()) {
    config[row.key] = {
      label: row.label,
      colors: accountSeriesColors(index),
    };
  }
  const donutConfig: ChartConfig = Object.fromEntries(
    Object.entries(config).map(([key, item]) => [
      key,
      item.colors ? { ...item, colors: softGradientColors(item.colors) } : item,
    ])
  );
  const leader = rows[0];

  if (!leader) {
    return (
      <InstrumentEmpty className="min-h-32" message={t("chartEmptySeries")} />
    );
  }

  return (
    <ChartColorScope className="@container" config={config}>
      <div className="grid items-center gap-x-6 gap-y-4 @md:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="relative mx-auto size-36">
          <EChartsPieChart
            animation={false}
            className="absolute inset-0"
            config={donutConfig}
            data={rows.map((row) => ({ key: row.key, value: row.value }))}
            dataKey="value"
            nameKey="key"
          >
            <EChartsPieChart.Pie
              cornerRadius={CHAT_TOOL_DONUT_CORNER_RADIUS}
              innerRadius={CHAT_TOOL_DONUT_INNER_RADIUS}
              outerRadius={CHAT_TOOL_DONUT_OUTER_RADIUS}
              paddingAngle={CHAT_TOOL_DONUT_PADDING_ANGLE}
            />
            <EChartsPieChart.Tooltip
              roundness="xl"
              valueFormatter={(value: number) =>
                asPercent
                  ? formatChartValue(value, true, locale)
                  : formatChartInteger(value, locale)
              }
            />
          </EChartsPieChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="text-xl font-medium tracking-tight tabular-nums">
              {formatUsageShare(leader.share)}
            </span>
            <span className="text-muted-foreground max-w-24 truncate text-xs">
              {leader.label}
            </span>
          </div>
        </div>
        <ol className="min-w-0">
          {rows.map((row) => (
            <ShareListRow
              asPercent={asPercent}
              key={row.key}
              locale={locale}
              row={row}
            />
          ))}
        </ol>
      </div>
    </ChartColorScope>
  );
}

/** The chart without its card, for surfaces that bring their own. */
export function ToolOutputChartPlot({
  chart,
  flush = false,
}: ToolOutputChartPlotProps) {
  switch (chart.kind) {
    case "empty":
      return (
        <InstrumentEmpty
          className={flush ? "min-h-40" : "min-h-32"}
          message={chart.emptyMessage}
        />
      );
    case "pie":
      return <PieArtifactChart chart={chart} />;
    case "bar":
      return <BarArtifactChart chart={chart} />;
    case "area":
      return <AreaArtifactChart chart={chart} flush={flush} />;
    default: {
      const exhaustive: never = chart;
      return exhaustive;
    }
  }
}

/** A chart in the chat, on the same card as the GEO and analytics pages. */
export function ToolOutputChart({ chart, className }: ToolOutputChartProps) {
  return (
    <div
      className={cn(
        "duration-normal ease-emphasized min-w-0 translate-y-0 opacity-100 transition-[opacity,transform] motion-reduce:transition-none starting:translate-y-1.5 starting:opacity-0",
        className
      )}
    >
      <InstrumentModule
        eyebrow={chart.title}
        readout={chart.subtitle}
        variant="table"
      >
        <ToolOutputChartPlot chart={chart} />
      </InstrumentModule>
    </div>
  );
}
