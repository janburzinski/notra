"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";

import type { ImportHomeStepProps } from "@/types/components/analytics-import";

import { ImportList } from "./import-list";
import { ImportProviderPicker } from "./import-provider-picker";

export function ImportHomeStep({
  isPending,
  onPick,
  ...list
}: ImportHomeStepProps) {
  return (
    // Imports, then where to import from; saved accounts last, they're upkeep.
    <div className="flex min-w-0 flex-col gap-6">
      {isPending ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : (
        <ImportList {...list} connections={[]} />
      )}
      <ImportProviderPicker onPick={onPick} />
      {isPending ? null : <ImportList {...list} imports={[]} />}
    </div>
  );
}
