"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useId } from "react";
import { useTranslations } from "use-intl";

import { AnalyticsNav } from "@/components/analytics/analytics-nav";
import { AnalyticsSourceTabs } from "@/components/analytics/analytics-source-tabs";
import { PageContainer } from "@/components/layout/container";
import { useParams } from "@/lib/navigation";

const RAIL_TILE_COUNT = 4;
const MODULE_COUNT = 4;

export function AnalyticsPageSkeleton() {
  const id = useId();
  const { slug = "" } = useParams<{ slug?: string }>();
  const t = useTranslations("analytics.shell");
  const tCommon = useTranslations("common");
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full min-w-0 space-y-6 px-4 lg:px-6">
        <PageHeading
          description={t("description")}
          title={tCommon("labels.analytics")}
        >
          <Skeleton className="h-8 w-36 rounded-lg" />
        </PageHeading>
        <AnalyticsSourceTabs
          actions={<Skeleton className="h-7 w-72 rounded-lg" />}
        />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: RAIL_TILE_COUNT }).map((_, index) => (
              <Skeleton
                className="h-30 w-full rounded-xl"
                key={`${id}-rail-${index}`}
              />
            ))}
          </div>
          <AnalyticsNav slug={slug} />
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: MODULE_COUNT }).map((_, index) => (
              <Skeleton
                className="h-96 w-full rounded-xl"
                key={`${id}-module-${index}`}
              />
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
