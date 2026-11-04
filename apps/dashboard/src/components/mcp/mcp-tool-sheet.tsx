"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import type {
  McpAnalyticsIntent,
  McpAnalyticsUser,
  McpToolFailure,
} from "@notra/geo-core/types/mcp-analytics";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { DetailSheetContent } from "@notra/ui/components/ui/detail-sheet";
import { Sheet } from "@notra/ui/components/ui/sheet";
import { DataTable, type TableColumn } from "ui/table";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { TrafficSheetHero } from "@/components/geo/traffic-sheet-hero";
import { McpRequestStatusBadge } from "@/components/mcp/mcp-request-sheet";
import {
  McpSheetHeader,
  McpTableEmpty,
} from "@/components/mcp/mcp-sheet-parts";
import {
  MCP_SHEET_ROW_HEIGHT,
  MCP_TOOL_SHEET_ICON,
  MCP_UI_TOOL_BADGE,
} from "@/constants/mcp-analytics";
import { useMcpToolDetail } from "@/lib/hooks/use-mcp-analytics";
import type { SheetStat } from "@/types/geo";
import type {
  McpNeighborRow,
  McpNeighborTableProps,
  McpToolSheetProps,
} from "@/types/mcp-analytics";
import { formatMilliseconds } from "@/utils/format";
import {
  errorRate,
  mcpNeighborRows,
  mcpTableHeight,
} from "@/utils/mcp-analytics";

/** Calls right before or after the tool; a tool row opens that tool's sheet. */
function McpNeighborTable({
  title,
  edgeLabel,
  neighbors,
  loading,
  onSelectTool,
}: McpNeighborTableProps) {
  const t = useTranslations("geo.pages.mcp");
  const format = useFormatter();
  const rows = mcpNeighborRows(neighbors);
  const columns: TableColumn<McpNeighborRow>[] = [
    {
      key: "tool",
      header: title,
      width: "1fr",
      cell: (row) =>
        row.tool ? (
          <span className="min-w-0 truncate font-mono text-sm">{row.tool}</span>
        ) : (
          <span className="text-muted-foreground text-sm">{edgeLabel}</span>
        ),
    },
    {
      key: "afterFailure",
      header: t("toolSheet.afterFailureColumn"),
      width: "7.5rem",
      align: "right",
      collapsePriority: 1,
      cell: (row) =>
        row.afterFailure > 0 ? (
          <span className="text-badge-warning tabular-nums">
            {format.number(row.afterFailure)}
          </span>
        ) : (
          <span className="text-muted-foreground">–</span>
        ),
    },
    {
      key: "share",
      header: t("toolSheet.share"),
      width: "5rem",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums">
          {format.number(row.share / 100, { style: "percent" })}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyState={<McpTableEmpty description={t("toolSheet.noCalls")} />}
      getRowId={(row) => row.key}
      height={mcpTableHeight(rows.length, MCP_SHEET_ROW_HEIGHT)}
      isRowClickable={(row) => row.tool !== ""}
      loading={loading}
      onRowClick={(row) => onSelectTool(row.tool)}
      rowHeight={MCP_SHEET_ROW_HEIGHT}
    />
  );
}

export function McpToolSheet({
  organizationId,
  range,
  tool,
  open,
  onOpenChange,
  onSelectTool,
}: McpToolSheetProps) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("geo.pages.mcp");
  const { data, isPending } = useMcpToolDetail(
    organizationId,
    range,
    tool?.name ?? null
  );
  const loading = isPending && Boolean(tool);
  const stats: SheetStat[] = tool
    ? [
        { label: t("columns.calls"), value: format.number(tool.calls) },
        {
          label: t("metrics.errorRate"),
          value: format.number(errorRate(tool.errors, tool.calls) / 100, {
            style: "percent",
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }),
        },
        {
          label: t("metrics.p95Latency"),
          value: formatMilliseconds(tool.p95Ms, locale),
        },
      ]
    : [];

  const failureColumns: TableColumn<McpToolFailure>[] = [
    {
      key: "message",
      header: t("toolSheet.failures"),
      width: "1fr",
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm">
            {row.message || t("toolSheet.noErrorMessage")}
          </span>
          <span className="text-muted-foreground truncate font-mono text-xs">
            {row.clientName || t("fallback.unknownClient")}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      width: "8.5rem",
      collapsePriority: 1,
      cell: (row) => <McpRequestStatusBadge entry={row} />,
    },
    {
      key: "calls",
      header: t("columns.calls"),
      width: "4.5rem",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums">{format.number(row.calls)}</span>
      ),
    },
  ];
  const intentColumns: TableColumn<McpAnalyticsIntent>[] = [
    {
      key: "intent",
      header: t("toolSheet.wanted"),
      width: "1fr",
      cell: (row) => <span className="truncate text-sm">{row.intent}</span>,
    },
    {
      key: "calls",
      header: t("columns.calls"),
      width: "4.5rem",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums">{format.number(row.calls)}</span>
      ),
    },
  ];
  const userColumns: TableColumn<McpAnalyticsUser>[] = [
    {
      key: "id",
      header: t("toolSheet.topUsers"),
      width: "1fr",
      cell: (row) => (
        <span className="truncate font-mono text-sm">{row.id}</span>
      ),
    },
    {
      key: "calls",
      header: t("columns.calls"),
      width: "4.5rem",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums">{format.number(row.calls)}</span>
      ),
    },
  ];
  const failures = data?.failures ?? [];
  const intents = data?.intents ?? [];
  const users = data?.users ?? [];

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <DetailSheetContent size="md">
        {tool ? (
          <>
            <McpSheetHeader
              description={tool.description || t("toolSheet.noDescription")}
              icon={
                <HugeiconsIcon aria-hidden="true" icon={MCP_TOOL_SHEET_ICON} />
              }
              title={
                <>
                  <span className="min-w-0 truncate font-mono">
                    {tool.name}
                  </span>
                  {tool.uiResource ? (
                    <StatusBadge
                      appearance={MCP_UI_TOOL_BADGE}
                      label={t("uiBadge")}
                    />
                  ) : null}
                </>
              }
            />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pt-2 pb-6">
              <TrafficSheetHero
                chartLabel=""
                chartTitle=""
                series={[]}
                stats={stats}
              />
              <McpNeighborTable
                edgeLabel={t("toolSheet.sessionStart")}
                loading={loading}
                neighbors={data?.before ?? []}
                onSelectTool={onSelectTool}
                title={t("toolSheet.calledBefore")}
              />
              <McpNeighborTable
                edgeLabel={t("toolSheet.sessionEnd")}
                loading={loading}
                neighbors={data?.after ?? []}
                onSelectTool={onSelectTool}
                title={t("toolSheet.calledAfter")}
              />
              <DataTable
                columns={failureColumns}
                data={failures}
                emptyState={
                  <McpTableEmpty description={t("toolSheet.noFailures")} />
                }
                getRowId={(row) => `${row.message}-${row.clientName}`}
                height={mcpTableHeight(failures.length, MCP_SHEET_ROW_HEIGHT)}
                loading={loading}
                rowHeight={MCP_SHEET_ROW_HEIGHT}
              />
              <DataTable
                columns={intentColumns}
                data={intents}
                emptyState={
                  <McpTableEmpty description={t("toolSheet.wantedEmpty")} />
                }
                getRowId={(row) => row.intent}
                height={mcpTableHeight(intents.length, MCP_SHEET_ROW_HEIGHT)}
                loading={loading}
                rowHeight={MCP_SHEET_ROW_HEIGHT}
              />
              <DataTable
                columns={userColumns}
                data={users}
                emptyState={
                  <McpTableEmpty description={t("toolSheet.topUsersEmpty")} />
                }
                getRowId={(row) => row.id}
                height={mcpTableHeight(users.length, MCP_SHEET_ROW_HEIGHT)}
                loading={loading}
                rowHeight={MCP_SHEET_ROW_HEIGHT}
              />
            </div>
          </>
        ) : null}
      </DetailSheetContent>
    </Sheet>
  );
}
