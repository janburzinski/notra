"use client";

import { DataTableSkeleton } from "@notra/ui/components/ui/data-table";
import { Skeleton } from "@notra/ui/components/ui/skeleton";

import { EVENT_TABLE_SKELETON_COLUMNS } from "@/constants/event-triggers";
import { TABLE_ROW_HEIGHT } from "@/constants/table";

export function EventsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-44" />
      <DataTableSkeleton
        columnWidths={EVENT_TABLE_SKELETON_COLUMNS}
        rowHeight={TABLE_ROW_HEIGHT}
      />
    </div>
  );
}
