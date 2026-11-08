"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useTranslations } from "use-intl";

import { AnalyticsSourceTabs } from "@/components/analytics/analytics-source-tabs";
import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { PageContainer } from "@/components/layout/container";
import type { TrafficPageSkeletonFrameProps } from "@/types/geo-traffic-pages";

/** Heading, pickers and source tabs shared by the analytics page skeletons. */
export function TrafficPageSkeletonFrame({
  description,
  geoRange,
  children,
}: TrafficPageSkeletonFrameProps) {
  const t = useTranslations("geo.pages.traffic");
  return (
    <PageContainer
      aria-busy="true"
      className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6"
    >
      <div className="w-full min-w-0 space-y-6 px-4 lg:px-6">
        <PageHeading description={description} title={t("title")}>
          <div className="flex min-h-8 items-center">
            {geoRange ? (
              <GeoRangePicker control={geoRange} />
            ) : (
              <Skeleton className="h-7 w-40 rounded-lg" />
            )}
          </div>
        </PageHeading>
        <AnalyticsSourceTabs
          actions={
            <>
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="size-8 rounded-lg" />
            </>
          }
        />
        {children}
      </div>
    </PageContainer>
  );
}
