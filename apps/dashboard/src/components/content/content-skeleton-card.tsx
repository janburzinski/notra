"use client";

import type { ContentType } from "@notra/ai/schemas/content";
import { Badge } from "@notra/ui/components/ui/badge";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Loader2Icon } from "lucide-react";
import { getContentTypeLabel } from "@/components/content/content-card";
import { cn } from "@/lib/utils";
import { OutputTypeIcon } from "@/utils/output-types";

interface ContentSkeletonCardProps {
  outputType: string;
  className?: string;
}

export function ContentSkeletonCard({
  outputType,
  className,
}: ContentSkeletonCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl p-2",
        // Shadow as border — matches ContentCard style
        "shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_2px_-1px_rgba(0,0,0,0.06),0px_2px_4px_0px_rgba(0,0,0,0.04)]",
        "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
        "h-full bg-card",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 px-2 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
          <p className="truncate font-semibold text-base text-muted-foreground">
            Generating content...
          </p>
        </div>
      </div>
      {/* Concentric radius: outer rounded-2xl (16px), p-2 (8px), inner rounded-lg (8px) → 8+8=16 ✓ */}
      <div className="flex-1 space-y-2.5 rounded-lg bg-muted/50 px-4 py-3">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      <div className="flex items-center gap-2 px-2 pt-2 pb-1">
        <Badge className="capitalize" variant="outline">
          draft
        </Badge>
        <Badge
          className="flex items-center gap-1.5 capitalize"
          variant="secondary"
        >
          <OutputTypeIcon className="size-3" outputType={outputType} />
          {getContentTypeLabel(outputType as ContentType)}
        </Badge>
      </div>
    </div>
  );
}
