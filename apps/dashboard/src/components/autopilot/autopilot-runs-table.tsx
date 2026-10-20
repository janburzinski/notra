"use client";

import { Clock01Icon } from "@hugeicons/core-free-icons";
import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  DataTable,
  type TableColumn,
} from "@notra/ui/components/ui/data-table";
import { useFormatter } from "use-intl";

import { AutopilotTableEmpty } from "@/components/autopilot/autopilot-table-empty";
import {
  AUTOPILOT_RUN_STATUS_BADGES,
  AUTOPILOT_RUN_TRIGGER_LABELS,
} from "@/constants/autopilot";
import { AUTOPILOT_EMPTY_TABLE_HEIGHT } from "@/constants/autopilot-ui";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import type {
  AutopilotRunsTableProps,
  AutopilotRunView,
} from "@/types/autopilot";
import { formatDuration } from "@/utils/autopilot-events";
import { tableHeightFor } from "@/utils/table";

/** Every Autopilot run; a row opens its step-by-step log. */
export function AutopilotRunsTable({
  runs,
  onSelect,
}: AutopilotRunsTableProps) {
  const format = useFormatter();
  const columns: TableColumn<AutopilotRunView>[] = [
    {
      key: "trigger",
      header: "Run",
      width: "1fr",
      cell: (run) => (
        <span className="truncate font-medium">
          {AUTOPILOT_RUN_TRIGGER_LABELS[run.trigger]}
        </span>
      ),
    },
    {
      key: "startedAt",
      header: "Started",
      width: "12rem",
      sortable: true,
      cell: (run) => (
        <span className="text-muted-foreground whitespace-nowrap tabular-nums">
          {format.dateTime(new Date(run.startedAt), {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
      sortValue: (run) => new Date(run.startedAt).getTime(),
    },
    {
      key: "duration",
      header: "Took",
      width: "7rem",
      collapsePriority: 2,
      cell: (run) => (
        <span className="text-muted-foreground tabular-nums">
          {run.finishedAt
            ? formatDuration(
                new Date(run.finishedAt).getTime() -
                  new Date(run.startedAt).getTime()
              )
            : "–"}
        </span>
      ),
    },
    {
      key: "proposed",
      header: "Pull requests",
      width: "8rem",
      collapsePriority: 1,
      cell: (run) => (
        <span className="tabular-nums">{run.summary?.proposed ?? "–"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "8rem",
      cell: (run) => (
        <StatusBadge
          appearance={AUTOPILOT_RUN_STATUS_BADGES[run.status].appearance}
          label={AUTOPILOT_RUN_STATUS_BADGES[run.status].label}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={runs}
      defaultSort={{ key: "startedAt", direction: "desc" }}
      emptyState={
        <AutopilotTableEmpty
          description="Autopilot runs every morning before your brief. Run now starts one right away."
          icon={Clock01Icon}
          title="No runs yet"
        />
      }
      getRowId={(run) => run.id}
      height={
        runs.length > 0
          ? tableHeightFor(runs.length)
          : AUTOPILOT_EMPTY_TABLE_HEIGHT
      }
      onRowClick={onSelect}
      rowHeight={TABLE_ROW_HEIGHT}
    />
  );
}
