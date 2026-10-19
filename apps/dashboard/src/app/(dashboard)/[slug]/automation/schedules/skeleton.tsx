"use client";

import { DataTableSkeleton } from "@notra/ui/components/ui/data-table";
import { Skeleton } from "@notra/ui/components/ui/skeleton";

import {
  SCHEDULE_TABLE_ROW_HEIGHT,
  SCHEDULE_TABLE_SKELETON_COLUMNS,
} from "@/constants/schedule";

export function SchedulePageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-44" />
      <DataTableSkeleton
        columnWidths={SCHEDULE_TABLE_SKELETON_COLUMNS}
        rowHeight={SCHEDULE_TABLE_ROW_HEIGHT}
        rows={5}
      />
    </div>
  );
}
