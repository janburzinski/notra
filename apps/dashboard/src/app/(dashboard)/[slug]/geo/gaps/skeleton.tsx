"use client";

import { GEO_GAPS_TABLE_HEIGHT } from "@notra/geo-core/constants/geo";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { DataTableSkeleton } from "@notra/ui/components/ui/data-table";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { DATA_TABLE_ROW_HEIGHT } from "@notra/ui/constants/table";
import type { DataTableSkeletonColumn } from "@notra/ui/types/data-table";
import { useTranslations } from "use-intl";

import { PageContainer } from "@/components/layout/container";
import { useFillHeight } from "@/lib/hooks/use-fill-height";

/** Prompt, opportunity, visible on, competitors, write. */
const GAP_COLUMN_WIDTHS: readonly DataTableSkeletonColumn[] = [
  { width: "1fr", minWidth: "12rem" },
  "9rem",
  { width: "9.5rem", collapsePriority: 1 },
  { width: "9.5rem", collapsePriority: 2 },
  { width: "9.5rem", minWidth: "9.5rem", align: "right" },
];

export function GeoGapsSkeleton({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations("geo.pages.gaps");
  const tCommon = useTranslations("common");
  const [tableRef, tableHeight] = useFillHeight(GEO_GAPS_TABLE_HEIGHT);
  const table = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="bg-muted/40 flex items-center gap-0.5 rounded-lg border p-0.5">
          <Skeleton className="h-7 w-32 rounded-md" />
          <Skeleton className="h-7 w-[7.5rem] rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-[13.375rem] rounded-md" />
          <Skeleton className="h-7 w-44 rounded-md" />
        </div>
      </div>
      <div className="min-h-0 flex-1" ref={tableRef}>
        <DataTableSkeleton
          columnWidths={GAP_COLUMN_WIDTHS}
          height={tableHeight}
          rowHeight={DATA_TABLE_ROW_HEIGHT}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {t("loadingStatus")}
      </p>
    </div>
  );

  if (embedded) {
    return table;
  }

  return (
    <PageContainer
      className="flex h-full min-h-full flex-1 flex-col overflow-hidden py-4 md:py-6"
      data-geo-gaps-page=""
    >
      <div className="flex min-h-0 w-full flex-1 flex-col gap-6 px-4 lg:px-6">
        <PageHeading
          description={t("description")}
          title={tCommon("labels.contentGaps")}
        />
        {table}
      </div>
    </PageContainer>
  );
}
