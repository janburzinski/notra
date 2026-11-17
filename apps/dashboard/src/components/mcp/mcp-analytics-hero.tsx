"use client";

import { trafficVisitDelta } from "@notra/geo-core/utils/ai-traffic";
import { cn } from "@notra/ui/lib/utils";
import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { TrafficHeroTile } from "@/components/geo/traffic-hero-tile";
import { McpMetricChart } from "@/components/mcp/mcp-metric-chart";
import {
  TRAFFIC_HERO_CHART_SURFACE_CLASS,
  TRAFFIC_HERO_FRAME_CLASS,
  TRAFFIC_HERO_METRICS_GRID_CLASS,
  TRAFFIC_HERO_TILES_CLASS,
} from "@/constants/geo-traffic-hero";
import { MCP_DEFAULT_CHART_METRIC } from "@/constants/mcp-analytics";
import type {
  McpAnalyticsHeroProps,
  McpChartMetric,
  McpMetric,
} from "@/types/mcp-analytics";
import { formatMilliseconds } from "@/utils/format";
import { errorRate, percentChange } from "@/utils/mcp-analytics";

/** Rate and latency changes only mean something once the last period had requests. */
function comparableChange(
  current: number,
  previous: number,
  previousRequests: number
): number | null {
  return previousRequests > 0 && previous > 0
    ? percentChange(current, previous)
    : null;
}

function useMcpMetrics({ totals }: McpAnalyticsHeroProps["data"]): McpMetric[] {
  const t = useTranslations("geo.pages.mcp.metrics");
  const format = useFormatter();
  const locale = useLocale();
  const rate = errorRate(totals.errors, totals.requests);
  return [
    {
      key: "toolCalls",
      label: t("toolCalls"),
      value: format.number(totals.toolCalls),
      delta: trafficVisitDelta(totals.toolCalls, totals.previousToolCalls),
    },
    {
      key: "sessions",
      label: t("sessions"),
      value: format.number(totals.sessions),
      delta: trafficVisitDelta(totals.sessions, totals.previousSessions),
    },
    {
      key: "errorRate",
      label: t("errorRate"),
      value: format.number(rate / 100, {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      delta: comparableChange(
        rate,
        errorRate(totals.previousErrors, totals.previousRequests),
        totals.previousRequests
      ),
      lowerIsBetter: true,
    },
    {
      key: "p95Latency",
      label: t("p95Latency"),
      value: formatMilliseconds(totals.p95Ms, locale),
      delta: comparableChange(
        totals.p95Ms,
        totals.previousP95Ms,
        totals.previousRequests
      ),
      lowerIsBetter: true,
    },
  ];
}

/**
 * The headline totals at a glance, over one chart. Each total is a button
 * that switches the chart to its own trend.
 */
export function McpAnalyticsHero({ data, range }: McpAnalyticsHeroProps) {
  const t = useTranslations("geo.pages.mcp.metrics");
  const metrics = useMcpMetrics(data);
  const [selectedKey, setSelectedKey] = useState<McpChartMetric>(
    MCP_DEFAULT_CHART_METRIC
  );
  const selected =
    metrics.find((metric) => metric.key === selectedKey) ?? metrics[0];

  return (
    <div className={TRAFFIC_HERO_FRAME_CLASS}>
      <div
        aria-label={t("chartLabel")}
        className={cn(
          TRAFFIC_HERO_METRICS_GRID_CLASS,
          TRAFFIC_HERO_TILES_CLASS
        )}
        role="group"
      >
        {metrics.map((metric) => (
          <TrafficHeroTile
            delta={metric.delta}
            key={metric.key}
            label={metric.label}
            lowerIsBetter={metric.lowerIsBetter}
            onSelect={() => setSelectedKey(metric.key)}
            selected={metric.key === selected?.key}
            value={metric.value}
          />
        ))}
      </div>
      {selected ? (
        <section
          aria-label={selected.label}
          className={cn(TRAFFIC_HERO_CHART_SURFACE_CLASS, "mt-0.5")}
        >
          <h2 className="mb-3 text-sm font-medium">{selected.label}</h2>
          <McpMetricChart data={data} metric={selected} range={range} />
        </section>
      ) : null}
    </div>
  );
}
