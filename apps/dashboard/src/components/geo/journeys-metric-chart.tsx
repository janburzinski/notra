"use client";

import {
  GEO_TRAFFIC_TREND_CRAWLER_KEY,
  GEO_TRAFFIC_TREND_REFERRAL_KEY,
} from "@notra/geo-core/constants/geo";
import { todayIsoDate } from "@notra/geo-core/utils/day-label";
import { EChartsAreaChart } from "@notra/ui/components/evilcharts/charts/echarts-area-chart";
import type { ChartConfig } from "@notra/ui/types/charts";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { CHART_PRIMARY_COLOR, CHART_REFERRAL_COLOR } from "@/constants/charts";
import {
  JOURNEYS_METRIC_SERIES_KEY,
  TRAFFIC_HERO_CHART_OPTIONS,
  TRAFFIC_HERO_TREND_STROKE_WIDTH,
} from "@/constants/geo-traffic-hero";
import type { JourneysMetricChartProps } from "@/types/geo";
import { formatFullDayLabel } from "@/utils/analytics-charts";
import { seriesColors } from "@/utils/chart-colors";
import { isolatedPointIndices } from "@/utils/chart-series";
import { formatChartInteger } from "@/utils/geo-charts";
import { journeyMetricRows } from "@/utils/geo-journey";

/** The daily chart of one Journeys hero metric, drawn at once without a reveal. */
export function JourneysMetricChart({
  metric,
  sources,
  pages,
  days,
}: JourneysMetricChartProps) {
  const tGeoShared = useTranslations("geo.shared");
  const locale = useLocale();
  const format = useFormatter();
  const rows = journeyMetricRows(metric.key, sources, pages, days, locale);
  const split = metric.key === "journeys";
  const config: ChartConfig = split
    ? {
        [GEO_TRAFFIC_TREND_CRAWLER_KEY]: {
          label: tGeoShared("crawlers"),
          colors: seriesColors(CHART_PRIMARY_COLOR),
        },
        [GEO_TRAFFIC_TREND_REFERRAL_KEY]: {
          label: tGeoShared("referrals"),
          colors: seriesColors(CHART_REFERRAL_COLOR),
        },
      }
    : {
        [JOURNEYS_METRIC_SERIES_KEY]: {
          label: metric.label,
          colors: seriesColors(CHART_PRIMARY_COLOR),
        },
      };
  const formatValue = (value: number) => {
    if (metric.key === "deepCrawls") {
      return format.number(value / 100, {
        style: "percent",
        maximumFractionDigits: 1,
      });
    }
    if (metric.key === "depth") {
      return format.number(value, { maximumFractionDigits: 1 });
    }
    return formatChartInteger(value, locale);
  };
  const markIncompleteTail = days.at(-1) === todayIsoDate();
  const seriesKeys = split
    ? [GEO_TRAFFIC_TREND_CRAWLER_KEY, GEO_TRAFFIC_TREND_REFERRAL_KEY]
    : [JOURNEYS_METRIC_SERIES_KEY];
  // A day between two gaps has no line segment, so it gets a resting dot.
  const series = seriesKeys.map((key) => ({
    key,
    isolated: isolatedPointIndices(
      rows.map((row) => {
        const value = row[key];
        return typeof value === "number" ? value : null;
      })
    ),
  }));

  return (
    <EChartsAreaChart
      animation={false}
      chartOptions={TRAFFIC_HERO_CHART_OPTIONS}
      className="h-52 w-full cursor-crosshair @md/hero:h-72"
      config={config}
      curveType="monotone"
      data={rows}
      xDataKey="day"
    >
      <EChartsAreaChart.Grid opacity={0.5} variant="solid" />
      <EChartsAreaChart.XAxis dataKey="day" hideDots />
      <EChartsAreaChart.YAxis
        hideDots
        min={0}
        tickFormatter={(value: number) => formatValue(value)}
      />
      {series.map(({ key, isolated }) => (
        <EChartsAreaChart.Area
          dataKey={key}
          enableBufferLine={markIncompleteTail}
          gapMissing={key !== GEO_TRAFFIC_TREND_CRAWLER_KEY}
          key={key}
          strokeVariant="solid"
          strokeWidth={TRAFFIC_HERO_TREND_STROKE_WIDTH}
          variant="gradient"
        >
          <EChartsAreaChart.ActiveDot variant="border" />
          {isolated.length > 0 ? (
            <EChartsAreaChart.Dot indices={isolated} variant="border" />
          ) : null}
        </EChartsAreaChart.Area>
      ))}
      <EChartsAreaChart.Tooltip
        hideZeros={split}
        labelFormatter={(raw: string) => formatFullDayLabel(raw, locale)}
        labelKey="rawDay"
        roundness="xl"
        scrub={rows.length > 1}
        valueFormatter={formatValue}
      />
    </EChartsAreaChart>
  );
}
