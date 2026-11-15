"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { cn } from "@notra/ui/lib/utils";
import { InstrumentSection } from "ui/card";
import { DataTable, type TableColumn } from "ui/table";
import { useTranslations } from "use-intl";

import { AnalyticsSourceTabs } from "@/components/analytics/analytics-source-tabs";
import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { PageContainer } from "@/components/layout/container";
import {
  TRAFFIC_HERO_CHART_SURFACE_CLASS,
  TRAFFIC_HERO_FRAME_CLASS,
  TRAFFIC_HERO_METRICS_GRID_CLASS,
} from "@/constants/geo-traffic-hero";
import {
  MCP_HERO_METRIC_CELL_CLASS,
  MCP_HERO_METRICS_CLASS,
  MCP_TOOLS_SKELETON_ROWS,
} from "@/constants/mcp-analytics";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import type { McpTrafficSkeletonProps } from "@/types/mcp-analytics";
import { mcpTableHeight } from "@/utils/mcp-analytics";

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
        <AnalyticsSourceTabs />
        <div className={TRAFFIC_HERO_FRAME_CLASS}>
          <div
            className={cn(
              TRAFFIC_HERO_METRICS_GRID_CLASS,
              MCP_HERO_METRICS_CLASS
            )}
          >
            {metricLabels.map((label, index) => (
              <div
                className={MCP_HERO_METRIC_CELL_CLASS}
                data-selected={index === 0 ? "" : undefined}
                key={label}
              >
                <p
                  className={cn(
                    "text-sm leading-5 font-semibold tracking-tight",
                    index === 0 ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </p>
                <div className="flex flex-col items-start gap-2 @3xl/hero:flex-row @3xl/hero:items-center @3xl/hero:gap-3">
                  <Skeleton className="h-6 w-16 @4xl/hero:h-7" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              </div>
            ))}
          </div>
          <div className={cn(TRAFFIC_HERO_CHART_SURFACE_CLASS, "mt-0.5")}>
            <p className="mb-3 text-sm font-medium">{metricLabels[0]}</p>
            <Skeleton className="h-52 w-full rounded-xl @md/hero:h-72" />
          </div>
        </div>
        <InstrumentSection
          eyebrow={t("mcp.tools.title")}
          hint={t("mcp.tools.hint")}
        >
          <DataTable
            columns={toolColumns}
            data={[]}
            height={mcpTableHeight(MCP_TOOLS_SKELETON_ROWS)}
            loading
            rowHeight={TABLE_ROW_HEIGHT}
            scrollFade={false}
          />
        </InstrumentSection>
      </div>
    </PageContainer>
  );
}
