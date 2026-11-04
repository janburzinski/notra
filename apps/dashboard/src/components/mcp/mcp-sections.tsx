"use client";

import { trafficVisitDelta } from "@notra/geo-core/utils/ai-traffic";
import { InstrumentSection } from "@notra/ui/components/instrument/instrument-module";
import { Button } from "@notra/ui/components/ui/button";
import { DataTable } from "@notra/ui/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { CodeSnippet } from "@/components/geo/code-snippet";
import { McpMetricCard } from "@/components/mcp/mcp-metric-card";
import { McpTableEmpty } from "@/components/mcp/mcp-sheet-parts";
import {
  MCP_LOG_FILTERS,
  MCP_LOG_TABLE_HEIGHT,
  MCP_SETUP_SNIPPET,
} from "@/constants/mcp-analytics";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { useDesktopBreakpoint } from "@/lib/hooks/use-desktop-breakpoint";
import { useMcpColumns } from "@/lib/hooks/use-mcp-columns";
import type {
  McpAnalyticsHeroProps,
  McpAudienceSectionsProps,
  McpLoadFailedProps,
  McpLogFilter,
  McpMetric,
  McpRequestLogProps,
  McpToolSectionsProps,
} from "@/types/mcp-analytics";
import { formatMilliseconds } from "@/utils/format";
import {
  errorRate,
  mcpTableHeight,
  percentChange,
} from "@/utils/mcp-analytics";

/** Side by side, a pair of tables shares the taller height so the cards line up. */
function usePairHeight() {
  const sideBySide = useDesktopBreakpoint();
  return (first: number, second: number) =>
    sideBySide
      ? Math.max(mcpTableHeight(first), mcpTableHeight(second))
      : undefined;
}

export function McpSetupPrompt() {
  const t = useTranslations("geo.pages.mcp.setup");
  return (
    <InstrumentSection eyebrow={t("title")} hint={t("hint")}>
      <CodeSnippet code={MCP_SETUP_SNIPPET} filename="server.ts" />
    </InstrumentSection>
  );
}

export function McpLoadFailed({ onRetry }: McpLoadFailedProps) {
  const t = useTranslations("geo.pages.mcp.loadFailed");
  const tActions = useTranslations("common.actions");
  return (
    <InstrumentSection eyebrow={t("title")} hint={t("hint")}>
      <Button onClick={() => onRetry()} size="sm" variant="outline">
        {tActions("tryAgain")}
      </Button>
    </InstrumentSection>
  );
}

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

export function McpAnalyticsHero({ data, range }: McpAnalyticsHeroProps) {
  const metrics = useMcpMetrics(data);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {metrics.map((metric) => (
        <McpMetricCard
          data={data}
          key={metric.key}
          metric={metric}
          range={range}
        />
      ))}
    </div>
  );
}

export function McpToolSections({ data, onOpenTool }: McpToolSectionsProps) {
  const t = useTranslations("geo.pages.mcp");
  const columns = useMcpColumns();
  const unusedTools = data.catalog?.unusedTools ?? [];
  return (
    <>
      <InstrumentSection eyebrow={t("tools.title")} hint={t("tools.hint")}>
        <DataTable
          columns={columns.tools}
          data={data.tools}
          defaultSort={{ key: "calls", direction: "desc" }}
          getRowId={(row) => row.name}
          height={mcpTableHeight(data.tools.length)}
          onRowClick={(row) => onOpenTool(row.name)}
          rowHeight={TABLE_ROW_HEIGHT}
        />
      </InstrumentSection>
      {unusedTools.length > 0 ? (
        <InstrumentSection eyebrow={t("unused.title")} hint={t("unused.hint")}>
          <DataTable
            columns={columns.unusedTools}
            data={unusedTools}
            defaultSort={{ key: "name", direction: "asc" }}
            getRowId={(row) => row.name}
            height={mcpTableHeight(unusedTools.length)}
            rowHeight={TABLE_ROW_HEIGHT}
          />
        </InstrumentSection>
      ) : null}
    </>
  );
}

export function McpServerRequestSections({
  data,
  onOpenTool,
}: McpToolSectionsProps) {
  const t = useTranslations("geo.pages.mcp");
  const columns = useMcpColumns();
  const pairHeight = usePairHeight();
  const height = pairHeight(data.elicitations.length, data.uiRenders.length);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InstrumentSection
        eyebrow={t("elicitations.title")}
        hint={t("elicitations.hint")}
      >
        <DataTable
          columns={columns.elicitations}
          data={data.elicitations}
          defaultSort={{ key: "requests", direction: "desc" }}
          emptyState={<McpTableEmpty description={t("elicitations.empty")} />}
          getRowId={(row) => `${row.method}-${row.tool}`}
          height={height ?? mcpTableHeight(data.elicitations.length)}
          minHeight={height}
          onRowClick={(row) => (row.tool ? onOpenTool(row.tool) : null)}
          rowHeight={TABLE_ROW_HEIGHT}
        />
      </InstrumentSection>
      <InstrumentSection
        eyebrow={t("uiRenders.title")}
        hint={t("uiRenders.hint")}
      >
        <DataTable
          columns={columns.uiRenders}
          data={data.uiRenders}
          defaultSort={{ key: "renders", direction: "desc" }}
          emptyState={<McpTableEmpty description={t("uiRenders.empty")} />}
          getRowId={(row) => row.resource}
          height={height ?? mcpTableHeight(data.uiRenders.length)}
          minHeight={height}
          rowHeight={TABLE_ROW_HEIGHT}
        />
      </InstrumentSection>
    </div>
  );
}

export function McpAudienceSections({
  data,
  onOpenTool,
  onOpenSession,
}: McpAudienceSectionsProps) {
  const t = useTranslations("geo.pages.mcp");
  const columns = useMcpColumns();
  const pairHeight = usePairHeight();
  const clientsHeight = pairHeight(data.clients.length, data.models.length);
  const intentsHeight = pairHeight(data.intents.length, data.users.length);
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <InstrumentSection
          eyebrow={t("clients.title")}
          hint={t("clients.hint")}
        >
          <DataTable
            columns={columns.clients}
            data={data.clients}
            defaultSort={{ key: "sessions", direction: "desc" }}
            getRowId={(row) => row.name}
            height={clientsHeight ?? mcpTableHeight(data.clients.length)}
            minHeight={clientsHeight}
            rowHeight={TABLE_ROW_HEIGHT}
          />
        </InstrumentSection>
        <InstrumentSection eyebrow={t("models.title")} hint={t("models.hint")}>
          <DataTable
            columns={columns.models}
            data={data.models}
            defaultSort={{ key: "sessions", direction: "desc" }}
            emptyState={<McpTableEmpty description={t("models.empty")} />}
            getRowId={(row) => row.name}
            height={clientsHeight ?? mcpTableHeight(data.models.length)}
            minHeight={clientsHeight}
            rowHeight={TABLE_ROW_HEIGHT}
          />
        </InstrumentSection>
      </div>

      <InstrumentSection
        eyebrow={t("sessions.title")}
        hint={t("sessions.hint")}
      >
        <DataTable
          columns={columns.sessions}
          data={data.sessions}
          getRowId={(row) => row.id}
          height={mcpTableHeight(data.sessions.length)}
          onRowClick={onOpenSession}
          rowHeight={TABLE_ROW_HEIGHT}
        />
      </InstrumentSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <InstrumentSection
          eyebrow={t("intents.title")}
          hint={t("intents.hint")}
        >
          <DataTable
            columns={columns.intents}
            data={data.intents}
            defaultSort={{ key: "calls", direction: "desc" }}
            emptyState={<McpTableEmpty description={t("intents.empty")} />}
            getRowId={(row) => `${row.intent}-${row.tool}`}
            height={intentsHeight ?? mcpTableHeight(data.intents.length)}
            minHeight={intentsHeight}
            onRowClick={(row) => (row.tool ? onOpenTool(row.tool) : null)}
            rowHeight={TABLE_ROW_HEIGHT}
          />
        </InstrumentSection>
        <InstrumentSection eyebrow={t("users.title")}>
          <DataTable
            columns={columns.users}
            data={data.users}
            defaultSort={{ key: "calls", direction: "desc" }}
            emptyState={<McpTableEmpty description={t("users.empty")} />}
            getRowId={(row) => row.id}
            height={intentsHeight ?? mcpTableHeight(data.users.length)}
            minHeight={intentsHeight}
            rowHeight={TABLE_ROW_HEIGHT}
          />
        </InstrumentSection>
      </div>
    </>
  );
}

export function McpRequestLog({ data, onOpenRequest }: McpRequestLogProps) {
  const t = useTranslations("geo.pages.mcp.requests");
  const columns = useMcpColumns();
  const [filter, setFilter] = useState<McpLogFilter>("all");
  const requests =
    filter === "errors"
      ? data.errorRequests
      : data.requests.filter(
          (entry) => filter === "all" || entry.status === "ok"
        );
  return (
    <InstrumentSection
      action={
        <Tabs
          onValueChange={(value) => {
            const next = MCP_LOG_FILTERS.find((item) => item === value);
            if (next) {
              setFilter(next);
            }
          }}
          value={filter}
        >
          <TabsList aria-label={t("filterLabel")}>
            <TabsTrigger value="all">{t("all")}</TabsTrigger>
            <TabsTrigger value="success">{t("success")}</TabsTrigger>
            <TabsTrigger value="errors">{t("errors")}</TabsTrigger>
          </TabsList>
        </Tabs>
      }
      eyebrow={t("title")}
      hint={t("hint")}
    >
      {/* One fixed height for every filter, so switching never moves the page. */}
      <DataTable
        columns={columns.requests}
        data={requests}
        getRowId={(row) => row.id}
        height={MCP_LOG_TABLE_HEIGHT}
        minHeight={MCP_LOG_TABLE_HEIGHT}
        onRowClick={onOpenRequest}
        rowHeight={TABLE_ROW_HEIGHT}
      />
    </InstrumentSection>
  );
}
