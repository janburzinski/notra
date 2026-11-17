"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { AnalyticsSourceTabs } from "@/components/analytics/analytics-source-tabs";
import { EmptyState } from "@/components/empty-state";
import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { TrafficActionsMenu } from "@/components/geo/traffic-actions-menu";
import { TrafficDomainSelect } from "@/components/geo/traffic-domain-select";
import { TrafficEmpty } from "@/components/geo/traffic-empty";
import { TrafficPathEmpty } from "@/components/geo/traffic-path-empty";
import { TrafficPathFilter } from "@/components/geo/traffic-path-filter";
import { TrafficWebsiteSetup } from "@/components/geo/traffic-website-setup";
import { TrafficUntrackedDomainBanner } from "@/components/geo/untracked-domain-banner";
import { PageContainer } from "@/components/layout/container";
import type {
  TrafficPageEmptyProps,
  TrafficPageShellProps,
} from "@/types/geo-traffic-pages";

function TrafficPageEmpty({
  scope,
  copy,
  hasPreviousData,
  installMethod,
  installDescription,
}: TrafficPageEmptyProps) {
  const tSites = useTranslations("geo.trafficSites");
  const sitesHidden = scope.sites === "exclude";
  if (scope.pathQuery) {
    return <TrafficPathEmpty geoRange={scope.geoRange} />;
  }
  if (!scope.hasProject) {
    return (
      <TrafficWebsiteSetup
        description={copy.websiteDescription}
        organizationId={scope.organizationId}
      />
    );
  }
  if (hasPreviousData || sitesHidden) {
    return (
      <EmptyState
        description={
          sitesHidden ? tSites("hiddenHint") : copy.emptyRangeDescription
        }
        title={copy.emptyRangeTitle}
      />
    );
  }
  return (
    <TrafficEmpty
      defaultMethod={installMethod}
      description={installDescription}
      domain={scope.domain}
      setup={scope.ingestSetup}
    />
  );
}

/**
 * Frame of the AI and web analytics tabs: heading with domain and range
 * pickers, the source tabs with the page's toolbar, and the empty states.
 * Without a project the empty state starts by asking for the website.
 */
export function TrafficPageShell({
  scope,
  copy,
  installMethod,
  installDescription,
  isEmpty,
  hasPreviousData,
  emptyFooter,
  children,
}: TrafficPageShellProps) {
  const t = useTranslations("geo.pages.traffic");
  const { geoRange, pathQuery, knownPaths } = scope;
  const [importOpen, setImportOpen] = useState(false);

  // Embeds, tracking setup and imports stay reachable on empty pages. They
  // all belong to a project, so they wait until the website step is done.
  const actionsMenu = scope.hasProject ? (
    <TrafficActionsMenu
      importOpen={importOpen}
      onImportOpenChange={setImportOpen}
      organizationId={scope.organizationId}
      path={pathQuery}
      range={geoRange.query}
      traffic={scope.traffic}
      web={scope.web}
    />
  ) : null;

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full min-w-0 space-y-6 px-4 lg:px-6">
        <PageHeading description={copy.description} title={t("title")}>
          <div className="flex min-h-8 max-w-full flex-wrap items-center gap-3">
            {scope.hasProject ? (
              <>
                <TrafficDomainSelect
                  hosts={scope.knownHosts}
                  siteHosts={scope.siteHosts}
                />
                <GeoRangePicker control={geoRange} />
              </>
            ) : null}
          </div>
        </PageHeading>
        {/* Extra domains are stored with GEO settings, so a project added
            for analytics only can't take them yet. */}
        {scope.hasGeoSettings ? (
          <TrafficUntrackedDomainBanner organizationId={scope.organizationId} />
        ) : null}
        {isEmpty ? (
          <>
            <AnalyticsSourceTabs
              actions={
                <>
                  {pathQuery ? <TrafficPathFilter paths={knownPaths} /> : null}
                  {actionsMenu}
                </>
              }
            />
            <TrafficPageEmpty
              copy={copy}
              hasPreviousData={hasPreviousData}
              installDescription={installDescription}
              installMethod={installMethod}
              scope={scope}
            />
            {pathQuery || !scope.hasProject
              ? null
              : emptyFooter?.(() => setImportOpen(true))}
          </>
        ) : (
          <>
            <AnalyticsSourceTabs
              actions={
                <>
                  <TrafficPathFilter paths={knownPaths} />
                  {actionsMenu}
                </>
              }
            />
            {children}
          </>
        )}
      </div>
    </PageContainer>
  );
}
