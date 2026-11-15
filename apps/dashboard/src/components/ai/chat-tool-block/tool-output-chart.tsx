"use client";

import type {
  AreaChartArtifact,
  BarChartArtifact,
  ChartArtifact,
  PieChartArtifact,
} from "@notra/ai/types/chart-artifact";
import { EChartsAreaChart } from "@notra/ui/components/evilcharts/charts/echarts-area-chart";
import { EChartsPieChart } from "@notra/ui/components/evilcharts/charts/echarts-pie-chart";
import type { ChartConfig } from "@notra/ui/types/charts";
import type { CSSProperties, ReactNode } from "react";
import { InstrumentEmpty } from "ui/card";
import { useLocale, useTranslations } from "use-intl";

import { EngineIcon } from "@/components/geo/engine-icon";
import {
  CHART_LEGEND_TOP,
  CHAT_TOOL_CHART_HEIGHT_CLASS,
  CHAT_TOOL_DONUT_INNER_RADIUS,
  CHAT_TOOL_DONUT_OUTER_RADIUS,
  CHAT_TOOL_PIE_HEIGHT_CLASS,
  CHAT_TOOL_CHART_OPTIONS,
  CHAT_TOOL_RANK_TRACK_CLASS,
  CHART_SEARCH_FILL_CLASS,
  DONUT_CORNER_RADIUS,
  DONUT_PADDING_ANGLE,
  FLUSH_CHART_OPTIONS,
} from "@/constants/charts";
import { cn } from "@/lib/utils";
import type {
  ToolOutputChartPlotProps,
  ToolOutputChartProps,
  ToolOutputRankRow,
} from "@/types/components/chat-tool-chart";
import { accountSeriesColors } from "@/utils/chart-colors";
import {
  CHART_CATEGORY_KEY,
  chartSeriesDataKey,
  pivotChartSeries,
  rankBarChartSegments,
} from "@/utils/chat-tool-chart";
import { formatChartEngineLabel } from "@/utils/geo-model-display";

const VALUE_KEY = "value";
const RANK_STAGGER_MS = 40;
const RANK_STAGGER_MAX_STEPS = 8;

function ChartFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-border bg-muted/20 duration-normal ease-emphasized mt-3 translate-y-0 overflow-hidden rounded-lg border opacity-100 transition-[opacity,transform] motion-reduce:transition-none starting:translate-y-1.5 starting:opacity-0">
      <div className="px-3 pt-2.5 pb-1 wrap-anywhere">
        <p className="text-foreground text-sm font-medium">{title}</p>
        {subtitle ? (
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function EmptyChartMessage({ message }: { message: string }) {
  return (
    <p className="text-muted-foreground px-3 pt-1 pb-3 text-xs leading-5">
      {message}
    </p>
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
  const series = chart.series;
  const data = pivotChartSeries(series);
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

  // With one line the title names it; with more, a legend says which is
  // which, above the plot so it covers none of the lines.
  const showLegend = keyedSeries.length > 1;
  const baseOptions = flush ? FLUSH_CHART_OPTIONS : CHAT_TOOL_CHART_OPTIONS;
  const chartOptions = showLegend
    ? {
        ...baseOptions,
        grid: {
          ...(baseOptions.grid as Record<string, unknown>),
          top: CHART_LEGEND_TOP,
        },
      }
    : baseOptions;

  if (data.length === 0) {
    return <EmptyChartMessage message={t("chartEmptySeries")} />;
  }

  return (
    <EChartsAreaChart
      animation={false}
      chartOptions={chartOptions}
      className={cn(
        "w-full",
        !flush && "px-1 pb-1",
        CHAT_TOOL_CHART_HEIGHT_CLASS
      )}
      config={config}
      curveType="monotone"
      data={data}
      xDataKey={CHART_CATEGORY_KEY}
    >
      {keyedSeries.map((entry) => (
        <EChartsAreaChart.Area
          dataKey={entry.dataKey}
          gapMissing
          key={entry.dataKey}
          strokeVariant="solid"
          variant="gradient"
        />
      ))}
      <EChartsAreaChart.Tooltip confine={false} />
      {showLegend ? <EChartsAreaChart.Legend /> : null}
    </EChartsAreaChart>
  );
}

function RankMeter({ index, row }: { index: number; row: ToolOutputRankRow }) {
  return (
    <li className="flex items-center gap-2">
      <EngineIcon className="size-4" engine={row.engine} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-xs font-medium">{row.name}</span>
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
            "mt-1 h-1.5 overflow-hidden rounded-full",
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
    chart.segments,
    (engine) => tMode("engineWithoutSearch", { engine }),
    locale
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-2 px-3 pt-1 pb-3">
      {rows.map((row, index) => (
        <RankMeter index={index} key={row.engine} row={row} />
      ))}
    </ul>
  );
}

function PieArtifactChart({ chart }: { chart: PieChartArtifact }) {
  const segments = chart.segments;
  const data = segments.map((segment) => ({
    name: segment.label,
    [VALUE_KEY]: segment.value,
  }));
  const config: ChartConfig = {};
  for (const [index, segment] of segments.entries()) {
    config[segment.label] = {
      label: segment.label,
      colors: accountSeriesColors(index),
    };
  }

  if (data.length === 0) {
    return null;
  }

  return (
    <EChartsPieChart
      animation={false}
      className={cn("w-full px-1", CHAT_TOOL_PIE_HEIGHT_CLASS)}
      config={config}
      data={data}
      dataKey={VALUE_KEY}
      nameKey="name"
    >
      <EChartsPieChart.Pie
        innerRadius={CHAT_TOOL_DONUT_INNER_RADIUS}
        outerRadius={CHAT_TOOL_DONUT_OUTER_RADIUS}
        cornerRadius={DONUT_CORNER_RADIUS}
        paddingAngle={DONUT_PADDING_ANGLE}
      />
      <EChartsPieChart.Tooltip />
      <EChartsPieChart.Legend />
    </EChartsPieChart>
  );
}

/** The chart without its chat frame, for surfaces that bring their own. */
export function ToolOutputChartPlot({
  chart,
  flush = false,
}: ToolOutputChartPlotProps) {
  switch (chart.kind) {
    case "empty":
      // On a page the empty chart keeps a chart's footprint, like the
      // analytics cards; the chat keeps it to a line.
      return flush ? (
        <InstrumentEmpty className="min-h-40" message={chart.emptyMessage} />
      ) : (
        <EmptyChartMessage message={chart.emptyMessage} />
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

export function ToolOutputChart({ chart }: ToolOutputChartProps) {
  return (
    <ChartFrame subtitle={chart.subtitle} title={chart.title}>
      <ToolOutputChartPlot chart={chart} />
    </ChartFrame>
  );
}
