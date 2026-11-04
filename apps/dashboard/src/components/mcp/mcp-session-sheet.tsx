"use client";

import type { McpSessionEvent } from "@notra/geo-core/types/mcp-analytics";
import { DetailSheetContent } from "@notra/ui/components/ui/detail-sheet";
import { Sheet } from "@notra/ui/components/ui/sheet";
import { useState } from "react";
import { DataTable, type TableColumn } from "ui/table";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { AgentFeedbackAgentIcon } from "@/components/agent-feedback/feedback-agent-icon";
import { TrafficSheetHero } from "@/components/geo/traffic-sheet-hero";
import {
  McpRequestSheet,
  McpRequestStatusBadge,
} from "@/components/mcp/mcp-request-sheet";
import {
  McpPropertyTable,
  McpSheetHeader,
  McpTableEmpty,
} from "@/components/mcp/mcp-sheet-parts";
import { MCP_SHEET_ROW_HEIGHT } from "@/constants/mcp-analytics";
import { useMcpSession } from "@/lib/hooks/use-mcp-analytics";
import type { SheetStat } from "@/types/geo";
import type { McpSessionSheetProps } from "@/types/mcp-analytics";
import { formatMilliseconds } from "@/utils/format";
import {
  mcpSessionRequest,
  mcpTableHeight,
  mcpVsAverage,
  sessionDurationSeconds,
} from "@/utils/mcp-analytics";

export function McpSessionSheet({
  organizationId,
  range,
  session,
  averages,
  open,
  onOpenChange,
}: McpSessionSheetProps) {
  const format = useFormatter();
  const locale = useLocale();
  const t = useTranslations("geo.pages.mcp");
  const [selectedEvent, setSelectedEvent] = useState<McpSessionEvent | null>(
    null
  );
  const [requestOpen, setRequestOpen] = useState(false);
  const { data, isPending } = useMcpSession(
    organizationId,
    range,
    session?.id ?? null
  );
  const events = data?.events ?? [];
  const startedAt = session ? Date.parse(session.startedAt) : 0;
  const client = session?.clientName || t("fallback.unknownClient");
  const durationSeconds = session
    ? sessionDurationSeconds(session.startedAt, session.endedAt)
    : 0;
  const vsAverage = t("sessionSheet.vsAverage");
  const stats: SheetStat[] = session
    ? [
        {
          label: t("columns.requests"),
          value: format.number(session.requests),
          delta: averages
            ? mcpVsAverage(session.requests, averages.requests)
            : undefined,
          deltaHint: vsAverage,
          deltaNeutral: true,
        },
        {
          label: t("columns.toolCalls"),
          value: format.number(session.toolCalls),
          delta: averages
            ? mcpVsAverage(session.toolCalls, averages.toolCalls)
            : undefined,
          deltaHint: vsAverage,
          deltaNeutral: true,
        },
        {
          label: t("sessionSheet.duration"),
          value: t("seconds", { count: durationSeconds }),
          delta: averages
            ? mcpVsAverage(durationSeconds, averages.durationSeconds)
            : undefined,
          deltaHint: vsAverage,
          deltaNeutral: true,
        },
      ]
    : [];

  const columns: TableColumn<McpSessionEvent>[] = [
    {
      key: "offset",
      header: t("sessionSheet.time"),
      width: "6rem",
      cell: (row) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          +
          {Math.max(
            0,
            Math.round((Date.parse(row.capturedAt) - startedAt) / 1000)
          )}
          s
        </span>
      ),
    },
    {
      key: "request",
      header: t("sessionSheet.request"),
      width: "1fr",
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2 font-mono text-sm">
          <span className="shrink-0">{row.method}</span>
          {row.target ? (
            <span className="text-muted-foreground truncate">{row.target}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      width: "8.5rem",
      cell: (row) => <McpRequestStatusBadge entry={row} />,
    },
    {
      key: "duration",
      header: t("columns.duration"),
      width: "5rem",
      align: "right",
      collapsePriority: 1,
      cell: (row) => (
        <span className="tabular-nums">
          {formatMilliseconds(row.durationMs, locale)}
        </span>
      ),
    },
  ];

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <DetailSheetContent size="md">
        {session ? (
          <>
            <McpSheetHeader
              description={`${format.dateTime(new Date(session.startedAt), {
                dateStyle: "medium",
                timeStyle: "medium",
              })} · ${session.id}`}
              icon={<AgentFeedbackAgentIcon client={client} />}
              title={
                <span className="min-w-0 truncate">
                  {t("sessionSheet.title", { client })}
                </span>
              }
            />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pt-2 pb-6">
              <TrafficSheetHero
                chartLabel=""
                chartTitle=""
                series={[]}
                stats={stats}
              />
              {session.userId || session.model ? (
                <McpPropertyTable
                  rows={[
                    {
                      key: "user",
                      label: t("requestSheet.user"),
                      value: session.userId || null,
                    },
                    {
                      key: "model",
                      label: t("requestSheet.model"),
                      value: session.model || null,
                    },
                  ]}
                />
              ) : null}
              <DataTable
                columns={columns}
                data={events}
                emptyState={
                  <McpTableEmpty description={t("sessionSheet.noEvents")} />
                }
                getRowId={(row) => row.id}
                height={mcpTableHeight(events.length, MCP_SHEET_ROW_HEIGHT)}
                loading={isPending}
                onRowClick={(row) => {
                  setSelectedEvent(row);
                  setRequestOpen(true);
                }}
                rowHeight={MCP_SHEET_ROW_HEIGHT}
              />
            </div>
            {/* Opens on top of this sheet, the same view as the request log. */}
            <McpRequestSheet
              entry={
                selectedEvent ? mcpSessionRequest(selectedEvent, session) : null
              }
              onOpenChange={setRequestOpen}
              open={requestOpen}
            />
          </>
        ) : null}
      </DetailSheetContent>
    </Sheet>
  );
}
