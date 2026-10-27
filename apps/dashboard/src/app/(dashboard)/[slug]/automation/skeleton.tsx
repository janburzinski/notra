"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { DataTableSkeleton } from "ui/table";

export function AutomationPageSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-72" />
      <DataTableSkeleton rows={4} />
    </div>
  );
}
