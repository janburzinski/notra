"use client";

import { todayIsoDate } from "@notra/geo-core/utils/day-label";
import { EChartsAreaChart } from "@notra/ui/components/evilcharts/charts/echarts-area-chart";
import type { ChartConfig } from "@notra/ui/types/charts";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";

import { TrafficTrendLegend } from "@/components/geo/traffic-trend-legend";
import { ANALYTICS_IMPORT_PROVIDER_BRANDS } from "@/constants/analytics-imports";
import { CHART_PRIMARY_COLOR, CHART_SECONDARY_COLOR } from "@/constants/charts";
import {
  TRAFFIC_HERO_CHART_OPTIONS,
  TRAFFIC_HERO_CHART_SURFACE_CLASS,
  TRAFFIC_HERO_TREND_STROKE_WIDTH,
} from "@/constants/geo-traffic-hero";
import {
  WEB_TREND_AGENTS_KEY,
  WEB_TREND_PEOPLE_KEY,
} from "@/constants/web-analytics";
import type { WebTrendChartProps } from "@/types/geo";
import { formatFullDayLabel } from "@/utils/analytics-charts";
import { seriesColors } from "@/utils/chart-colors";
import { formatChartInteger } from "@/utils/geo-charts";
import {
  buildWebTrendRows,
  importStartMarker,
  webTrendShare,
} from "@/utils/web-analytics";

export function WebTrendChart({ web, traffic, range }: WebTrendChartProps) {
  const t = useTranslations("geo.webVisitors");
  const locale = useLocale();
  const rows = buildWebTrendRows(
    web.points.length === 0 && !traffic?.points.length
      ? [{ day: range?.from ?? todayIsoDate(), views: 0, visitors: 0 }]
      : web.points,
    traffic?.points ?? [],
    locale,
    range?.from,
    range?.to
  );
  const share = webTrendShare(rows);
  const [hiddenKeys, setHiddenKeys] = useState<readonly string[]>([]);
  const people = {
    key: WEB_TREND_PEOPLE_KEY,
    label: t("visitors"),
    share: traffic ? share?.people : undefined,
    color: CHART_PRIMARY_COLOR,
  };
  const series = traffic
    ? [
        people,
        {
          key: WEB_TREND_AGENTS_KEY,
          label: t("agentsSeries"),
          share: share?.agents,
          color: CHART_SECONDARY_COLOR,
        },
      ]
    : [people];
  const hidden = new Set(hiddenKeys);
  const visibleSeries =
    series.length > 1
      ? series.filter((entry) => !hidden.has(entry.key))
      : series;
  const toggleSeries = (key: string) => {
    setHiddenKeys((current) => {
      if (current.includes(key)) {
        return current.filter((hiddenKey) => hiddenKey !== key);
      }
      return current.length + 1 >= series.length ? current : [...current, key];
    });
  };
  const config: ChartConfig = Object.fromEntries(
    visibleSeries.map((entry) => [
      entry.key,
      { label: entry.label, colors: seriesColors(entry.color) },
    ])
  );
  const markIncompleteTail = rows.at(-1)?.rawDay === todayIsoDate();
  const importMarker = importStartMarker(rows, web.imported);
  const markers = importMarker
    ? [
        {
          value: importMarker.day,
          label: t("importMarker", {
            provider: ANALYTICS_IMPORT_PROVIDER_BRANDS[importMarker.provider],
          }),
        },
      ]
    : undefined;

  return (
    <div
      aria-label={t("trendTitle")}
      className={TRAFFIC_HERO_CHART_SURFACE_CLASS}
      role="group"
    >
      <EChartsAreaChart
        animation={false}
        chartOptions={TRAFFIC_HERO_CHART_OPTIONS}
        className="h-64 w-full cursor-crosshair @md/hero:h-80"
        config={config}
        curveType="monotone"
        data={rows}
        markers={markers}
        stackType="stacked"
        xDataKey="day"
      >
        <EChartsAreaChart.Grid opacity={0.5} variant="solid" />
        <EChartsAreaChart.XAxis dataKey="day" hideDots />
        <EChartsAreaChart.YAxis
          hideDots
          interval={share === null ? 1 : undefined}
          max={share === null ? 1 : undefined}
        />
        {visibleSeries.map((entry) => (
          <EChartsAreaChart.Area
            dataKey={entry.key}
            enableBufferLine={markIncompleteTail}
            key={entry.key}
            strokeVariant="solid"
            strokeWidth={TRAFFIC_HERO_TREND_STROKE_WIDTH}
            variant="gradient"
          >
            <EChartsAreaChart.ActiveDot variant="border" />
          </EChartsAreaChart.Area>
        ))}
        <EChartsAreaChart.Tooltip
          confine={false}
          labelFormatter={(day: string) => formatFullDayLabel(day, locale)}
          labelKey="rawDay"
          position="fixed"
          roundness="xl"
          scrub={rows.length > 1}
          valueFormatter={(value: number) => formatChartInteger(value, locale)}
        />
      </EChartsAreaChart>
      <TrafficTrendLegend
        hiddenKeys={hiddenKeys}
        items={series}
        onToggle={series.length > 1 ? toggleSeries : undefined}
      />
    </div>
  );
}
