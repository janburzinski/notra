"use client";

import { InstrumentSection } from "@notra/ui/components/instrument/instrument-module";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  DataTable,
  type TableColumn,
} from "@notra/ui/components/ui/data-table";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useTranslations } from "use-intl";

import { AnalyticsSourceTabs } from "@/components/analytics/analytics-source-tabs";
import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { PageContainer } from "@/components/layout/container";
import { McpChartHeader } from "@/components/mcp/mcp-chart-header";
import {
  TRAFFIC_HERO_CHART_SURFACE_CLASS,
  TRAFFIC_HERO_FRAME_CLASS,
  TRAFFIC_HERO_METRIC_CELL_CLASS,
  TRAFFIC_HERO_METRICS_GRID_CLASS,
  TRAFFIC_HERO_METRICS_SURFACE_CLASS,
} from "@/constants/geo-traffic-hero";
import { MCP_TOOLS_SKELETON_ROWS } from "@/constants/mcp-analytics";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { cn } from "@/lib/utils";
import type { McpTrafficSkeletonProps } from "@/types/mcp-analytics";
import { paginatedTableHeightFor } from "@/utils/table";

/** Mirrors the MCP tab: same header and tab row as Website, then hero and tools. */
export function McpTrafficSkeleton({ geoRange }: McpTrafficSkeletonProps) {
  const t = useTranslations("geo.pages");
  const tMetrics = useTranslations("geo.pages.mcp.metrics");
  const toolColumns: TableColumn<unknown>[] = [
    {
      key: "name",
      header: t("mcp.columns.tool"),
      width: "2fr",
      sortable: true,
    },
    {
      key: "calls",
      header: t("mcp.columns.calls"),
      align: "right",
      sortable: true,
    },
    {
      key: "users",
      header: t("mcp.columns.users"),
      align: "right",
      sortable: true,
      collapsePriority: 3,
    },
    {
      key: "errorRate",
      header: t("mcp.columns.errors"),
      align: "right",
      sortable: true,
    },
    {
      key: "p95Ms",
      header: t("mcp.columns.p95"),
      align: "right",
      sortable: true,
      collapsePriority: 1,
    },
    {
      key: "avgResponseBytes",
      header: t("mcp.columns.avgResponse"),
      align: "right",
      sortable: true,
      collapsePriority: 2,
    },
  ];
  const metricLabels = [
    tMetrics("toolCalls"),
    tMetrics("sessions"),
    tMetrics("errorRate"),
    tMetrics("p95Latency"),
  ];

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full min-w-0 space-y-6 px-4 lg:px-6">
        <PageHeading
          description={t("mcp.description")}
          title={t("traffic.title")}
        >
          <div className="flex min-h-8 items-center">
            {geoRange ? (
              <GeoRangePicker control={geoRange} />
            ) : (
              <Skeleton className="h-7 w-36 rounded-lg" />
            )}
          </div>
        </PageHeading>
        <AnalyticsSourceTabs
          actions={<Skeleton className="h-6 w-60 rounded-md" />}
        />
        <div className={TRAFFIC_HERO_FRAME_CLASS}>
          <div
            className={cn(
              TRAFFIC_HERO_METRICS_GRID_CLASS,
              TRAFFIC_HERO_METRICS_SURFACE_CLASS
            )}
          >
            {metricLabels.map((label) => (
              <div className={TRAFFIC_HERO_METRIC_CELL_CLASS} key={label}>
                <p className="text-foreground/75 text-sm leading-5 font-semibold tracking-tight">
                  {label}
                </p>
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <Skeleton className="h-6 w-14 @4xl/hero:h-7.5 @4xl/hero:w-16" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
          <div className={TRAFFIC_HERO_CHART_SURFACE_CLASS}>
            <McpChartHeader />
            <Skeleton className="h-52 w-full rounded-xl @md/hero:h-72" />
          </div>
        </div>
        <InstrumentSection
          eyebrow={t("mcp.tools.title")}
          hint={t("mcp.tools.hint")}
          readout={<Skeleton className="inline-block h-3 w-24 align-middle" />}
        >
          <DataTable
            columns={toolColumns}
            data={[]}
            height={paginatedTableHeightFor(MCP_TOOLS_SKELETON_ROWS)}
            loading
            rowHeight={TABLE_ROW_HEIGHT}
            scrollFade={false}
          />
        </InstrumentSection>
      </div>
    </PageContainer>
  );
}
