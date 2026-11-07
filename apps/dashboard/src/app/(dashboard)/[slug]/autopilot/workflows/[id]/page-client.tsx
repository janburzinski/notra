"use client";

import {
  AiMagicIcon,
  Alert02Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@notra/ui/components/shared/responsive-alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Switch } from "@notra/ui/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";

import { AutopilotBackLink } from "@/components/autopilot/autopilot-back-link";
import { AutopilotPageShell } from "@/components/autopilot/autopilot-page-shell";
import { AutopilotStatStrip } from "@/components/autopilot/autopilot-stat-strip";
import { AutopilotWorkflowRunsTable } from "@/components/autopilot/autopilot-workflow-runs-table";
import { AutopilotWorkflowSteps } from "@/components/autopilot/autopilot-workflow-steps";
import { Button } from "@/components/button";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { EmptyState } from "@/components/empty-state";
import { RelativeTime } from "@/components/relative-time";
import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import { AUTOPILOT_WORKFLOW_POLL_MS } from "@/constants/autopilot-workflows";
import { useAutopilotWorkflowRunView } from "@/lib/hooks/use-autopilot-workflow-run-view";
import { useAutopilotWorkflowActions } from "@/lib/hooks/use-autopilot-workflows";
import { useFormatRelative } from "@/lib/hooks/use-format-relative";
import { useRouter } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import { cn } from "@/lib/utils";
import type {
  AutopilotWorkflowActionsProps,
  AutopilotWorkflowLoaderProps,
  AutopilotWorkflowPageClientProps,
  AutopilotWorkflowPageProps,
  AutopilotWorkflowRunCaptionProps,
  AutopilotWorkflowRunErrorProps,
} from "@/types/autopilot-workflows";
import {
  describeAutopilotWorkflowSchedule,
  isAutopilotWorkflowRunActive,
} from "@/utils/autopilot-workflows";
import { toErrorMessage } from "@/utils/error-message";
import { isNotFoundError } from "@/utils/orpc-errors";

function WorkflowIssues({
  issues,
}: Pick<AutopilotWorkflowPageProps["workflow"], "issues">) {
  if (issues.length === 0) {
    return null;
  }
  return (
    <div className={TABLE_FRAME_CLASS}>
      <div className={cn(TABLE_BODY_CLASS, "flex items-start gap-3 px-4 py-3")}>
        <HugeiconsIcon
          aria-hidden="true"
          className="text-warning mt-0.5 size-4 shrink-0"
          icon={Alert02Icon}
        />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">This workflow can't run yet</p>
          <ul className="text-muted-foreground space-y-0.5 text-sm text-pretty">
            {issues.map((issue) => (
              <li key={`${issue.nodeId}:${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Why the shown run ended early: stopped by someone, or failed. */
function RunError({ run }: AutopilotWorkflowRunErrorProps) {
  if (!run?.errorMessage) {
    return null;
  }
  return (
    <p
      className={cn(
        "rounded-xl border px-4 py-3 text-sm text-pretty",
        run.status === "stopped"
          ? "text-muted-foreground bg-muted/40"
          : "text-destructive bg-destructive/5"
      )}
    >
      {run.errorMessage}
    </p>
  );
}

/** Which run the steps show, or that the workflow changed since. */
function RunCaption({
  run,
  latest,
  changedSinceRun,
}: AutopilotWorkflowRunCaptionProps) {
  if (changedSinceRun) {
    return (
      <span className="text-muted-foreground text-xs">
        Changed since the last run
      </span>
    );
  }
  if (!run) {
    return null;
  }
  return (
    <span className="text-muted-foreground flex items-center gap-1 text-xs">
      {latest ? "Latest run," : "Run from"}
      <RelativeTime
        className="text-muted-foreground text-xs"
        iso={new Date(run.createdAt).toISOString()}
      />
    </span>
  );
}

/** Run now, and the rest in a menu: change it with the agent, or delete it. */
function WorkflowActions({
  canRun,
  running,
  onRun,
  onDelete,
}: AutopilotWorkflowActionsProps) {
  const { draftAgentPrompt } = useRightPanel();
  return (
    <>
      <Button
        disabled={!canRun}
        loading={running}
        onClick={onRun}
        size="sm"
        variant="outline"
      >
        <HugeiconsIcon icon={PlayIcon} size={16} />
        Run now
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button aria-label="More actions" size="icon-sm" variant="ghost" />
          }
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() => draftAgentPrompt("Change this workflow so it ")}
          >
            <HugeiconsIcon icon={AiMagicIcon} size={16} />
            Change with the agent
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} variant="destructive">
            <HugeiconsIcon icon={Delete02Icon} size={16} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function WorkflowPage({
  canManage,
  organizationId,
  organizationSlug,
  workflow,
}: AutopilotWorkflowPageProps) {
  const router = useRouter();
  const formatRelative = useFormatRelative();
  const { run, setEnabled, remove } =
    useAutopilotWorkflowActions(organizationId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const {
    latestRun,
    shownRun,
    running,
    changedSinceRun,
    shownView,
    setPickedRunId,
  } = useAutopilotWorkflowRunView(organizationId, workflow);

  const stats = [
    {
      label: "Schedule",
      value: describeAutopilotWorkflowSchedule(workflow.schedule),
    },
    {
      label: "Last run",
      value: workflow.lastRunAt
        ? formatRelative(new Date(workflow.lastRunAt).toISOString())
        : "Never",
    },
    { label: "Runs", value: workflow.runCount },
    { label: "Steps", value: workflow.stepCount },
  ];

  return (
    <>
      <div className="space-y-3">
        <AutopilotBackLink slug={organizationSlug} />
        <PageHeading
          description={workflow.description ?? undefined}
          title={workflow.name}
        >
          <div className="flex shrink-0 items-center gap-3">
            {workflow.schedule ? (
              <label className="flex items-center gap-2 text-sm font-medium">
                {workflow.enabled ? "On" : "Off"}
                <Switch
                  aria-label="Run on schedule"
                  checked={workflow.enabled}
                  disabled={!canManage || setEnabled.isPending}
                  onCheckedChange={(enabled) =>
                    setEnabled.mutate({ workflowId: workflow.id, enabled })
                  }
                />
              </label>
            ) : null}
            {canManage ? (
              <WorkflowActions
                canRun={workflow.issues.length === 0 && !running}
                onDelete={() => setConfirmDelete(true)}
                onRun={() =>
                  run.mutate(workflow.id, {
                    onSuccess: () => setPickedRunId(null),
                  })
                }
                running={run.isPending || running}
              />
            ) : null}
          </div>
        </PageHeading>
      </div>

      <WorkflowIssues issues={workflow.issues} />

      <AutopilotStatStrip stats={stats} />

      <section aria-labelledby="workflow-steps" className="space-y-3">
        <div className="flex min-h-7 items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-medium" id="workflow-steps">
            How it works
          </h2>
          <RunCaption
            changedSinceRun={changedSinceRun}
            latest={shownRun?.id === latestRun?.id}
            run={shownRun}
          />
        </div>
        {changedSinceRun ? null : <RunError run={shownRun} />}
        <AutopilotWorkflowSteps
          settingsView={workflow.view}
          showStatus={Boolean(shownView)}
          view={shownView ?? workflow.view}
        />
      </section>

      <section aria-labelledby="workflow-runs" className="space-y-3">
        <h2 className="px-1 text-sm font-medium" id="workflow-runs">
          Runs
        </h2>
        <AutopilotWorkflowRunsTable
          // Picking the latest run follows new runs, unless the workflow
          // changed since: then it shows what that run did.
          onSelect={(runId) =>
            setPickedRunId(
              runId === latestRun?.id && !changedSinceRun ? null : runId
            )
          }
          runs={workflow.runs}
          selectedRunId={shownRun?.id ?? null}
        />
      </section>

      <ResponsiveAlertDialog
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>
              Delete this workflow?
            </ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              Autopilot stops running it. This can't be undone.
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel disabled={remove.isPending}>
              Cancel
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                remove.mutate(workflow.id, {
                  onSuccess: () =>
                    router.push(`/${organizationSlug}${AUTOPILOT_NAV_LINK}`),
                });
              }}
              type="button"
              variant="destructive"
            >
              {remove.isPending ? "Deleting…" : "Delete workflow"}
            </ResponsiveAlertDialogAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  );
}

function WorkflowLoader({
  canManage,
  organizationId,
  organizationSlug,
  workflowId,
}: AutopilotWorkflowLoaderProps) {
  const query = useQuery({
    ...dashboardOrpc.autopilot.workflows.get.queryOptions({
      input: { organizationId, workflowId },
      refetchInterval: (current) =>
        current.state.data?.runs.some(isAutopilotWorkflowRunActive)
          ? AUTOPILOT_WORKFLOW_POLL_MS
          : false,
    }),
    // A missing workflow won't appear on a second try.
    retry: (failures, error) => !isNotFoundError(error) && failures < 1,
  });
  if (query.isPending) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading workflow"
        className="space-y-6"
        role="status"
      >
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }
  if (!query.data) {
    const missing = !query.isError || isNotFoundError(query.error);
    return (
      <>
        <AutopilotBackLink slug={organizationSlug} />
        {missing ? (
          <EmptyState
            description="There is no workflow at this address."
            title="Workflow not found"
          />
        ) : (
          <EmptyState
            actionLabel="Try again"
            description={toErrorMessage(
              query.error,
              "The workflow could not be loaded."
            )}
            onActionClick={() => query.refetch()}
            title="Something went wrong"
          />
        )}
      </>
    );
  }
  return (
    <WorkflowPage
      canManage={canManage}
      organizationId={organizationId}
      organizationSlug={organizationSlug}
      workflow={query.data}
    />
  );
}

export default function PageClient({
  organizationSlug,
  workflowId,
}: AutopilotWorkflowPageClientProps) {
  return (
    <AutopilotPageShell organizationSlug={organizationSlug}>
      {({ organizationId, overview }) => (
        <WorkflowLoader
          canManage={overview.canManage}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          workflowId={workflowId}
        />
      )}
    </AutopilotPageShell>
  );
}
