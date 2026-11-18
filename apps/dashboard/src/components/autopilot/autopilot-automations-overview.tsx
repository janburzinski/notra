"use client";

import {
  Add01Icon,
  FlowConnectionIcon,
  PlayIcon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { TooltipProvider } from "@notra/ui/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, type TableColumn } from "ui/table";

import { AutopilotAutomationMenuItems } from "@/components/autopilot/autopilot-automation-menu-items";
import { AutopilotRunHistory } from "@/components/autopilot/autopilot-run-history";
import { AutopilotStatStrip } from "@/components/autopilot/autopilot-stat-strip";
import { AutopilotTableEmpty } from "@/components/autopilot/autopilot-table-empty";
import { AutopilotTrend } from "@/components/autopilot/autopilot-trend";
import { Button } from "@/components/button";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { AUTOPILOT_POLL_INTERVAL_MS } from "@/constants/autopilot";
import { AUTOPILOT_RUN_HISTORY_DAYS } from "@/constants/autopilot-run-history";
import {
  AUTOPILOT_AUTOMATIONS,
  AUTOPILOT_EMPTY_TABLE_HEIGHT,
  AUTOPILOT_KIND_META,
} from "@/constants/autopilot-ui";
import { AUTOPILOT_WORKFLOW_BUILD_PROMPT } from "@/constants/autopilot-workflows";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { useSavingAutopilotJobs } from "@/lib/hooks/use-autopilot";
import { useAutopilotWorkflowActions } from "@/lib/hooks/use-autopilot-workflows";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotAutomationKind,
  AutopilotAutomationNumberProps,
  AutopilotAutomationRow,
  AutopilotAutomationsOverviewProps,
} from "@/types/autopilot-metrics";
import type { AutopilotWorkflowSummary } from "@/types/autopilot-workflows";
import { tableHeightFor } from "@/utils/table";

const formatNumber = (value: number | null | undefined) =>
  value == null ? "—" : String(value);

/** A built-in automation's number; workflows have none, so they get a dash. */
function AutomationNumber({ value }: AutopilotAutomationNumberProps) {
  return value === undefined ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className="tabular-nums">{formatNumber(value)}</span>
  );
}

/**
 * The automations that are on, with what they produced in the period, and
 * the workflows the agent built for Autopilot alongside them.
 */
export function AutopilotAutomationsOverview({
  organizationId,
  days,
  jobs,
  isRunning,
  canManage,
  onOpenAutomation,
  onOpenWorkflow,
  onAddAutomation,
  onRunAutomation,
  onTurnOffAutomation,
  runningKind,
  runDisabled,
}: AutopilotAutomationsOverviewProps) {
  const { draftAgentPrompt } = useRightPanel();
  const query = useQuery({
    ...dashboardOrpc.autopilot.metrics.queryOptions({
      input: { organizationId, days },
    }),
    refetchInterval: isRunning ? AUTOPILOT_POLL_INTERVAL_MS : false,
  });
  const workflowsQuery = useQuery(
    dashboardOrpc.autopilot.workflows.list.queryOptions({
      input: { organizationId },
    })
  );
  const {
    run: runWorkflow,
    setEnabled: setWorkflowEnabled,
    remove: removeWorkflow,
  } = useAutopilotWorkflowActions(organizationId);
  const [deleting, setDeleting] = useState<AutopilotWorkflowSummary | null>(
    null
  );
  // The server rejects a run for a switch it hasn't saved yet.
  const saving = useSavingAutopilotJobs(organizationId);
  const metrics = query.data;
  const enabled = AUTOPILOT_AUTOMATION_KINDS.filter((kind) => jobs[kind]);
  const arrived = useArrivedKinds(enabled);
  const available = AUTOPILOT_AUTOMATION_KINDS.filter((kind) => !jobs[kind]);
  const rows: AutopilotAutomationRow[] = [
    ...enabled.map((kind) => {
      const metric = metrics?.automations.find((row) => row.kind === kind);
      return {
        type: "builtin" as const,
        id: kind,
        kind,
        pullRequests: metric?.pullRequests ?? null,
        merged: metric?.merged ?? null,
        history: metrics?.history[kind] ?? null,
      };
    }),
    ...(workflowsQuery.data ?? []).map((workflow) => ({
      type: "workflow" as const,
      id: workflow.id,
      workflow,
    })),
  ];
  const isSaving = (kind: AutopilotAutomationKind) =>
    saving.some((change) => change.kind === kind);
  const isRunDisabled = (row: AutopilotAutomationRow) =>
    row.type === "builtin"
      ? runDisabled || isSaving(row.kind)
      : runWorkflow.isPending;
  const openRow = (row: AutopilotAutomationRow) =>
    row.type === "builtin"
      ? onOpenAutomation(row.kind)
      : onOpenWorkflow(row.id);
  const runRow = (row: AutopilotAutomationRow) => {
    if (row.type === "builtin") {
      onRunAutomation(row.kind);
    } else {
      runWorkflow.mutate(row.id);
    }
  };
  const previous = metrics?.previous;
  const stats = [
    {
      label: "PRs generated",
      value: metrics?.pullRequests,
      trend: metrics ? (
        <AutopilotTrend
          current={metrics.pullRequests}
          previous={previous?.pullRequests}
        />
      ) : null,
    },
    {
      label: "PRs merged",
      value: metrics?.merged,
      trend: metrics ? (
        <AutopilotTrend current={metrics.merged} previous={previous?.merged} />
      ) : null,
    },
    {
      label: "Avg credits per run",
      value: metrics?.averageCreditsPerRun,
      trend: metrics ? (
        <AutopilotTrend
          current={metrics.averageCreditsPerRun}
          higherIsBetter={false}
          previous={previous?.averageCreditsPerRun}
        />
      ) : null,
    },
    {
      label: "Total credits",
      value: metrics?.totalCredits,
      trend: metrics ? (
        <AutopilotTrend
          current={metrics.totalCredits}
          neutral
          previous={previous?.totalCredits}
        />
      ) : null,
    },
  ];

  const columns: TableColumn<AutopilotAutomationRow>[] = [
    {
      key: "automation",
      header: "Automation",
      width: "1fr",
      minWidth: "14rem",
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <HugeiconsIcon
            aria-hidden="true"
            className="text-muted-foreground shrink-0"
            icon={
              row.type === "builtin"
                ? AUTOPILOT_KIND_META[row.kind].icon
                : FlowConnectionIcon
            }
            size={16}
          />
          <span className="truncate font-medium">
            {row.type === "builtin"
              ? AUTOPILOT_AUTOMATIONS[row.kind].name
              : row.workflow.name}
          </span>
          {row.type === "workflow" &&
          row.workflow.schedule &&
          !row.workflow.enabled ? (
            <StatusBadge appearance={{ variant: "secondary" }} label="Paused" />
          ) : null}
        </span>
      ),
    },
    {
      key: "pullRequests",
      header: "PRs",
      width: "5rem",
      cell: (row) => (
        <AutomationNumber
          value={row.type === "builtin" ? row.pullRequests : undefined}
        />
      ),
    },
    {
      key: "merged",
      header: "Merged",
      width: "6rem",
      cell: (row) => (
        <AutomationNumber
          value={row.type === "builtin" ? row.merged : undefined}
        />
      ),
    },
    {
      key: "history",
      header: `Last ${AUTOPILOT_RUN_HISTORY_DAYS} days`,
      width: "13rem",
      collapsePriority: 1,
      cell: (row) =>
        row.type === "builtin" && row.history ? (
          <AutopilotRunHistory days={row.history} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: "6rem",
            align: "right",
            cell: (row) => {
              const name =
                row.type === "builtin"
                  ? AUTOPILOT_AUTOMATIONS[row.kind].name
                  : row.workflow.name;
              return (
                <Button
                  aria-label={`Run ${name}`}
                  disabled={isRunDisabled(row)}
                  loading={
                    row.type === "builtin"
                      ? runningKind === row.kind
                      : runWorkflow.isPending &&
                        runWorkflow.variables === row.id
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    runRow(row);
                  }}
                  size="xs"
                  variant="outline"
                >
                  <HugeiconsIcon icon={PlayIcon} size={14} />
                  Run
                </Button>
              );
            },
          } satisfies TableColumn<AutopilotAutomationRow>,
        ]
      : []),
  ];

  const addMenu = canManage ? (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm" variant={rows.length === 0 ? "outline" : "ghost"} />
        }
      >
        <HugeiconsIcon icon={Add01Icon} size={14} />
        Add automation
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {available.map((kind) => (
          <DropdownMenuItem
            className="items-start"
            key={kind}
            onClick={() => onAddAutomation(kind)}
          >
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">
                {AUTOPILOT_AUTOMATIONS[kind].name}
              </span>
              <span className="text-muted-foreground text-xs text-pretty">
                {AUTOPILOT_AUTOMATIONS[kind].description}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
        {available.length > 0 ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem
          className="items-start"
          onClick={() => draftAgentPrompt(AUTOPILOT_WORKFLOW_BUILD_PROMPT)}
        >
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Describe your own</span>
            <span className="text-muted-foreground text-xs text-pretty">
              Tell the agent what to keep an eye on and it builds the
              automation.
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div className="space-y-4">
      <AutopilotStatStrip busy={query.isPending} stats={stats} />
      {query.isError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm" role="alert">
          <p>Could not load the numbers.</p>
          <Button
            disabled={query.isFetching}
            onClick={() => query.refetch()}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        </div>
      ) : null}
      {/* The body grows by a row in step with the card leaving below. */}
      <div className="[&_.bg-table-card]:transition-[height,border-radius] [&_.bg-table-card]:duration-250 [&_.bg-table-card]:ease-(--ease-out) motion-reduce:[&_.bg-table-card]:transition-none">
        {/* One tooltip glides across every row's day bars instead of a
            separate one per bar, so it can't linger over the next row. */}
        <TooltipProvider glide>
          <DataTable
            columns={columns}
            data={rows}
            // Without built-in automations the workflows decide whether it's empty.
            loading={rows.length === 0 && workflowsQuery.isPending}
            emptyState={
              <AutopilotTableEmpty
                action={addMenu}
                description="Add one, or describe your own in the chat box below."
                icon={WorkflowSquare03Icon}
                title="No automations on"
              />
            }
            getRowClassName={(row) =>
              // Glows, and its cells settle in, like new rows in the GEO logs.
              row.type === "builtin" && arrived.includes(row.kind)
                ? "geo-log-row-arrive"
                : undefined
            }
            getRowId={(row) => row.id}
            height={
              rows.length > 0
                ? tableHeightFor(rows.length)
                : AUTOPILOT_EMPTY_TABLE_HEIGHT
            }
            onRowClick={openRow}
            renderRowContextMenu={(row) => (
              <AutopilotAutomationMenuItems
                canManage={canManage}
                onDeleteWorkflow={setDeleting}
                onOpen={openRow}
                onRun={runRow}
                onSetWorkflowEnabled={(workflowId, enabled) =>
                  setWorkflowEnabled.mutate({ workflowId, enabled })
                }
                onTurnOff={onTurnOffAutomation}
                row={row}
                runDisabled={isRunDisabled(row)}
                toggleBusy={
                  row.type === "builtin"
                    ? isSaving(row.kind)
                    : setWorkflowEnabled.isPending
                }
              />
            )}
            rowHeight={TABLE_ROW_HEIGHT}
          />
        </TooltipProvider>
      </div>
      <ConfirmDialog
        confirmLabel="Delete workflow"
        description="Autopilot stops running it. This can't be undone."
        // A failed delete already shows a toast; the dialog stays open to retry.
        onConfirm={() =>
          deleting
            ? removeWorkflow
                .mutateAsync(deleting.id)
                .then(() => setDeleting(null))
                .catch(() => undefined)
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
        open={deleting !== null}
        title={deleting ? `Delete ${deleting.name}?` : "Delete this workflow?"}
        variant="destructive"
      />
    </div>
  );
}

/** Kinds turned on since the table first rendered, so their rows can glow in. */
function useArrivedKinds(enabled: AutopilotAutomationKind[]) {
  const key = enabled.join();
  const [seen, setSeen] = useState(key);
  const [arrived, setArrived] = useState<AutopilotAutomationKind[]>([]);
  if (key !== seen) {
    const before = new Set(seen.split(","));
    setSeen(key);
    setArrived(enabled.filter((kind) => !before.has(kind)));
  }
  return arrived;
}
