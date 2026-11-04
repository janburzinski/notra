"use client";

import { todayIsoDate } from "@notra/geo-core/utils/day-label";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { EChartsAreaChart } from "@/components/evilcharts/charts/echarts-area-chart";
import { GeoStatDelta } from "@/components/geo/geo-stat-delta";
import {
  TRAFFIC_HERO_CHART_OPTIONS,
  TRAFFIC_HERO_TREND_STROKE_WIDTH,
} from "@/constants/geo-traffic-hero";
import {
  MCP_AXIS_COMPACT_COUNT,
  MCP_AXIS_SECONDS_FROM_MS,
  MCP_METRIC_CARD_CLASS,
  MCP_METRIC_CHART_SURFACE_CLASS,
  MCP_METRIC_COLOR,
  MCP_METRIC_SERIES_KEY,
} from "@/constants/mcp-analytics";
import type { ChartConfig } from "@/types/charts";
import type { McpMetricCardProps } from "@/types/mcp-analytics";
import { formatFullDayLabel } from "@/utils/analytics-charts";
import { seriesColors } from "@/utils/chart-colors";
import { formatMilliseconds } from "@/utils/format";
import { formatChartInteger } from "@/utils/geo-charts";
import { buildMcpMetricRows, mcpAxisScale } from "@/utils/mcp-analytics";

/** One hero metric: its total, the change and its own daily chart. */
export function McpMetricCard({ metric, data, range }: McpMetricCardProps) {
  const tShared = useTranslations("geo.shared");
  const locale = useLocale();
  const format = useFormatter();
  const rows = buildMcpMetricRows(data, metric.key, locale, range);
  const isHourly = range.from === range.to;
  const scale = mcpAxisScale(
    rows.map((row) => Number(row[MCP_METRIC_SERIES_KEY])),
    metric.key === "toolCalls" || metric.key === "sessions"
  );
  const config: ChartConfig = {
    [MCP_METRIC_SERIES_KEY]: {
      label: metric.label,
      colors: seriesColors(MCP_METRIC_COLOR),
    },
  };
  const formatValue = (value: number) => {
    if (metric.key === "errorRate") {
      return format.number(value / 100, {
        style: "percent",
        maximumFractionDigits: value > 0 && value < 1 ? 2 : 1,
      });
    }
    if (metric.key === "p95Latency") {
      return formatMilliseconds(value, locale);
    }
    return formatChartInteger(value, locale);
  };
  const formatTick = (value: number) => {
    if (metric.key === "errorRate") {
      // Keep the baseline as "0%" rather than "0.00%".
      const decimals = value === 0 ? 0 : scale.decimals;
      return format.number(value / 100, {
        style: "percent",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    if (metric.key === "p95Latency") {
      return scale.max >= MCP_AXIS_SECONDS_FROM_MS
        ? format.number(value / MCP_AXIS_SECONDS_FROM_MS, {
            style: "unit",
            unit: "second",
            unitDisplay: "narrow",
            maximumFractionDigits: 2,
          })
        : formatMilliseconds(value, locale);
    }
    return scale.max >= MCP_AXIS_COMPACT_COUNT
      ? format.number(value, { notation: "compact" })
      : formatChartInteger(value, locale);
  };

  return (
    <section aria-label={metric.label} className={MCP_METRIC_CARD_CLASS}>
      <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
        <h3 className="text-foreground/75 truncate text-sm leading-5 font-semibold tracking-tight">
          {metric.label}
        </h3>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-lg leading-none font-semibold tracking-tight tabular-nums">
            {metric.value}
          </span>
          <GeoStatDelta
            delta={metric.delta}
            hint={tShared("vsPreviousPeriodOfThe")}
            label={metric.label}
            lowerIsBetter={metric.lowerIsBetter}
          />
        </div>
      </div>
      <div className={MCP_METRIC_CHART_SURFACE_CLASS}>
        <EChartsAreaChart
          animation={false}
          chartOptions={TRAFFIC_HERO_CHART_OPTIONS}
          className="h-40 w-full cursor-crosshair"
          config={config}
          curveType="monotone"
          data={rows}
          xDataKey="day"
        >
          <EChartsAreaChart.Grid opacity={0.5} variant="solid" />
          <EChartsAreaChart.XAxis dataKey="day" hideDots />
          <EChartsAreaChart.YAxis
            hideDots
            interval={scale.interval}
            max={scale.max}
            min={0}
            tickFormatter={(value: number) => formatTick(value)}
          />
          <EChartsAreaChart.Area
            dataKey={MCP_METRIC_SERIES_KEY}
            enableBufferLine={range.to === todayIsoDate()}
            strokeVariant="solid"
            strokeWidth={TRAFFIC_HERO_TREND_STROKE_WIDTH}
            variant="gradient"
          >
            <EChartsAreaChart.ActiveDot variant="border" />
          </EChartsAreaChart.Area>
          <EChartsAreaChart.Tooltip
            labelFormatter={(raw: string) =>
              isHourly
                ? format.dateTime(new Date(raw), {
                    weekday: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : formatFullDayLabel(raw, locale)
            }
            labelKey="rawDay"
            roundness="xl"
            scrub={rows.length > 1}
            valueFormatter={formatValue}
          />
        </EChartsAreaChart>
      </div>
    </section>
  );
}
