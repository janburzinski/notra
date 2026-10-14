"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GEO_CITATIONS_ROW_HEIGHT,
  GEO_PURPOSE_COLUMN_WIDTH,
  GEO_TRAFFIC_FUNNEL_STAGES,
} from "@notra/geo-core/constants/geo";
import { InstrumentSection } from "@notra/ui/components/instrument/instrument-module";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  DataTable,
  type TableColumn,
} from "@notra/ui/components/ui/data-table";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import {
  DEFAULT_MIN_COLUMN_WIDTH,
  TABLE_FRAME_INSET,
} from "@notra/ui/constants/table";
import { useCollapsibleColumns } from "@notra/ui/hooks/use-collapsible-columns";
import { useIsMobile } from "@notra/ui/hooks/use-mobile";
import { tableMinWidthCss } from "@notra/ui/lib/data-table";
import type { CSSProperties } from "react";
import { useTranslations } from "use-intl";

import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { PageContainer } from "@/components/layout/container";
import {
  GEO_COUNT_COLUMN_WIDTH,
  PAGE_COLUMN_WIDTH,
  PAGE_SKELETON_ROWS,
  SOURCE_COLUMN_WIDTH,
} from "@/constants/geo-table";
import {
  TRAFFIC_HERO_CHART_SURFACE_CLASS,
  TRAFFIC_HERO_FRAME_CLASS,
  TRAFFIC_HERO_METRIC_CELL_CLASS,
  TRAFFIC_HERO_METRICS_GRID_CLASS,
  TRAFFIC_HERO_METRICS_SURFACE_CLASS,
} from "@/constants/geo-traffic-hero";
import {
  TRAFFIC_SOURCE_BAND_LABEL_KEYS,
  TRAFFIC_SOURCE_COLUMN_MIN_WIDTH,
} from "@/constants/geo-traffic-sources";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { cn } from "@/lib/utils";
import type {
  GeoTrafficSkeletonProps,
  TrafficSourceBandSkeletonProps,
  TrafficTableSkeletonProps,
} from "@/types/geo";
import { paginatedTableHeightFor } from "@/utils/table";

const CRAWLER_ROW_COUNT = 4;
const REFERRAL_ROW_COUNT = 2;
const LOG_ROW_COUNT = 6;

function TrafficTableSkeleton({
  columns,
  rows,
  rowHeight = TABLE_ROW_HEIGHT,
  flushTop = false,
  flushBottom = false,
}: TrafficTableSkeletonProps) {
  return (
    <DataTable
      columns={columns}
      data={[]}
      flushBottom={flushBottom}
      flushTop={flushTop}
      height={paginatedTableHeightFor(rows, rowHeight)}
      loading
      rowHeight={rowHeight}
      scrollFade={false}
    />
  );
}

function TrafficSourceBandSkeleton({
  band,
  columns,
  rows,
  stacked,
  followedByStack,
}: TrafficSourceBandSkeletonProps) {
  const tGeoShared = useTranslations("geo.shared");
  const [first, ...rest] = columns;
  const header = (
    <span className="flex min-w-max items-center gap-2">
      <span className="text-muted-foreground -ml-1 flex size-6 shrink-0 items-center justify-center">
        <HugeiconsIcon
          className="rotate-90"
          icon={ArrowRight01Icon}
          size={14}
        />
      </span>
      <span className="text-foreground shrink-0 text-sm font-semibold">
        {tGeoShared(TRAFFIC_SOURCE_BAND_LABEL_KEYS[band])}
      </span>
      <Skeleton className="h-3 w-12" />
    </span>
  );

  return (
    <TrafficTableSkeleton
      columns={first === undefined ? columns : [{ ...first, header }, ...rest]}
      flushBottom={followedByStack}
      flushTop={stacked}
      rows={rows}
    />
  );
}

function TrafficSourcesSkeleton() {
  const tCommon = useTranslations("common");
  const tGeoShared = useTranslations("geo.shared");
  const isMobile = useIsMobile();
  const columns: TableColumn<unknown>[] = [
    {
      key: "source",
      header: tCommon("labels.source"),
      width: "1fr",
      minWidth: TRAFFIC_SOURCE_COLUMN_MIN_WIDTH.source,
    },
    {
      key: "category",
      header: tGeoShared("purpose"),
      width: isMobile
        ? TRAFFIC_SOURCE_COLUMN_MIN_WIDTH.categoryMobile
        : TRAFFIC_SOURCE_COLUMN_MIN_WIDTH.category,
    },
    {
      key: "visits",
      header: tGeoShared("visits"),
      width: isMobile
        ? TRAFFIC_SOURCE_COLUMN_MIN_WIDTH.visitsMobile
        : TRAFFIC_SOURCE_COLUMN_MIN_WIDTH.visits,
    },
    ...(isMobile
      ? []
      : ([
          {
            key: "paths",
            header: tGeoShared("pages"),
            width: TRAFFIC_SOURCE_COLUMN_MIN_WIDTH.paths,
            align: "right",
            collapsePriority: 1,
          },
          {
            key: "lastSeenAt",
            header: tGeoShared("lastSeen"),
            width: TRAFFIC_SOURCE_COLUMN_MIN_WIDTH.lastSeenAt,
            collapsePriority: 2,
          },
        ] satisfies TableColumn<unknown>[])),
  ];
  const { containerRef, visibleColumns } = useCollapsibleColumns(columns, {
    minColumnWidth: DEFAULT_MIN_COLUMN_WIDTH,
    extraFixedWidths: [TABLE_FRAME_INSET],
  });
  const minWidth = tableMinWidthCss(visibleColumns, DEFAULT_MIN_COLUMN_WIDTH, [
    TABLE_FRAME_INSET,
  ]);

  return (
    <div className="min-w-0 overflow-x-auto" ref={containerRef}>
      <div
        className="w-full min-w-(--traffic-sources-min-width)"
        style={{ "--traffic-sources-min-width": minWidth } as CSSProperties}
      >
        <TrafficSourceBandSkeleton
          band="crawler"
          columns={visibleColumns}
          followedByStack
          rows={CRAWLER_ROW_COUNT}
          stacked={false}
        />
        <TrafficSourceBandSkeleton
          band="ai_referral"
          columns={visibleColumns}
          followedByStack={false}
          rows={REFERRAL_ROW_COUNT}
          stacked
        />
      </div>
    </div>
  );
}

function TrafficPagesSkeleton() {
  const tGeoShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  const columns: TableColumn<unknown>[] = [
    { key: "path", header: tGeoShared("page"), width: PAGE_COLUMN_WIDTH },
    {
      key: "sources",
      header: tCommon("labels.sources"),
      width: SOURCE_COLUMN_WIDTH,
    },
    {
      key: "visits",
      header: tGeoShared("visits"),
      width: GEO_COUNT_COLUMN_WIDTH,
      align: "right",
    },
  ];

  return (
    <InstrumentSection
      action={
        <Skeleton className="h-8 w-full min-w-40 rounded-lg @min-[32rem]/instrument:w-80" />
      }
      eyebrow={tGeoShared("topPagesByAiSource")}
    >
      <TrafficTableSkeleton columns={columns} rows={PAGE_SKELETON_ROWS} />
    </InstrumentSection>
  );
}

function TrafficLogSkeleton() {
  const t = useTranslations("geo.citationsTable");
  const tGeoShared = useTranslations("geo.shared");
  const columns: TableColumn<unknown>[] = [
    { key: "capturedAt", header: t("columns.when"), width: "8.5rem" },
    { key: "source", header: tGeoShared("provider"), width: "13rem" },
    { key: "path", header: tGeoShared("page"), width: "1fr" },
    {
      key: "category",
      header: tGeoShared("purpose"),
      width: GEO_PURPOSE_COLUMN_WIDTH,
      collapsePriority: 1,
    },
    {
      key: "country",
      header: tGeoShared("country"),
      width: "10.5rem",
      collapsePriority: 2,
    },
  ];

  return (
    <InstrumentSection
      action={<Skeleton className="h-7 w-20 rounded-lg" />}
      eyebrow={tGeoShared("recentAiRequests")}
    >
      <TrafficTableSkeleton
        columns={columns}
        rowHeight={GEO_CITATIONS_ROW_HEIGHT}
        rows={LOG_ROW_COUNT}
      />
    </InstrumentSection>
  );
}

export function GeoTrafficSkeleton({ geoRange }: GeoTrafficSkeletonProps) {
  const t = useTranslations("geo.pages.traffic");
  const tHero = useTranslations("geo.trafficHero");
  const tCommon = useTranslations("common");
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full min-w-0 space-y-6 px-4 lg:px-6">
        <PageHeading description={t("description")} title={t("title")}>
          {geoRange ? (
            <GeoRangePicker control={geoRange} />
          ) : (
            <Skeleton className="h-7 w-40 rounded-lg" />
          )}
        </PageHeading>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Skeleton className="h-7 w-28 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
          <div className="flex flex-col gap-6">
            <div className={TRAFFIC_HERO_FRAME_CLASS}>
              <div
                className={cn(
                  TRAFFIC_HERO_METRICS_GRID_CLASS,
                  TRAFFIC_HERO_METRICS_SURFACE_CLASS
                )}
              >
                {GEO_TRAFFIC_FUNNEL_STAGES.map((stage) => (
                  <div
                    className={TRAFFIC_HERO_METRIC_CELL_CLASS}
                    key={stage.key}
                  >
                    <Skeleton className="h-5 w-28" />
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <Skeleton className="h-6 w-14 @4xl/hero:h-8 @4xl/hero:w-16" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
              <div className={TRAFFIC_HERO_CHART_SURFACE_CLASS}>
                <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                  <h2 className="text-sm font-medium">{tHero("activity")}</h2>
                  <Skeleton className="h-7 w-24 rounded-lg" />
                </div>
                <Skeleton className="h-52 w-full rounded-xl @md/hero:h-72" />
              </div>
            </div>
            <InstrumentSection eyebrow={tCommon("labels.sources")}>
              <TrafficSourcesSkeleton />
            </InstrumentSection>
            <TrafficPagesSkeleton />
            <TrafficLogSkeleton />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
