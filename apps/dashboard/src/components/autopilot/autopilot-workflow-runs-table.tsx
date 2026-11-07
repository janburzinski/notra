"use client";

import { PlayIcon } from "@hugeicons/core-free-icons";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { DataTable, type TableColumn } from "ui/table";
import { useFormatter } from "use-intl";

import { AutopilotTableEmpty } from "@/components/autopilot/autopilot-table-empty";
import { AUTOPILOT_EMPTY_TABLE_HEIGHT } from "@/constants/autopilot-ui";
import { AUTOPILOT_WORKFLOW_RUN_STATUS } from "@/constants/autopilot-workflows";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { useNow } from "@/lib/hooks/use-now";
import type {
  AutopilotWorkflowRunsTableProps,
  AutopilotWorkflowRunSummary,
} from "@/types/autopilot-workflows";
import { tableHeightFor } from "@/utils/table";

/** The workflow's recent runs; picking one shows its results above. */
export function AutopilotWorkflowRunsTable({
  runs,
  selectedRunId,
  onSelect,
}: AutopilotWorkflowRunsTableProps) {
  const format = useFormatter();
  const now = new Date(useNow(runs.length > 0));
  const columns: TableColumn<AutopilotWorkflowRunSummary>[] = [
    {
      key: "status",
      header: "Status",
      width: "1fr",
      minWidth: "6.5rem",
      cell: (run) => (
        <StatusBadge
          appearance={AUTOPILOT_WORKFLOW_RUN_STATUS[run.status].appearance}
          label={AUTOPILOT_WORKFLOW_RUN_STATUS[run.status].label}
        />
      ),
    },
    {
      key: "trigger",
      header: "Trigger",
      width: "8rem",
      collapsePriority: 1,
      cell: (run) => (
        <span className="text-muted-foreground">
          {run.trigger === "schedule" ? "Schedule" : "By hand"}
        </span>
      ),
    },
    {
      key: "startedAt",
      header: "Started",
      width: "9.5rem",
      align: "right",
      // Plain text, so a click on it picks the run like the rest of the row.
      cell: (run) => {
        const startedAt = new Date(run.createdAt);
        return (
          <time
            className="text-muted-foreground text-sm whitespace-nowrap tabular-nums"
            dateTime={startedAt.toISOString()}
            title={format.dateTime(startedAt, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          >
            {format.relativeTime(startedAt, now > startedAt ? now : startedAt)}
          </time>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={runs}
      emptyState={
        <AutopilotTableEmpty
          description="Run it now, or wait for its schedule."
          icon={PlayIcon}
          title="No runs yet"
        />
      }
      getRowClassName={(run) =>
        run.id === selectedRunId ? "bg-muted/60" : undefined
      }
      getRowId={(run) => run.id}
      height={
        runs.length > 0
          ? tableHeightFor(runs.length)
          : AUTOPILOT_EMPTY_TABLE_HEIGHT
      }
      onRowClick={(run) => onSelect(run.id)}
      rowHeight={TABLE_ROW_HEIGHT}
    />
  );
}
