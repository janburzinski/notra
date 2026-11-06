"use client";

import { EChartsAreaChart } from "@notra/ui/components/evilcharts/charts/echarts-area-chart";
import { tooltipColorSwatchHtml } from "@notra/ui/components/evilcharts/ui/echarts-tooltip";
import type { ChartConfig } from "@notra/ui/types/charts";
import { useMemo } from "react";

import {
  SPARKLINE_CHART_OPTIONS,
  SPARKLINE_SERIES_KEY,
} from "@/constants/charts";
import type { ChartSparklineProps } from "@/types/charts";
import { seriesColors } from "@/utils/chart-colors";

export function ChartSparkline({
  data,
  labels,
  color,
  className,
  markIncompleteTail = true,
  tooltipValueFormatter,
}: ChartSparklineProps) {
  const rows = useMemo(
    () =>
      data.map((value, index) => ({
        point: labels?.[index] ?? String(index),
        [SPARKLINE_SERIES_KEY]: value,
      })),
    [data, labels]
  );

  const config = useMemo<ChartConfig>(
    () => ({
      [SPARKLINE_SERIES_KEY]: {
        label: "",
        colors: seriesColors(color),
        indicatorHtml: tooltipColorSwatchHtml(color.light),
      },
    }),
    [color]
  );

  return (
    <EChartsAreaChart
      animation={false}
      chartOptions={SPARKLINE_CHART_OPTIONS}
      className={className}
      config={config}
      curveType="monotone"
      data={rows}
      xDataKey="point"
    >
      <EChartsAreaChart.Area
        dataKey={SPARKLINE_SERIES_KEY}
        enableBufferLine={markIncompleteTail}
        strokeVariant="solid"
        variant="gradient"
      />
      {tooltipValueFormatter ? (
        <EChartsAreaChart.Tooltip
          confine={false}
          cursor={false}
          valueFormatter={tooltipValueFormatter}
        />
      ) : null}
    </EChartsAreaChart>
  );
}
