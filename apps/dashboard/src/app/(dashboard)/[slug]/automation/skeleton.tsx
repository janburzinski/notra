"use client";

import { DataTableSkeleton } from "@notra/ui/components/ui/data-table";
import { Skeleton } from "@notra/ui/components/ui/skeleton";

export function AutomationPageSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-72" />
      <DataTableSkeleton rows={4} />
    </div>
  );
}
