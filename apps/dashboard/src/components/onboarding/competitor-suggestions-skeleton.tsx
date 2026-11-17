import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";

import { ONBOARDING_SUGGESTION_SKELETON_ROWS } from "@/constants/onboarding";
import { cn } from "@/lib/utils";

export function CompetitorSuggestionsSkeleton() {
  return (
    <div className={TABLE_FRAME_CLASS}>
      <ul className={cn(TABLE_BODY_CLASS, "overflow-hidden")}>
        {ONBOARDING_SUGGESTION_SKELETON_ROWS.map((row) => (
          <li
            className="border-table-row-border flex items-center gap-3 border-b px-3.5 py-3 last:border-b-0"
            key={row}
          >
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton className="size-8 rounded-md" />
            <span className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-56" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
