"use client";

import { AUTOPILOT_ACTION_MIN_CONFIDENCE } from "@notra/ai/constants/autopilot-planner";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { DataTable, type TableColumn } from "ui/table";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";
import { useFormatter } from "use-intl";

import { AutopilotBackLink } from "@/components/autopilot/autopilot-back-link";
import { AutopilotFact } from "@/components/autopilot/autopilot-fact";
import { AutopilotFindingConfirmDialog } from "@/components/autopilot/autopilot-finding-confirm-dialog";
import { AutopilotFindingSource } from "@/components/autopilot/autopilot-finding-source";
import { AutopilotFindingStatus } from "@/components/autopilot/autopilot-finding-status";
import { AutopilotFindingTranscript } from "@/components/autopilot/autopilot-finding-transcript";
import { AutopilotMergeMenu } from "@/components/autopilot/autopilot-merge-menu";
import { AutopilotPageShell } from "@/components/autopilot/autopilot-page-shell";
import { AutopilotPostWorkbench } from "@/components/autopilot/autopilot-post-workbench";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import Link from "@/components/framework/link";
import {
  AUTOPILOT_BRANCH_PREFIX,
  AUTOPILOT_FROM_PARAM,
  AUTOPILOT_NAV_LINK,
} from "@/constants/autopilot";
import {
  AUTOPILOT_KIND_META,
  AUTOPILOT_PLANNED_KINDS,
  AUTOPILOT_PUBLISH_AT_FORMAT,
} from "@/constants/autopilot-ui";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { useAutopilotActions } from "@/lib/hooks/use-autopilot";
import { dashboardOrpc } from "@/lib/orpc/query";
import { cn } from "@/lib/utils";
import type {
  AutopilotFindingByIdLoaderProps,
  AutopilotFindingCandidate,
  AutopilotFindingHeaderActionsProps,
  AutopilotFindingPageClientProps,
  AutopilotFindingPageProps,
  AutopilotPendingFindingAction,
} from "@/types/autopilot";
import type { AutopilotPostWorkbenchView } from "@/types/autopilot-revisions";
import {
  formatAutopilotPercent,
  runEventsRefetchInterval,
} from "@/utils/autopilot-events";
import { describeFindingReason } from "@/utils/autopilot-findings";
import { describeImpact } from "@/utils/autopilot-impact";
import { isNotFoundError } from "@/utils/orpc-errors";
import { tableHeightFor } from "@/utils/table";

export default function PageClient({
  organizationSlug,
  findingId,
}: AutopilotFindingPageClientProps) {
  return (
    <AutopilotPageShell organizationSlug={organizationSlug}>
      {({ organizationId, overview }) => {
        const finding = overview.findings.find((row) => row.id === findingId);
        return finding ? (
          <FindingPage
            finding={finding}
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            overview={overview}
          />
        ) : (
          <FindingByIdLoader
            findingId={findingId}
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            overview={overview}
          />
        );
      }}
    </AutopilotPageShell>
  );
}

function FindingByIdLoader({
  findingId,
  ...props
}: AutopilotFindingByIdLoaderProps) {
  const query = useQuery({
    ...dashboardOrpc.autopilot.finding.queryOptions({
      input: { organizationId: props.organizationId, findingId },
    }),
    retry: (failures, error) => !isNotFoundError(error) && failures < 1,
  });
  if (query.isPending) {
    return <Skeleton className="h-32 rounded-2xl" />;
  }
  if (!query.data) {
    return (
      <>
        <AutopilotBackLink slug={props.organizationSlug} tab="pull-requests" />
        <EmptyState
          description="There is nothing at this address."
          title="Not found"
        />
      </>
    );
  }
  return <FindingPage {...props} finding={query.data} />;
}

/**
 * One pull request or idea and why Autopilot made it: the signal it came
 * from, how sure Jev was against the bar, what else was on the table, and the
 * steps it took.
 */
/** Close, hold, merge or write, for an item still waiting on a decision. */
function FindingHeaderActions({
  organizationId,
  finding,
  publishAt,
  canWrite,
  onClose,
  headSha,
  busy = false,
}: AutopilotFindingHeaderActionsProps) {
  const pin = headSha ?? undefined;
  const { writeSuggestion, merge, hold } = useAutopilotActions(organizationId);
  const writing =
    writeSuggestion.isPending && writeSuggestion.variables === finding.id;
  if (
    writing ||
    (finding.status !== "proposed" && finding.status !== "suggested")
  ) {
    return null;
  }
  return (
    <div className="flex items-center gap-2">
      {finding.status === "proposed" && !publishAt ? null : (
        <Button onClick={onClose} size="sm" variant="outline">
          Close
        </Button>
      )}
      {publishAt ? (
        <>
          <Button
            loading={hold.isPending}
            onClick={() => hold.mutate(finding.id)}
            size="sm"
            variant="outline"
          >
            Hold
          </Button>
          <Button
            disabled={busy}
            loading={merge.isPending}
            onClick={() =>
              merge.mutate({ findingId: finding.id, headSha: pin })
            }
            size="sm"
          >
            Publish now
          </Button>
        </>
      ) : null}
      {finding.status === "proposed" && !publishAt ? (
        <AutopilotMergeMenu
          disabled={busy}
          loading={merge.isPending}
          onClosePullRequest={onClose}
          onMerge={(method) =>
            merge.mutate({ findingId: finding.id, method, headSha: pin })
          }
          size="sm"
        />
      ) : null}
      {finding.status === "suggested" ? (
        <Button
          disabled={!canWrite}
          loading={writeSuggestion.isPending}
          onClick={() => writeSuggestion.mutate(finding.id)}
          size="sm"
        >
          Write now
        </Button>
      ) : null}
    </div>
  );
}

function FindingPage({
  organizationId,
  organizationSlug,
  overview,
  finding,
}: AutopilotFindingPageProps) {
  const format = useFormatter();
  const [from] = useQueryState(AUTOPILOT_FROM_PARAM);
  const [pending, setPending] = useState<AutopilotPendingFindingAction | null>(
    null
  );
  const impact = useQuery(
    dashboardOrpc.autopilot.impact.queryOptions({
      input: { organizationId, findingId: finding.id },
    })
  ).data;
  const events = useQuery({
    ...dashboardOrpc.autopilot.runEvents.queryOptions({
      input: { organizationId, runId: finding.runId ?? "" },
    }),
    enabled: Boolean(finding.runId),
    refetchInterval: runEventsRefetchInterval(
      overview.runs.find((run) => run.id === finding.runId)
    ),
  });
  const kindEvents = (events.data ?? []).filter(
    (event) => event.job === finding.kind
  );
  const { evidence } = finding;
  const formatDate = (date: Date) =>
    format.dateTime(date, { month: "short", day: "numeric" });
  const considered: AutopilotFindingCandidate[] = (
    evidence.decision?.considered ?? []
  ).map((row, index) => ({ ...row, picked: index === 0 }));
  const idea = finding.status === "suggested";
  const publishAt =
    finding.status === "proposed" && finding.publishAt
      ? new Date(finding.publishAt)
      : null;
  // Status, then Confidence for planned kinds and Before → now with an impact.
  const factCount =
    1 +
    Number(AUTOPILOT_PLANNED_KINDS.includes(finding.kind)) +
    Number(Boolean(impact)) +
    Number(Boolean(evidence.previewUrl));
  const columns: TableColumn<AutopilotFindingCandidate>[] = [
    {
      key: "title",
      header: "Candidate",
      width: "1fr",
      minWidth: "14rem",
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{row.title}</span>
          {row.picked ? (
            <StatusBadge appearance={{ variant: "info" }} label="Picked" />
          ) : null}
        </span>
      ),
    },
    {
      key: "share",
      header: "Odds",
      width: "6rem",
      align: "right",
      cell: (row) => (
        <span className="text-muted-foreground tabular-nums">
          {Math.round(row.share * 100)}%
        </span>
      ),
    },
  ];

  const why = (
    <>
      <p className="text-foreground">
        {describeFindingReason(finding, formatDate)}
      </p>
      {evidence.pullRequests?.length ? null : (
        <p>{evidence.detail ?? finding.summary}</p>
      )}
      {evidence.updatePage ? (
        <p>
          Rewrites the existing page{" "}
          <a
            className="text-foreground underline-offset-4 hover:underline"
            href={evidence.updatePage.url}
            rel="noreferrer"
            target="_blank"
          >
            {evidence.updatePage.title}
          </a>{" "}
          instead of adding a new post.
        </p>
      ) : null}
      {finding.errorMessage ? (
        <p className="text-destructive">{finding.errorMessage}</p>
      ) : null}
    </>
  );

  const headerActions = (view?: AutopilotPostWorkbenchView) =>
    overview.canManage ? (
      <FindingHeaderActions
        busy={view?.working}
        canWrite={overview.settings.enabled}
        finding={finding}
        headSha={view?.headSha}
        onClose={() => setPending({ kind: "dismiss", finding })}
        organizationId={organizationId}
        publishAt={publishAt}
      />
    ) : null;
  const details = (
    <>
      <div className={TABLE_FRAME_CLASS}>
        <dl
          className={cn(
            TABLE_BODY_CLASS,
            "grid gap-x-8 gap-y-5 p-5",
            factCount >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
          )}
        >
          <AutopilotFact label="Status">
            <AutopilotFindingStatus finding={finding} />
            {publishAt ? (
              <span className="text-muted-foreground">
                {" "}
                Publishes{" "}
                {format.dateTime(publishAt, {
                  ...AUTOPILOT_PUBLISH_AT_FORMAT,
                  timeZone: overview.settings.timezone,
                })}
              </span>
            ) : null}
          </AutopilotFact>
          {evidence.previewUrl ? (
            <AutopilotFact label="Preview">
              <a
                className="underline-offset-4 hover:underline"
                href={evidence.previewUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open
              </a>
            </AutopilotFact>
          ) : null}
          {AUTOPILOT_PLANNED_KINDS.includes(finding.kind) ? (
            <AutopilotFact label="Confidence">
              {typeof evidence.confidence === "number"
                ? `${Math.round(evidence.confidence * 100)}%`
                : "Asked for"}
              {idea ? (
                <span className="text-muted-foreground">
                  {" "}
                  · pull requests need{" "}
                  {formatAutopilotPercent(
                    evidence.decision?.threshold ??
                      AUTOPILOT_ACTION_MIN_CONFIDENCE
                  )}
                </span>
              ) : null}
            </AutopilotFact>
          ) : null}
          {impact ? (
            <AutopilotFact label="Before → now">
              {describeImpact(impact, finding.status === "merged").text}
            </AutopilotFact>
          ) : null}
        </dl>
      </div>

      <AutopilotFindingSource finding={finding} />

      {finding.runId ? (
        <section aria-labelledby="finding-run" className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium" id="finding-run">
              Run
            </h2>
            <Link
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
              href={`/${organizationSlug}${AUTOPILOT_NAV_LINK}/runs/${finding.runId}${from ? `?${AUTOPILOT_FROM_PARAM}=${encodeURIComponent(from)}` : ""}`}
            >
              View run
            </Link>
          </div>
          {events.isPending ? <Skeleton className="h-32 rounded-2xl" /> : null}
          {!events.isPending && kindEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {finding.status === "open"
                ? "Starting…"
                : "Steps are no longer available."}
            </p>
          ) : null}
          {events.isPending || kindEvents.length === 0 ? null : (
            <AutopilotFindingTranscript events={kindEvents} finding={finding}>
              {why}
            </AutopilotFindingTranscript>
          )}
        </section>
      ) : null}

      {finding.runId && kindEvents.length > 0 ? null : (
        <section aria-labelledby="finding-why" className="space-y-3">
          <h2 className="text-sm font-medium" id="finding-why">
            Why
          </h2>
          <div className="text-muted-foreground max-w-3xl space-y-2 text-sm text-pretty">
            {why}
          </div>
        </section>
      )}

      {considered.length > 1 ? (
        <section aria-labelledby="finding-considered" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium" id="finding-considered">
              Candidates
            </h2>
            {evidence.decision?.filteredOut ? (
              <span className="text-muted-foreground text-xs">
                {evidence.decision.filteredOut} filtered out
              </span>
            ) : null}
          </div>
          <DataTable
            columns={columns}
            data={considered}
            getRowId={(row) => row.title}
            height={tableHeightFor(considered.length)}
            rowHeight={TABLE_ROW_HEIGHT}
          />
        </section>
      ) : null}
    </>
  );
  const confirm = (
    <AutopilotFindingConfirmDialog
      branch={overview.settings.repository?.branch ?? null}
      onClose={() => setPending(null)}
      organizationId={organizationId}
      pending={pending}
    />
  );

  // A pull request leads with the post it writes, to read and change in place.
  if (finding.pullRequestNumber !== null) {
    return (
      <div className="space-y-6">
        <AutopilotBackLink slug={organizationSlug} tab="pull-requests" />
        <AutopilotPostWorkbench
          actions={headerActions}
          canRequest={
            overview.canManage &&
            finding.status === "proposed" &&
            Boolean(finding.branch?.startsWith(`${AUTOPILOT_BRANCH_PREFIX}/`))
          }
          finding={finding}
          organizationId={organizationId}
        >
          <section
            aria-labelledby="finding-details"
            className="border-table-row-border mx-auto max-w-2xl space-y-6 border-t pt-8"
          >
            <h2 className="text-sm font-medium" id="finding-details">
              Why Autopilot wrote this
            </h2>
            {details}
          </section>
        </AutopilotPostWorkbench>
        {confirm}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <AutopilotBackLink slug={organizationSlug} tab="pull-requests" />
        <PageHeading
          description={`${AUTOPILOT_KIND_META[finding.kind].label} · ${formatDate(new Date(finding.createdAt))}`}
          title={evidence.brief?.topic ?? finding.title}
        >
          {headerActions()}
        </PageHeading>
      </div>
      {details}
      {confirm}
    </div>
  );
}
