"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { cn } from "@notra/ui/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";

import { AiTrendsChange } from "@/components/ai-trends/ai-trends-change";
import {
  AutopilotFailuresTable,
  AutopilotHealthSection,
  AutopilotTemplatesTable,
  AutopilotWorkflowsTable,
  AutopilotWorkspacesTable,
} from "@/components/autopilot/autopilot-health-tables";
import { SiteQueryError } from "@/components/sites/site-query-error";
import { SiteStatCardSkeleton } from "@/components/sites/site-stat-card";
import { AUTOPILOT_HEALTH_REFETCH_MS } from "@/constants/autopilot";
import { consoleOrpc } from "@/lib/orpc/query";
import type {
  AutopilotHealthClientProps,
  AutopilotHealthMetricProps,
  AutopilotHealthViewProps,
} from "@/types/autopilot";
import { changeOrNull } from "@/utils/ai-trends";
import {
  autopilotAttention,
  formatAutopilotDurationMs,
  formatAutopilotRate,
} from "@/utils/autopilot";

const AutopilotHealthChart = dynamic(
  () =>
    import("@/components/autopilot/autopilot-health-chart").then(
      (module) => module.AutopilotHealthChart
    ),
  { loading: () => <Skeleton className="h-48 rounded-xl" /> }
);

const NUMBER_FORMAT = new Intl.NumberFormat("en");

const METRIC_LABELS = [
  "Runs",
  "Drafts opened",
  "Merged",
  "Workspaces on",
] as const;

function Metric({
  label,
  value,
  change,
  hint,
  warning = false,
}: AutopilotHealthMetricProps) {
  return (
    <div className="bg-card ring-foreground/10 flex min-w-0 flex-col gap-1 rounded-xl p-4 ring-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-semibold tabular-nums">
          {NUMBER_FORMAT.format(value)}
        </p>
        {change === undefined ? null : (
          <AiTrendsChange change={change} className="text-xs" empty="" />
        )}
      </div>
      <p
        className={cn(
          "truncate text-xs",
          warning ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {hint}
      </p>
    </div>
  );
}

function Metrics({ health }: Pick<AutopilotHealthViewProps, "health">) {
  const { totals } = health;
  const decided = totals.merged.current + totals.closed;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Metric
        change={changeOrNull(totals.runs.current, totals.runs.previous)}
        hint={`${NUMBER_FORMAT.format(totals.failed.current)} failed (${formatAutopilotRate(
          totals.runs.current > 0
            ? totals.failed.current / totals.runs.current
            : null
        )}) · ${NUMBER_FORMAT.format(totals.running)} running`}
        label={METRIC_LABELS[0]}
        value={totals.runs.current}
        warning={totals.failed.current > 0}
      />
      <Metric
        change={changeOrNull(totals.drafts.current, totals.drafts.previous)}
        hint={`${NUMBER_FORMAT.format(totals.inReview)} waiting for review`}
        label={METRIC_LABELS[1]}
        value={totals.drafts.current}
      />
      <Metric
        change={changeOrNull(totals.merged.current, totals.merged.previous)}
        hint={`${formatAutopilotRate(decided > 0 ? totals.merged.current / decided : null)} of ${NUMBER_FORMAT.format(decided)} decided drafts`}
        label={METRIC_LABELS[2]}
        value={totals.merged.current}
      />
      <Metric
        hint={`${NUMBER_FORMAT.format(totals.activeWorkspaces)} ran in this range`}
        label={METRIC_LABELS[3]}
        value={totals.enabledWorkspaces}
      />
    </div>
  );
}

function Attention({ health, slug }: AutopilotHealthViewProps) {
  const items = autopilotAttention(health, slug);
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <span aria-hidden className="bg-success size-2 rounded-full" />
        Nothing needs attention right now.
      </p>
    );
  }
  return (
    <section
      aria-label="Needs attention"
      className="bg-card ring-foreground/10 divide-border flex flex-col divide-y rounded-xl ring-1"
    >
      {items.map((item) => {
        const body = (
          <>
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                item.tone === "destructive" ? "bg-destructive" : "bg-warning"
              )}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">{item.title}</span>
              <span className="text-muted-foreground text-xs">
                {item.detail}
              </span>
            </span>
          </>
        );
        return item.href ? (
          <Link
            className="hover:bg-muted/50 flex gap-3 px-4 py-3"
            href={item.href}
            key={item.id}
          >
            {body}
          </Link>
        ) : (
          <div className="flex gap-3 px-4 py-3" key={item.id}>
            {body}
          </div>
        );
      })}
    </section>
  );
}

function HealthLoading() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {METRIC_LABELS.map((label) => (
          <SiteStatCardSkeleton key={label} label={label} />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </>
  );
}

function AutopilotHealthView({ health, slug }: AutopilotHealthViewProps) {
  const range =
    health.days <= 1 ? "the last 24 hours" : `the last ${health.days} days`;
  const { totals, workflows } = health;
  return (
    <>
      <Attention health={health} slug={slug} />
      <Metrics health={health} />
      <div className="bg-card ring-foreground/10 flex min-w-0 flex-col gap-3 rounded-xl p-4 ring-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">Runs</p>
            <p className="text-muted-foreground text-xs">
              Started in {range}, by {health.days <= 1 ? "hour" : "UTC day"}
            </p>
          </div>
          <p className="text-muted-foreground text-xs tabular-nums">
            Full run median {formatAutopilotDurationMs(totals.medianDurationMs)}{" "}
            · p90 {formatAutopilotDurationMs(totals.p90DurationMs)} ·{" "}
            {NUMBER_FORMAT.format(totals.credits)} credits
          </p>
        </div>
        <AutopilotHealthChart
          buckets={health.buckets}
          hourly={health.days <= 1}
        />
      </div>
      <AutopilotHealthSection
        description={`What each template did in ${range}. Merge rate counts drafts people merged out of every draft merged or closed.`}
        title="Templates"
      >
        <AutopilotTemplatesTable health={health} />
      </AutopilotHealthSection>
      <AutopilotHealthSection
        description="Errors with the same wording once numbers are blanked out, most runs first."
        title="Errors"
      >
        <AutopilotFailuresTable health={health} slug={slug} />
      </AutopilotHealthSection>
      <AutopilotHealthSection
        description="Workspaces with Autopilot on or a run in this range, failing ones first."
        title="Workspaces"
      >
        <AutopilotWorkspacesTable health={health} slug={slug} />
      </AutopilotHealthSection>
      <AutopilotHealthSection
        description={`${NUMBER_FORMAT.format(workflows.total)} workflows, ${NUMBER_FORMAT.format(workflows.enabled)} on · ${NUMBER_FORMAT.format(workflows.runs)} runs, ${NUMBER_FORMAT.format(workflows.failed)} failed in this range`}
        title="Custom workflows"
      >
        <AutopilotWorkflowsTable health={health} />
      </AutopilotHealthSection>
    </>
  );
}

export function AutopilotHealthClient({
  days,
  slug,
}: AutopilotHealthClientProps) {
  const query = useQuery({
    ...consoleOrpc.autopilot.health.queryOptions({ input: { days } }),
    placeholderData: keepPreviousData,
    refetchInterval: AUTOPILOT_HEALTH_REFETCH_MS,
  });

  if (query.isError && !query.data) {
    return (
      <SiteQueryError
        message="Could not load Autopilot health."
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  return query.data ? (
    <AutopilotHealthView health={query.data} slug={slug} />
  ) : (
    <HealthLoading />
  );
}
