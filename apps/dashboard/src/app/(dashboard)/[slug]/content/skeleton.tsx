"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useId } from "react";

export function ContentPageSkeleton() {
  const id = useId();
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-48" />
      <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            className={[
              "flex flex-col rounded-2xl p-2 bg-card",
              "shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_2px_-1px_rgba(0,0,0,0.06),0px_2px_4px_0px_rgba(0,0,0,0.04)]",
              "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
            ].join(" ")}
            key={`${id}-card-${i}`}
          >
            <div className="flex items-center justify-between gap-3 px-2 py-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="space-y-2.5 rounded-lg bg-muted/50 px-4 py-3">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
