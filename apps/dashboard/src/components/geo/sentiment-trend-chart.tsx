"use client";

import { formatDayLabel } from "@notra/geo-core/utils/day-label";
import { EChartsAreaChart } from "@notra/ui/components/evilcharts/charts/echarts-area-chart";
import type { ChartConfig } from "@notra/ui/types/charts";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { CHART_MUTED_COLOR, CHART_PRIMARY_COLOR } from "@/constants/charts";
import {
  SENTIMENT_TREND_LINE_KEY,
  SENTIMENT_TREND_SCORE_KEY,
} from "@/constants/geo-sentiment";
import type { SentimentTrendChartProps } from "@/types/geo-sentiment";
import { formatFullDayLabel } from "@/utils/analytics-charts";
import { seriesColors } from "@/utils/chart-colors";
import { fitMentionTrendLine } from "@/utils/geo-charts";

export function SentimentTrendChart({ points }: SentimentTrendChartProps) {
  const t = useTranslations("geo.sentimentBreakdown");
  const tGeoShared = useTranslations("geo.shared");
  const format = useFormatter();
  const locale = useLocale();
  const rows = points.map((point) => ({
    day: formatDayLabel(point.day, locale),
    rawDay: point.day,
    [SENTIMENT_TREND_SCORE_KEY]: point.score,
  }));
  const isolatedDays = rows.flatMap((row, index) =>
    typeof row[SENTIMENT_TREND_SCORE_KEY] === "number" &&
    typeof rows[index - 1]?.[SENTIMENT_TREND_SCORE_KEY] !== "number" &&
    typeof rows[index + 1]?.[SENTIMENT_TREND_SCORE_KEY] !== "number"
      ? [index]
      : []
  );
  const trend = fitMentionTrendLine(rows, SENTIMENT_TREND_SCORE_KEY);
  const chartRows = rows.map((row, index) => ({
    ...row,
    [SENTIMENT_TREND_LINE_KEY]: trend[index] ?? null,
  }));
  const config: ChartConfig = {
    [SENTIMENT_TREND_SCORE_KEY]: {
      label: t("deltaLabel"),
      colors: seriesColors(CHART_PRIMARY_COLOR),
    },
    [SENTIMENT_TREND_LINE_KEY]: {
      label: tGeoShared("trendLabel"),
      colors: seriesColors(CHART_MUTED_COLOR),
    },
  };

  return (
    <EChartsAreaChart
      animation={false}
      renderer="svg"
      className="min-h-64 w-full flex-1 cursor-crosshair"
      config={config}
      curveType="monotone"
      data={chartRows}
      xDataKey="day"
    >
      <EChartsAreaChart.Grid variant="solid" />
      <EChartsAreaChart.XAxis dataKey="day" />
      <EChartsAreaChart.YAxis scale />
      <EChartsAreaChart.Area
        dataKey={SENTIMENT_TREND_SCORE_KEY}
        gapMissing
        strokeVariant="solid"
        strokeWidth={2}
        variant="gradient"
      >
        {isolatedDays.length > 0 ? (
          <EChartsAreaChart.Dot indices={isolatedDays} variant="border" />
        ) : null}
        <EChartsAreaChart.ActiveDot variant="border" />
      </EChartsAreaChart.Area>
      <EChartsAreaChart.Area
        curveType="linear"
        dataKey={SENTIMENT_TREND_LINE_KEY}
        gapMissing
        strokeVariant="dashed"
        strokeWidth={1.5}
        variant="none"
      />
      <EChartsAreaChart.Tooltip
        labelFormatter={(day: string) => formatFullDayLabel(day, locale)}
        labelKey="rawDay"
        hideZeros={false}
        roundness="xl"
        rowKeys={[SENTIMENT_TREND_SCORE_KEY]}
        valueFormatter={(value: number) => format.number(Math.round(value))}
      />
    </EChartsAreaChart>
  );
}
