"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { TABLE_FRAME_CLASS } from "@notra/ui/constants/table";
import { useQuery } from "@tanstack/react-query";
import { useFormatter } from "use-intl";

import { AutopilotBackLink } from "@/components/autopilot/autopilot-back-link";
import { AutopilotFact } from "@/components/autopilot/autopilot-fact";
import { AutopilotPageShell } from "@/components/autopilot/autopilot-page-shell";
import { AutopilotRunTimeline } from "@/components/autopilot/autopilot-run-timeline";
import { EmptyState } from "@/components/empty-state";
import { SiteBuildLogs } from "@/components/sites/site-build-logs";
import {
  AUTOPILOT_CREDITS_CHARGED_EVENT,
  AUTOPILOT_POLL_INTERVAL_MS,
  AUTOPILOT_RUN_LOG_TAGS,
  AUTOPILOT_RUN_STATUS_BADGES,
  AUTOPILOT_RUN_TRIGGER_LABELS,
} from "@/constants/autopilot";
import { SITE_DEPLOYMENT_LOG_SURFACE_CLASS } from "@/constants/sites";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotRunPageClientProps,
  AutopilotRunPageProps,
} from "@/types/autopilot";
import {
  formatDuration,
  formatRunLog,
  sumEventTokens,
} from "@/utils/autopilot-events";

export default function PageClient({
  organizationSlug,
  runId,
}: AutopilotRunPageClientProps) {
  return (
    <AutopilotPageShell organizationSlug={organizationSlug}>
      {({ organizationId, overview }) => {
        const run = overview.runs.find((row) => row.id === runId);
        return run ? (
          <RunPage
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            run={run}
          />
        ) : (
          <>
            <AutopilotBackLink slug={organizationSlug} tab="runs" />
            <EmptyState
              description="This run is older than the runs Autopilot keeps on the page."
              title="Run not found"
            />
          </>
        );
      }}
    </AutopilotPageShell>
  );
}

function RunPage({
  organizationId,
  organizationSlug,
  run,
}: AutopilotRunPageProps) {
  const format = useFormatter();
  const running = run.status === "running";
  const query = useQuery(
    dashboardOrpc.autopilot.runEvents.queryOptions({
      input: { organizationId, runId: run.id },
      refetchInterval: running ? AUTOPILOT_POLL_INTERVAL_MS : false,
    })
  );
  const events = query.data ?? [];
  const tokens = sumEventTokens(events);
  const credits = events.reduce(
    (total, event) =>
      event.data?.event === AUTOPILOT_CREDITS_CHARGED_EVENT &&
      typeof event.data.credits === "number"
        ? total + event.data.credits
        : total,
    0
  );
  const startedAt = new Date(run.startedAt);
  const status = AUTOPILOT_RUN_STATUS_BADGES[run.status];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <AutopilotBackLink slug={organizationSlug} tab="runs" />
        <PageHeading
          description={format.dateTime(startedAt, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          title={AUTOPILOT_RUN_TRIGGER_LABELS[run.trigger]}
        />
      </div>

      <div className={TABLE_FRAME_CLASS}>
        <dl className="bg-background shadow-lift grid gap-x-8 gap-y-5 rounded-[14px] border p-5 sm:grid-cols-3 lg:grid-cols-6">
          <AutopilotFact label="Status">
            <StatusBadge appearance={status.appearance} label={status.label} />
          </AutopilotFact>
          <AutopilotFact label="Started">
            {format.dateTime(startedAt, { hour: "2-digit", minute: "2-digit" })}
          </AutopilotFact>
          <AutopilotFact label="Took">
            {run.finishedAt
              ? formatDuration(
                  new Date(run.finishedAt).getTime() - startedAt.getTime()
                )
              : "Running"}
          </AutopilotFact>
          <AutopilotFact label="Pull requests">
            {run.summary?.proposed ?? 0}
          </AutopilotFact>
          <AutopilotFact label="Model tokens">
            {format.number(tokens, { notation: "compact" })}
          </AutopilotFact>
          <AutopilotFact label="Credits">{credits}</AutopilotFact>
        </dl>
      </div>

      {run.errorMessage ? (
        <p className="text-destructive bg-destructive/5 rounded-xl border px-4 py-3 text-sm">
          {run.errorMessage}
        </p>
      ) : null}

      <section aria-label="Run log">
        <div className={TABLE_FRAME_CLASS}>
          <div className={SITE_DEPLOYMENT_LOG_SURFACE_CLASS}>
            {events.length > 0 ? (
              <div className="p-4">
                <AutopilotRunTimeline events={events} run={run} />
              </div>
            ) : null}
            <div className={events.length > 0 ? "border-t p-4" : "p-4"}>
              {query.isPending ? (
                <Skeleton className="h-48 rounded-lg" />
              ) : null}
              {!query.isPending && events.length === 0 && !running ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No steps were recorded for this run.
                </p>
              ) : null}
              {query.isPending || (events.length === 0 && !running) ? null : (
                <SiteBuildLogs
                  inProgress={running}
                  log={
                    events.length > 0
                      ? formatRunLog(events, AUTOPILOT_RUN_LOG_TAGS)
                      : null
                  }
                  queued={false}
                  title="Log"
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
