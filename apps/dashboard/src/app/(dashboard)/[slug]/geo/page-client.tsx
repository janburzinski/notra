"use client";

import { useTranslations } from "use-intl";

import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { GeoSetupEmpty } from "@/components/geo/geo-setup-empty";
import { ScanModelMenu } from "@/components/geo/scan-model-menu";
import { PageContainer } from "@/components/layout/container";
import { useGeoOverviewPage } from "@/lib/hooks/use-geo-overview-page";
import type { GeoOverviewLoadedProps, GeoPageClientProps } from "@/types/geo";

import { GeoTabs } from "./components/geo-tabs";
import { GeoPageSkeleton } from "./skeleton";

export default function PageClient({ organizationSlug }: GeoPageClientProps) {
  const page = useGeoOverviewPage(organizationSlug);

  if (page.status === "loading") {
    return <GeoPageSkeleton />;
  }

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      {page.status === "empty" ? (
        <div className="w-full px-4 lg:px-6">
          <GeoSetupEmpty organizationId={page.organizationId} page="overview" />
        </div>
      ) : (
        <GeoOverviewLoaded page={page} />
      )}
    </PageContainer>
  );
}

function GeoOverviewLoaded({ page }: GeoOverviewLoadedProps) {
  const t = useTranslations("geo.pages.overview");
  return (
    <div className="w-full space-y-6 px-4 lg:px-6">
      <header className="space-y-1">
        <div className="flex flex-col items-start justify-between gap-3 @min-[24rem]/main:flex-row @min-[24rem]/main:items-center">
          <h1 className="text-3xl font-bold tracking-tight">GEO</h1>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <GeoRangePicker control={page.geoRange} />
            <ScanModelMenu {...page.scanMenu} />
          </div>
        </div>
        <p className="text-muted-foreground">
          {t("description", { companyName: page.companyName })}
        </p>
      </header>

      <GeoTabs {...page.tabs} />
    </div>
  );
}
