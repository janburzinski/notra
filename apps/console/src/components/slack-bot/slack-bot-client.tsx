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
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";

import { SiteQueryError } from "@/components/sites/site-query-error";
import {
  SiteStatCard,
  SiteStatCardSkeleton,
} from "@/components/sites/site-stat-card";
import {
  SLACK_BOT_DEFAULT_DAYS,
  SLACK_BOT_RANGE_OPTIONS,
  SLACK_BOT_REFETCH_MS,
} from "@/constants/slack-bot";
import { consoleOrpc } from "@/lib/orpc/query";
import type {
  SlackBotBreakdownProps,
  SlackBotChartsProps,
  SlackBotTableCardProps,
} from "@/types/slack-bot";
import { formatPercent, formatResponseTime } from "@/utils/slack-bot";

const SlackBotCharts = dynamic(
  () =>
    import("@/components/slack-bot/slack-bot-charts").then(
      (module) => module.SlackBotCharts
    ),
  { loading: () => <Skeleton className="h-64 rounded-xl" /> }
);

const CARD_LABELS = [
  "Requests",
  "Median response time",
  "Messages per thread",
  "Answered",
  "People",
  "Blocked mentions",
] as const;

function SummaryCards({ insights }: SlackBotChartsProps) {
  if (!insights) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {CARD_LABELS.map((label) => (
          <SiteStatCardSkeleton key={label} label={label} />
        ))}
      </div>
    );
  }

  const { summary, threads } = insights;
  const finished = summary.completed + summary.failed + summary.cancelled;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <SiteStatCard
        hint={`${summary.mentions} mentions · ${summary.directMessages} DMs · ${summary.threadReplies} thread replies`}
        label={CARD_LABELS[0]}
        value={summary.requests}
      />
      <SiteStatCard
        hint={`p90 ${formatResponseTime(summary.p90ResponseMs)} · average ${formatResponseTime(summary.averageResponseMs)}`}
        label={CARD_LABELS[1]}
        value={formatResponseTime(summary.medianResponseMs)}
      />
      <SiteStatCard
        hint={
          threads.threads === 0
            ? "No threads yet"
            : `${threads.threads} threads · ${formatPercent(threads.multiTurnThreads, threads.threads)} with follow-ups · longest ${threads.maxTurns}`
        }
        label={CARD_LABELS[2]}
        value={threads.averageTurns ?? "—"}
      />
      <SiteStatCard
        hint={`${summary.failed} failed · ${summary.cancelled} stopped · ${summary.unanswered} unanswered`}
        label={CARD_LABELS[3]}
        tone={summary.failed + summary.unanswered > 0 ? "warning" : "default"}
        value={formatPercent(summary.completed, finished + summary.unanswered)}
      />
      <SiteStatCard
        hint={`In ${summary.workspaces} ${summary.workspaces === 1 ? "workspace" : "workspaces"}`}
        label={CARD_LABELS[4]}
        value={summary.users}
      />
      <SiteStatCard
        hint="Mentions in channels Notra isn't enabled in"
        label={CARD_LABELS[5]}
        tone={summary.blocked > 0 ? "warning" : "default"}
        value={summary.blocked}
      />
    </div>
  );
}

function TableCard({ title, empty, children }: SlackBotTableCardProps) {
  return (
    <div className="bg-card ring-foreground/10 flex min-w-0 flex-col gap-3 rounded-xl p-4 ring-1">
      <p className="text-sm font-medium">{title}</p>
      {empty ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No data in this range.
        </p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}

function BreakdownTables({ insights }: SlackBotBreakdownProps) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <TableCard empty={insights.tools.length === 0} title="Most used tools">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead className="text-right">Calls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {insights.tools.map((tool) => (
              <TableRow key={tool.tool}>
                <TableCell className="font-mono text-xs">{tool.tool}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {tool.calls}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
      <TableCard
        empty={insights.workspaces.length === 0}
        title="Most active workspaces"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead className="text-right">People</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead className="text-right">Median response</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {insights.workspaces.map((workspace) => (
              <TableRow key={workspace.organizationId}>
                <TableCell className="max-w-48 truncate">
                  {workspace.name}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {workspace.requests}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {workspace.users}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {workspace.failed}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatResponseTime(workspace.medianResponseMs)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}

export function SlackBotClient() {
  const [days, setDays] = useState<number>(SLACK_BOT_DEFAULT_DAYS);
  const insightsQuery = useQuery({
    ...consoleOrpc.slackBot.insights.queryOptions({ input: { days } }),
    placeholderData: keepPreviousData,
    refetchInterval: SLACK_BOT_REFETCH_MS,
  });
  const insights = insightsQuery.data;
  const isEmpty =
    insights?.summary.requests === 0 && insights.summary.blocked === 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Slack Bot</h1>
          <p className="text-muted-foreground text-sm">
            How the Notra agent is used in Slack across every workspace.
          </p>
        </div>
        <Tabs onValueChange={(value: number) => setDays(value)} value={days}>
          <TabsList
            aria-label="Time range"
            className="group-data-[orientation=horizontal]/tabs:h-8"
          >
            {SLACK_BOT_RANGE_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {insightsQuery.isError && !insights ? (
        <SiteQueryError
          message="Could not load Slack bot insights."
          onRetry={() => insightsQuery.refetch()}
          retrying={insightsQuery.isFetching}
        />
      ) : (
        <>
          {isEmpty ? (
            <div className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
              No Slack activity in this range yet. Tracking started with this
              release, so older conversations aren't included.
            </div>
          ) : null}
          <SummaryCards insights={insights} />
          <SlackBotCharts insights={insights} />
          {insights ? <BreakdownTables insights={insights} /> : null}
        </>
      )}
    </main>
  );
}
