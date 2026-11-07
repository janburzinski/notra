"use client";

import {
  Add01Icon,
  FlowConnectionIcon,
  PlayIcon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type TableColumn } from "ui/table";

import { AutopilotStatStrip } from "@/components/autopilot/autopilot-stat-strip";
import { AutopilotTableEmpty } from "@/components/autopilot/autopilot-table-empty";
import { Button } from "@/components/button";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { AUTOPILOT_POLL_INTERVAL_MS } from "@/constants/autopilot";
import {
  AUTOPILOT_AUTOMATIONS,
  AUTOPILOT_EMPTY_TABLE_HEIGHT,
  AUTOPILOT_KIND_META,
} from "@/constants/autopilot-ui";
import { AUTOPILOT_WORKFLOW_BUILD_PROMPT } from "@/constants/autopilot-workflows";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { useAutopilotWorkflowActions } from "@/lib/hooks/use-autopilot-workflows";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotAutomationNumberProps,
  AutopilotAutomationRow,
  AutopilotAutomationsOverviewProps,
} from "@/types/autopilot-metrics";
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
  addingKind,
  onOpenAutomation,
  onOpenWorkflow,
  onAddAutomation,
  onRunAutomation,
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
  const { run: runWorkflow } = useAutopilotWorkflowActions(organizationId);
  const metrics = query.data;
  const enabled = AUTOPILOT_AUTOMATION_KINDS.filter((kind) => jobs[kind]);
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
        creditsPerRun: metric?.creditsPerRun ?? null,
      };
    }),
    ...(workflowsQuery.data ?? []).map((workflow) => ({
      type: "workflow" as const,
      id: workflow.id,
      workflow,
    })),
  ];
  const stats = [
    { label: "PRs generated", value: metrics?.pullRequests },
    { label: "PRs merged", value: metrics?.merged },
    { label: "Avg credits per run", value: metrics?.averageCreditsPerRun },
    { label: "Total credits", value: metrics?.totalCredits },
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
      key: "creditsPerRun",
      header: "Credits/run",
      width: "7rem",
      collapsePriority: 1,
      cell: (row) => (
        <AutomationNumber
          value={row.type === "builtin" ? row.creditsPerRun : undefined}
        />
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
                  disabled={
                    row.type === "builtin" ? runDisabled : runWorkflow.isPending
                  }
                  loading={
                    row.type === "builtin"
                      ? runningKind === row.kind
                      : runWorkflow.isPending &&
                        runWorkflow.variables === row.id
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    if (row.type === "builtin") {
                      onRunAutomation(row.kind);
                    } else {
                      runWorkflow.mutate(row.id);
                    }
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
          <Button
            loading={addingKind !== null}
            size="sm"
            variant={rows.length === 0 ? "outline" : "ghost"}
          />
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
        getRowId={(row) => row.id}
        height={
          rows.length > 0
            ? tableHeightFor(rows.length)
            : AUTOPILOT_EMPTY_TABLE_HEIGHT
        }
        onRowClick={(row) =>
          row.type === "builtin"
            ? onOpenAutomation(row.kind)
            : onOpenWorkflow(row.id)
        }
        rowHeight={TABLE_ROW_HEIGHT}
      />
    </div>
  );
}
