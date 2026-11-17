"use client";

import { GEO_JOURNEY_DEEP_CRAWL_PAGES } from "@notra/geo-core/constants/geo";
import { trafficVisitDelta } from "@notra/geo-core/utils/ai-traffic";
import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { JourneysMetricChart } from "@/components/geo/journeys-metric-chart";
import { TrafficHeroTile } from "@/components/geo/traffic-hero-tile";
import {
  JOURNEYS_DEFAULT_CHART_METRIC,
  TRAFFIC_HERO_CHART_SURFACE_CLASS,
  TRAFFIC_HERO_FRAME_CLASS,
  TRAFFIC_HERO_METRICS_GRID_CLASS,
  TRAFFIC_HERO_TILES_CLASS,
} from "@/constants/geo-traffic-hero";
import { cn } from "@/lib/utils";
import type {
  JourneysChartMetric,
  JourneysHeroMetric,
  JourneysHeroProps,
} from "@/types/geo";
import {
  formatJourneyShare,
  journeyAverageDepth,
  journeyTotals,
} from "@/utils/geo-journey";

/**
 * The journey totals over one chart, like the MCP hero: each total is a
 * button that switches the chart to its own daily trend.
 */
export function JourneysHero({
  sources,
  pages,
  days,
  totalPages,
  previousTotalPages,
}: JourneysHeroProps) {
  const t = useTranslations("geo.journeysTab");
  const tCommon = useTranslations("common");
  const tGeoShared = useTranslations("geo.shared");
  const locale = useLocale();
  const format = useFormatter();
  const [selectedKey, setSelectedKey] = useState<JourneysChartMetric>(
    JOURNEYS_DEFAULT_CHART_METRIC
  );
  const totals = journeyTotals(sources);
  const showTrend = days.length > 1;
  const metrics: JourneysHeroMetric[] = [
    {
      key: "journeys",
      label: tCommon("labels.journeys"),
      value: format.number(totals.journeys),
      delta: trafficVisitDelta(totals.journeys, totals.previousJourneys),
    },
    {
      key: "pages",
      label: tGeoShared("fetchedPages"),
      value: format.number(totalPages),
      delta: trafficVisitDelta(totalPages, previousTotalPages),
    },
    {
      key: "depth",
      label: tGeoShared("avgDepth"),
      value: journeyAverageDepth(totals.pages, totals.journeys).toLocaleString(
        locale
      ),
    },
    {
      key: "deepCrawls",
      label: tGeoShared("crawledPagesPages", {
        pages: GEO_JOURNEY_DEEP_CRAWL_PAGES,
      }),
      value: formatJourneyShare(totals.deepCrawls, totals.journeys),
    },
  ];
  const selected =
    metrics.find((metric) => metric.key === selectedKey) ?? metrics[0];

  return (
    <div className={TRAFFIC_HERO_FRAME_CLASS}>
      <div
        aria-label={t("activity")}
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
            onSelect={() => setSelectedKey(metric.key)}
            selected={!showTrend || metric.key === selected?.key}
            value={metric.value}
          />
        ))}
      </div>
      {showTrend && selected ? (
        <section
          aria-label={selected.label}
          className={cn(TRAFFIC_HERO_CHART_SURFACE_CLASS, "mt-0.5")}
        >
          <h2 className="mb-3 text-sm font-medium">{selected.label}</h2>
          <JourneysMetricChart
            days={days}
            metric={selected}
            pages={pages}
            sources={sources}
          />
        </section>
      ) : null}
    </div>
  );
}
