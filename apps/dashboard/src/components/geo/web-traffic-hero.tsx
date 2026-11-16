"use client";

import { GEO_EMPTY_TRAFFIC_RESPONSE } from "@notra/geo-core/constants/geo";
import {
  toGeoTrafficPreviousTotals,
  trafficVisitDelta,
} from "@notra/geo-core/utils/ai-traffic";
import { AnimatedNumber } from "@notra/ui/components/animated-number";
import { cn } from "@notra/ui/lib/utils";
import { useTranslations } from "use-intl";

import { GeoStatDelta } from "@/components/geo/geo-stat-delta";
import { WebTrendChart } from "@/components/geo/web-trend-chart";
import {
  TRAFFIC_HERO_FRAME_CLASS,
  TRAFFIC_HERO_METRIC_CELL_CLASS,
  TRAFFIC_HERO_METRIC_CELL_THREE_UP_CLASS,
  TRAFFIC_HERO_METRIC_VALUE_CLASS,
  TRAFFIC_HERO_METRICS_GRID_CLASS,
  TRAFFIC_HERO_METRICS_SURFACE_CLASS,
  TRAFFIC_HERO_METRICS_THREE_UP_GRID_CLASS,
} from "@/constants/geo-traffic-hero";
import type { WebMetricProps, WebTrafficHeroProps } from "@/types/geo";
import { hasPreviousTraffic } from "@/utils/ai-traffic-groups";
import {
  formatVisibleDuration,
  hasPreviousWebPeriod,
} from "@/utils/web-analytics";

function WebMetric({
  label,
  value,
  previous,
  format = "count",
  compare,
  threeUp,
}: WebMetricProps) {
  const tShared = useTranslations("geo.shared");
  const isDuration = format === "duration";
  const showDelta =
    compare &&
    previous !== null &&
    (!isDuration || (value > 0 && previous > 0));
  return (
    <div
      className={
        threeUp
          ? TRAFFIC_HERO_METRIC_CELL_THREE_UP_CLASS
          : TRAFFIC_HERO_METRIC_CELL_CLASS
      }
    >
      <p className="text-foreground/75 text-sm leading-5 font-semibold tracking-tight">
        {label}
      </p>
      <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 self-start">
        {isDuration ? (
          <span className={TRAFFIC_HERO_METRIC_VALUE_CLASS}>
            {value > 0 ? formatVisibleDuration(value) : "—"}
          </span>
        ) : (
          <AnimatedNumber
            className={TRAFFIC_HERO_METRIC_VALUE_CLASS}
            value={value}
          />
        )}
        {showDelta ? (
          <GeoStatDelta
            delta={trafficVisitDelta(value, previous ?? 0)}
            hint={tShared("vsPreviousPeriodOfThe")}
            label={label}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Visitor totals over the visitors trend, shared by Web analytics and its
 * public embed.
 */
export function WebTrafficHero({
  web,
  traffic,
  range,
  engagement,
  showMetrics = true,
  showChart = true,
}: WebTrafficHeroProps) {
  const t = useTranslations("geo.webVisitors");
  const { totals } = web;
  const aiTraffic = traffic ?? GEO_EMPTY_TRAFFIC_RESPONSE;
  const previousAi = toGeoTrafficPreviousTotals(
    aiTraffic.sources,
    aiTraffic.previousConversions
  );
  const compare = hasPreviousWebPeriod(web);
  // The fourth metric is time on page, or AI agents when the AI analytics page
  // shows people.
  const threeUp = !(traffic || engagement);

  return (
    <div className={TRAFFIC_HERO_FRAME_CLASS}>
      {showMetrics ? (
        <div
          className={cn(
            threeUp
              ? TRAFFIC_HERO_METRICS_THREE_UP_GRID_CLASS
              : TRAFFIC_HERO_METRICS_GRID_CLASS,
            showChart && TRAFFIC_HERO_METRICS_SURFACE_CLASS
          )}
        >
          <WebMetric
            compare={compare}
            label={t("visitors")}
            previous={totals.previousVisitors}
            threeUp={threeUp}
            value={totals.visitors}
          />
          <WebMetric
            compare={compare}
            label={t("views")}
            previous={totals.previousViews}
            threeUp={threeUp}
            value={totals.views}
          />
          <WebMetric
            compare={compare}
            label={t("fromAi")}
            previous={totals.previousAiVisitors}
            threeUp={threeUp}
            value={totals.aiVisitors}
          />
          {engagement ? (
            <WebMetric
              compare={compare}
              format="duration"
              label={t("avgTime")}
              previous={engagement.previousAvgSeconds}
              threeUp={threeUp}
              value={engagement.avgSeconds}
            />
          ) : null}
          {traffic ? (
            <WebMetric
              compare={hasPreviousTraffic(aiTraffic.sources)}
              label={t("agents")}
              previous={previousAi?.crawler ?? 0}
              threeUp={threeUp}
              value={aiTraffic.totals.crawler}
            />
          ) : null}
        </div>
      ) : null}
      {showChart ? (
        <WebTrendChart
          className={showMetrics ? undefined : "mt-0.5"}
          range={range}
          traffic={traffic}
          web={web}
        />
      ) : null}
    </div>
  );
}
