"use client";

import { EChartsAreaChart } from "@notra/ui/components/evilcharts/charts/echarts-area-chart";
import { TrendBadge } from "@notra/ui/components/trend-badge";
import type { ChartConfig, ChartColorPair } from "@notra/ui/types/charts";
import { googleFaviconUrl } from "@notra/utils/google-favicon";
import { useMemo } from "react";

import {
  DATA_TOOLTIP_MAX_ROWS,
  DATA_TOUCH_TOOLTIP_MAX_ROWS,
} from "@/constants/data";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import type { DataTraffic } from "@/types/data";
import { formatDataDay, formatVisits, relativeTrend } from "@/utils/data";

const TOTAL_KEY = "total";
const LOGO_PX = 32;
const STROKE_WIDTH = 2;
const CHART_OPTIONS = {
  grid: { left: 4, right: 8, top: 8, bottom: 4, containLabel: true },
};

function weekTrend(
  change: number | null
): { tone: "up" | "down" | "flat"; text: string } | null {
  const trend = relativeTrend(change);
  if (trend.value === null) {
    return null;
  }
  let tone: "up" | "down" | "flat" = "flat";
  if (trend.value > 0) {
    tone = "up";
  } else if (trend.value < 0) {
    tone = "down";
  }
  return { tone, text: trend.signed };
}

/** The company logo the tooltip shows before a bot or assistant; a blank slot keeps "Other" aligned. */
function logoHtml(domain: string | null): string {
  const src = googleFaviconUrl(domain, LOGO_PX);
  return src
    ? `<img alt="" class="size-3.5 shrink-0 rounded-[3px] bg-white outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" height="14" src="${src}" width="14" />`
    : `<span aria-hidden="true" class="size-3.5 shrink-0"></span>`;
}

/**
 * One kind of AI traffic in the dashboard's traffic card: the headline figure
 * on the grey shell, the dashboard's area chart and frosted-glass hover below.
 */
export function DataTrafficCard({
  title,
  unit,
  traffic,
  color,
}: {
  title: string;
  unit: string;
  traffic: DataTraffic;
  color: ChartColorPair;
}) {
  const config = useMemo<ChartConfig>(() => {
    const colors = { light: [color.light], dark: [color.dark] };
    return {
      [TOTAL_KEY]: { label: title, colors },
      ...Object.fromEntries(
        traffic.series.map((entry) => [
          entry.key,
          { label: entry.label, colors, indicatorHtml: logoHtml(entry.domain) },
        ])
      ),
    };
  }, [title, color, traffic.series]);
  const trend = weekTrend(traffic.change);
  // On touch, ECharts places a body-mounted tooltip one scroll height too low,
  // so the tooltip stays inside the chart there, with fewer rows to fit.
  const touch = useCoarsePointer();

  return (
    <div className="border-table-shell-border bg-table-shell flex min-w-0 flex-col rounded-2xl border p-0.5">
      <div className="flex flex-col gap-1 px-4 pt-3 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <h3 className="text-muted-foreground text-sm font-medium">{title}</h3>
          {trend ? (
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs whitespace-nowrap">
              <TrendBadge tone={trend.tone}>{trend.text}</TrendBadge>
              vs. prior week
            </span>
          ) : null}
        </div>
        <p className="flex items-baseline gap-2">
          <span className="text-foreground font-display text-3xl font-medium tracking-[-0.02em] tabular-nums">
            {traffic.recent === null ? "–" : formatVisits(traffic.recent)}
          </span>
          <span className="text-muted-foreground text-sm">{unit}</span>
        </p>
      </div>
      <div className="border-table-card-border bg-table-card shadow-table-card relative -mt-5 rounded-[14px] border p-4">
        <EChartsAreaChart
          animationType="left-to-right"
          chartOptions={CHART_OPTIONS}
          className="h-56 w-full cursor-crosshair"
          config={config}
          curveType="monotone"
          data={traffic.rows}
          xDataKey="day"
        >
          <EChartsAreaChart.Grid variant="solid" />
          <EChartsAreaChart.XAxis dataKey="day" />
          <EChartsAreaChart.YAxis />
          <EChartsAreaChart.Area
            dataKey={TOTAL_KEY}
            gapMissing
            strokeVariant="solid"
            strokeWidth={STROKE_WIDTH}
            variant="gradient"
          >
            <EChartsAreaChart.ActiveDot variant="border" />
          </EChartsAreaChart.Area>
          <EChartsAreaChart.Tooltip
            confine={touch}
            hideZeros
            labelFormatter={formatDataDay}
            labelKey="rawDay"
            layout="activity"
            maxRows={
              touch ? DATA_TOUCH_TOOLTIP_MAX_ROWS : DATA_TOOLTIP_MAX_ROWS
            }
            position="fixed"
            roundness="xl"
            rowKeys={traffic.series.map((entry) => entry.key)}
            scrub
            valueFormatter={formatVisits}
          />
        </EChartsAreaChart>
      </div>
    </div>
  );
}

/** One bot's or assistant's daily visits per site, in the side drawer. */
export function DataSeriesChart({
  rows,
  dataKey,
  label,
  domain,
  color,
}: {
  rows: DataTraffic["rows"];
  dataKey: string;
  label: string;
  domain: string | null;
  color: ChartColorPair;
}) {
  const config = useMemo<ChartConfig>(
    () => ({
      [dataKey]: {
        label,
        colors: { light: [color.light], dark: [color.dark] },
        indicatorHtml: logoHtml(domain),
      },
    }),
    [dataKey, label, domain, color]
  );
  const touch = useCoarsePointer();
  return (
    <EChartsAreaChart
      animation={false}
      chartOptions={CHART_OPTIONS}
      className="h-48 w-full cursor-crosshair"
      config={config}
      curveType="monotone"
      data={rows}
      xDataKey="day"
    >
      <EChartsAreaChart.Grid variant="solid" />
      <EChartsAreaChart.XAxis dataKey="day" />
      <EChartsAreaChart.YAxis />
      <EChartsAreaChart.Area
        dataKey={dataKey}
        gapMissing
        strokeVariant="solid"
        strokeWidth={STROKE_WIDTH}
        variant="gradient"
      >
        <EChartsAreaChart.ActiveDot variant="border" />
      </EChartsAreaChart.Area>
      <EChartsAreaChart.Tooltip
        confine={touch}
        labelFormatter={formatDataDay}
        labelKey="rawDay"
        layout="activity"
        position="fixed"
        roundness="xl"
        scrub
        valueFormatter={formatVisits}
      />
    </EChartsAreaChart>
  );
}
