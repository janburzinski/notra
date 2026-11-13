"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import { cn } from "@notra/ui/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";

import { AiTrendsChange } from "@/components/ai-trends/ai-trends-change";
import { InsightsPageHeader } from "@/components/insights/insights-page-header";
import { SiteQueryError } from "@/components/sites/site-query-error";
import { SiteStatCardSkeleton } from "@/components/sites/site-stat-card";
import {
  OVERVIEW_CONTENT_TYPE_LABELS,
  OVERVIEW_DEFAULT_DAYS,
  OVERVIEW_RANGE_OPTIONS,
  OVERVIEW_REFETCH_MS,
  OVERVIEW_SIGNUP_SOURCE_LABELS,
} from "@/constants/overview";
import { consoleOrpc } from "@/lib/orpc/query";
import type {
  OverviewBreakdownTableProps,
  OverviewInsights,
  OverviewMetricCardProps,
  OverviewSectionProps,
} from "@/types/overview";
import { changeOrNull } from "@/utils/ai-trends";
import { formatPercent, formatResponseTime } from "@/utils/slack-bot";

const OverviewCharts = dynamic(
  () =>
    import("@/components/overview/overview-charts").then(
      (module) => module.OverviewCharts
    ),
  { loading: () => <Skeleton className="h-64 rounded-xl" /> }
);

const NUMBER_FORMAT = new Intl.NumberFormat("en");
const USD_FORMAT = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

function MetricCard({ label, count, hint, warning }: OverviewMetricCardProps) {
  return (
    <div className="bg-card ring-foreground/10 flex min-w-0 flex-col gap-1 rounded-xl p-4 ring-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-semibold tabular-nums">
          {formatNumber(count.current)}
        </p>
        <AiTrendsChange
          change={changeOrNull(count.current, count.previous)}
          className="text-xs"
          empty=""
        />
      </div>
      {hint ? (
        <p
          className={cn(
            "truncate text-xs",
            warning
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  labels,
  insights,
  render,
}: {
  title: string;
  labels: readonly string[];
  insights: OverviewInsights | undefined;
  render: (insights: OverviewInsights) => React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {insights
          ? render(insights)
          : labels.map((label) => (
              <SiteStatCardSkeleton key={label} label={label} />
            ))}
      </div>
    </section>
  );
}

function failedHint(failed: number, total: number): string {
  return failed > 0
    ? `${formatNumber(failed)} failed (${formatPercent(failed, total)})`
    : "None failed";
}

const GROWTH_LABELS = [
  "Signups",
  "New workspaces",
  "Active workspaces",
  "Slack requests",
] as const;

function GrowthCards({ insights }: OverviewSectionProps) {
  return (
    <Section
      insights={insights}
      labels={GROWTH_LABELS}
      render={({ growth, platform }) => (
        <>
          <MetricCard
            count={growth.signups}
            hint={`${formatNumber(growth.totalUsers)} users in total`}
            label={GROWTH_LABELS[0]}
          />
          <MetricCard
            count={growth.workspaces}
            hint={`${formatPercent(growth.onboarded, growth.workspaces.current)} finished onboarding`}
            label={GROWTH_LABELS[1]}
          />
          <MetricCard
            count={growth.activeWorkspaces}
            hint={`Of ${formatNumber(growth.totalWorkspaces)} workspaces`}
            label={GROWTH_LABELS[2]}
          />
          <MetricCard
            count={platform.slackRequests}
            hint="Messages the bot picked up, blocked ones excluded"
            label={GROWTH_LABELS[3]}
          />
        </>
      )}
      title="Growth"
    />
  );
}

const CONTENT_LABELS = [
  "Content written",
  "Content published",
  "Chats started",
  "Content automation runs",
] as const;

function ContentCards({ insights }: OverviewSectionProps) {
  return (
    <Section
      insights={insights}
      labels={CONTENT_LABELS}
      render={({ content }) => (
        <>
          <MetricCard
            count={content.written}
            hint="Posts created by people, chat or automations"
            label={CONTENT_LABELS[0]}
          />
          <MetricCard
            count={content.published}
            hint="Posts marked published"
            label={CONTENT_LABELS[1]}
          />
          <MetricCard
            count={content.chats}
            hint="New Studio chat sessions"
            label={CONTENT_LABELS[2]}
          />
          <MetricCard
            count={content.automationRuns}
            hint={failedHint(
              content.automationFailed,
              content.automationRuns.current
            )}
            label={CONTENT_LABELS[3]}
            warning={content.automationFailed > 0}
          />
        </>
      )}
      title="Content"
    />
  );
}

const GEO_LABELS = [
  "GEO scans",
  "Prompt checks",
  "Agent readiness reports",
  "Free scans claimed",
] as const;

function GeoCards({ insights }: OverviewSectionProps) {
  return (
    <Section
      insights={insights}
      labels={GEO_LABELS}
      render={({ geo }) => (
        <>
          <MetricCard
            count={geo.scans}
            hint={failedHint(geo.scansFailed, geo.scans.current)}
            label={GEO_LABELS[0]}
            warning={geo.scansFailed > 0}
          />
          <div className="bg-card ring-foreground/10 flex min-w-0 flex-col gap-1 rounded-xl p-4 ring-1">
            <p className="text-muted-foreground text-xs">{GEO_LABELS[1]}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatNumber(geo.checks)}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {USD_FORMAT.format(geo.costUsd)} LLM cost · median scan{" "}
              {formatResponseTime(geo.medianDurationMs)}
            </p>
          </div>
          <MetricCard
            count={geo.readinessReports}
            hint="Agent readiness checks run"
            label={GEO_LABELS[2]}
          />
          <MetricCard
            count={geo.freeScansClaimed}
            hint="Free ChatGPT scans for new companies"
            label={GEO_LABELS[3]}
          />
        </>
      )}
      title="GEO"
    />
  );
}

const PLATFORM_LABELS = [
  "Autopilot runs",
  "Workflow runs",
  "Site deployments",
  "Agent feedback",
] as const;

function PlatformCards({ insights }: OverviewSectionProps) {
  return (
    <Section
      insights={insights}
      labels={PLATFORM_LABELS}
      render={({ platform }) => (
        <>
          <MetricCard
            count={platform.autopilotRuns}
            hint={failedHint(
              platform.autopilotFailed,
              platform.autopilotRuns.current
            )}
            label={PLATFORM_LABELS[0]}
            warning={platform.autopilotFailed > 0}
          />
          <MetricCard
            count={platform.workflowRuns}
            hint={failedHint(
              platform.workflowFailed,
              platform.workflowRuns.current
            )}
            label={PLATFORM_LABELS[1]}
            warning={platform.workflowFailed > 0}
          />
          <MetricCard
            count={platform.deployments}
            hint={`${formatNumber(platform.sitesCreated.current)} new sites · ${failedHint(platform.deploymentsFailed, platform.deployments.current).toLowerCase()}`}
            label={PLATFORM_LABELS[2]}
            warning={platform.deploymentsFailed > 0}
          />
          <MetricCard
            count={platform.feedback}
            hint="Sent through MCP, API or SDK"
            label={PLATFORM_LABELS[3]}
          />
        </>
      )}
      title="Platform"
    />
  );
}

function BreakdownTable<Row>({
  title,
  rows,
  rowKey,
  columns,
}: OverviewBreakdownTableProps<Row>) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed py-6 text-center text-sm">
          No data in this range.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    className={column.numeric ? "text-right" : undefined}
                    key={column.label}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell
                      className={
                        column.numeric
                          ? "text-right tabular-nums"
                          : "max-w-48 truncate"
                      }
                      key={column.label}
                    >
                      {column.numeric
                        ? formatNumber(Number(column.value(row)))
                        : column.value(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function BreakdownTables({ insights }: { insights: OverviewInsights }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <BreakdownTable
        columns={[
          { label: "Organization", value: (row) => row.name },
          { label: "Content", numeric: true, value: (row) => row.content },
          { label: "Scans", numeric: true, value: (row) => row.scans },
          { label: "Chats", numeric: true, value: (row) => row.chats },
          {
            label: "Autopilot",
            numeric: true,
            value: (row) => row.autopilotRuns,
          },
        ]}
        rowKey={(row) => row.organizationId}
        rows={insights.workspaces}
        title="Most active workspaces"
      />
      <div className="flex min-w-0 flex-col gap-6">
        <BreakdownTable
          columns={[
            {
              label: "Type",
              value: (row) =>
                OVERVIEW_CONTENT_TYPE_LABELS[row.contentType] ??
                row.contentType,
            },
            { label: "Written", numeric: true, value: (row) => row.written },
            {
              label: "Published",
              numeric: true,
              value: (row) => row.published,
            },
          ]}
          rowKey={(row) => row.contentType}
          rows={insights.contentTypes}
          title="Content by type"
        />
        <BreakdownTable
          columns={[
            {
              label: "Source",
              value: (row) =>
                OVERVIEW_SIGNUP_SOURCE_LABELS[row.source] ?? row.source,
            },
            {
              label: "Workspaces",
              numeric: true,
              value: (row) => row.workspaces,
            },
          ]}
          rowKey={(row) => row.source}
          rows={insights.signupSources}
          title="Where new workspaces heard about Notra"
        />
      </div>
    </div>
  );
}

export function OverviewClient() {
  const [days, setDays] = useState<number>(OVERVIEW_DEFAULT_DAYS);
  const insightsQuery = useQuery({
    ...consoleOrpc.overview.insights.queryOptions({ input: { days } }),
    placeholderData: keepPreviousData,
    refetchInterval: OVERVIEW_REFETCH_MS,
  });
  const insights = insightsQuery.data;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <InsightsPageHeader
        days={days}
        description="How Notra is used across every workspace, compared with the period before."
        onDaysChange={setDays}
        options={OVERVIEW_RANGE_OPTIONS}
        title="Overview"
      />

      {insightsQuery.isError && !insights ? (
        <SiteQueryError
          message="Could not load the overview."
          onRetry={() => insightsQuery.refetch()}
          retrying={insightsQuery.isFetching}
        />
      ) : (
        <>
          <GrowthCards insights={insights} />
          <OverviewCharts insights={insights} />
          <ContentCards insights={insights} />
          <GeoCards insights={insights} />
          <PlatformCards insights={insights} />
          {insights ? <BreakdownTables insights={insights} /> : null}
        </>
      )}
    </main>
  );
}
