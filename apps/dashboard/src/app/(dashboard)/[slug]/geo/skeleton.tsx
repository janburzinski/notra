"use client";

import { InstrumentModule } from "@notra/ui/components/instrument/instrument-module";
import { DataTableSkeleton } from "@notra/ui/components/ui/data-table";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { GeoSectionSkeleton } from "@/components/geo/skeleton-parts";
import { PageContainer } from "@/components/layout/container";

const ENGINE_ROW_COUNT = 4;
const PROVIDER_ROW_COUNT = 5;

export function GeoPageSkeleton() {
  const t = useTranslations("geo.pages.overview");
  const tGeoShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  const tTrend = useTranslations("geo.mentionTrendCard");
  const tWhatChanged = useTranslations("geo.whatChangedCard");
  return (
    <PageContainer
      aria-busy="true"
      data-page-skeleton
      className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6"
    >
      <div className="w-full space-y-6 px-4 lg:px-6">
        <header className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight">GEO</h1>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-[8.625rem] rounded-md" />
              <Button className="w-fit gap-2" disabled size="sm">
                {tGeoShared("runScan")}
                <Kbd className="hidden sm:inline-flex">R</Kbd>
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">{t("descriptionFallback")}</p>
        </header>
        <div className="bg-muted/40 flex w-fit shrink-0 items-center gap-0.5 rounded-lg border p-0.5">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton className="h-7 w-24 rounded-md" key={index} />
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 items-stretch gap-4 @min-[44rem]/main:grid-cols-12">
            <InstrumentModule
              className="h-full @min-[44rem]/main:col-span-5"
              eyebrow={tCommon("labels.visibility")}
              variant="table"
            >
              <div className="flex flex-col gap-3">
                <Skeleton className="h-[1.625rem] w-12" />
                <div>
                  <div className="flex h-9 items-center justify-between">
                    <Skeleton className="h-3.5 w-16" />
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                  {Array.from({ length: PROVIDER_ROW_COUNT }, (_, index) => (
                    <div
                      className="border-border/60 flex h-11 items-center gap-3 border-t"
                      key={index}
                    >
                      <Skeleton className="size-3.5" />
                      <Skeleton className="size-4 rounded-full" />
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="ml-auto h-3.5 w-6" />
                    </div>
                  ))}
                </div>
              </div>
            </InstrumentModule>
            <InstrumentModule
              action={<Skeleton className="h-7 w-[6.5rem] rounded-md" />}
              bodyClassName="flex min-h-0 flex-1 flex-col px-4 pt-1 pb-4"
              className="h-full @min-[44rem]/main:col-span-7"
              eyebrow={tTrend("eyebrow")}
              variant="table"
            >
              <Skeleton className="min-h-64 w-full flex-1 rounded-xl" />
            </InstrumentModule>
          </div>
          <GeoSectionSkeleton eyebrow={tGeoShared("whatChanged")}>
            <p className="text-muted-foreground mb-3 text-sm">
              {tWhatChanged("subline")}
            </p>
            <DataTableSkeleton rows={ENGINE_ROW_COUNT} />
          </GeoSectionSkeleton>
          <GeoSectionSkeleton
            action={<Skeleton className="h-7 w-40 rounded-md" />}
            eyebrow={tGeoShared("engines")}
          >
            <DataTableSkeleton rows={ENGINE_ROW_COUNT} />
          </GeoSectionSkeleton>
          <div className="grid grid-cols-1 gap-4 @min-[44rem]/main:grid-cols-2">
            <GeoSectionSkeleton
              action={<Skeleton className="h-3.5 w-8" />}
              eyebrow={tGeoShared("shareOfVoice")}
            >
              <Skeleton className="h-64 w-full rounded-xl" />
            </GeoSectionSkeleton>
            <GeoSectionSkeleton
              action={<Skeleton className="h-3.5 w-8" />}
              eyebrow={tGeoShared("performanceByLanguage")}
            >
              <Skeleton className="h-64 w-full rounded-xl" />
            </GeoSectionSkeleton>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
