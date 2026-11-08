"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { InstrumentSection } from "ui/card";
import type { TableColumn } from "ui/table";
import { useTranslations } from "use-intl";

import { TrafficTrendLegendSkeleton } from "@/components/geo/skeleton-parts";
import { TrafficPageSkeletonFrame } from "@/components/geo/traffic-page-skeleton-frame";
import { WebVitalsCard } from "@/components/geo/web-vitals-card";
import { GEO_COUNT_COLUMN_WIDTH } from "@/constants/geo-table";
import {
  TRAFFIC_HERO_CHART_SURFACE_CLASS,
  TRAFFIC_HERO_FRAME_CLASS,
  TRAFFIC_HERO_METRIC_CELL_CLASS,
  TRAFFIC_HERO_METRICS_GRID_CLASS,
  TRAFFIC_HERO_METRICS_SURFACE_CLASS,
} from "@/constants/geo-traffic-hero";
import {
  WEB_LIST_LIMIT,
  WEB_OUTCOMES_SKELETON_ROWS,
  WEB_TABLE_ROW_HEIGHT,
} from "@/constants/web-analytics";
import { cn } from "@/lib/utils";
import type { WebBreakdownSkeletonProps } from "@/types/geo";
import type { TrafficPageSkeletonProps } from "@/types/geo-traffic-pages";

import { TrafficTableSkeleton } from "../skeleton";

function WebBreakdownSkeleton({
  title,
  nameHeader,
  valueHeader,
}: WebBreakdownSkeletonProps) {
  const columns: TableColumn<unknown>[] = [
    { key: "name", header: nameHeader, width: "1fr" },
    {
      key: "value",
      header: valueHeader,
      width: GEO_COUNT_COLUMN_WIDTH,
      align: "right",
    },
  ];
  return (
    <InstrumentSection eyebrow={title}>
      <TrafficTableSkeleton
        columns={columns}
        rowHeight={WEB_TABLE_ROW_HEIGHT}
        rows={WEB_LIST_LIMIT}
      />
    </InstrumentSection>
  );
}

/** Mirrors WebVisitorsSection: hero with four metrics and the trend, then the breakdowns. */
function WebVisitorsSkeleton() {
  const t = useTranslations("geo.webVisitors");
  return (
    <section className="flex flex-col gap-6">
      <div className={TRAFFIC_HERO_FRAME_CLASS}>
        <div
          className={cn(
            TRAFFIC_HERO_METRICS_GRID_CLASS,
            TRAFFIC_HERO_METRICS_SURFACE_CLASS
          )}
        >
          {[t("visitors"), t("views"), t("fromAi"), t("avgTime")].map(
            (label) => (
              <div className={TRAFFIC_HERO_METRIC_CELL_CLASS} key={label}>
                <p className="text-foreground/75 text-sm leading-5 font-semibold tracking-tight">
                  {label}
                </p>
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <Skeleton className="h-6 w-14 @4xl/hero:h-7.5 @4xl/hero:w-16" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            )
          )}
        </div>
        <div className={TRAFFIC_HERO_CHART_SURFACE_CLASS}>
          <Skeleton className="h-52 w-full rounded-xl @md/hero:h-64" />
          <TrafficTrendLegendSkeleton items={1} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <WebBreakdownSkeleton
          nameHeader={t("page")}
          title={t("topPages")}
          valueHeader={t("columnViews")}
        />
        <WebBreakdownSkeleton
          nameHeader={t("columnSource")}
          title={t("referrers")}
          valueHeader={t("sessions")}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <WebBreakdownSkeleton
          nameHeader={t("columnCountry")}
          title={t("countries")}
          valueHeader={t("visitors")}
        />
        <WebBreakdownSkeleton
          nameHeader={t("columnDevice")}
          title={t("devices")}
          valueHeader={t("visitors")}
        />
      </div>
      <InstrumentSection eyebrow={t("outcomesTitle")}>
        <TrafficTableSkeleton
          columns={[
            { key: "source", header: t("columnSource"), width: "1fr" },
            {
              key: "pages",
              header: t("pagesPerSession"),
              width: "10rem",
              align: "right",
            },
            {
              key: "engaged",
              header: t("engagedRate"),
              width: "8rem",
              align: "right",
            },
          ]}
          rowHeight={WEB_TABLE_ROW_HEIGHT}
          rows={WEB_OUTCOMES_SKELETON_ROWS}
        />
      </InstrumentSection>
      <div className="grid gap-4 lg:grid-cols-2">
        <WebBreakdownSkeleton
          nameHeader={t("columnLink")}
          title={t("outboundLinks")}
          valueHeader={t("columnClicks")}
        />
        <WebBreakdownSkeleton
          nameHeader={t("columnLanguage")}
          title={t("languages")}
          valueHeader={t("visitors")}
        />
      </div>
      <WebVitalsCard loading reports={undefined} />
    </section>
  );
}

export function WebAnalyticsSkeleton({ geoRange }: TrafficPageSkeletonProps) {
  const t = useTranslations("geo.pages.webAnalytics");
  return (
    <TrafficPageSkeletonFrame
      description={t("description")}
      geoRange={geoRange}
    >
      <WebVisitorsSkeleton />
    </TrafficPageSkeletonFrame>
  );
}
