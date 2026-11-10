"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { AnalyticsSourceTabs } from "@/components/analytics/analytics-source-tabs";
import { EmptyState } from "@/components/empty-state";
import { EmptyStateTablePreview } from "@/components/empty-state-preview";
import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { GeoSetupButton } from "@/components/geo/geo-setup-button";
import { TrafficActionsMenu } from "@/components/geo/traffic-actions-menu";
import { TrafficDomainSelect } from "@/components/geo/traffic-domain-select";
import { TrafficEmpty } from "@/components/geo/traffic-empty";
import { TrafficPathEmpty } from "@/components/geo/traffic-path-empty";
import { TrafficPathFilter } from "@/components/geo/traffic-path-filter";
import { PageContainer } from "@/components/layout/container";
import {
  EMPTY_STATE_TABLE_COLUMNS,
  EMPTY_STATE_TABLE_ROWS,
} from "@/constants/empty-state";
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
      setup={scope.ingestSetup}
    />
  );
}

/**
 * Frame of the AI and web analytics tabs: heading with domain and range
 * pickers, the source tabs with the page's toolbar, and the not-set-up and
 * empty states.
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
  const tShared = useTranslations("geo.pages.shared");
  const { geoRange, pathQuery, knownPaths } = scope;
  const [importOpen, setImportOpen] = useState(false);

  if (!scope.settings) {
    return (
      <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="w-full min-w-0 space-y-6 px-4 lg:px-6">
          <PageHeading description={copy.description} title={t("title")} />
          <AnalyticsSourceTabs />
          <EmptyState
            action={<GeoSetupButton organizationId={scope.organizationId} />}
            description={copy.setupDescription}
            preview={
              <EmptyStateTablePreview
                columns={EMPTY_STATE_TABLE_COLUMNS.traffic}
                rows={EMPTY_STATE_TABLE_ROWS}
              />
            }
            title={tShared("notSetUpTitle")}
          />
        </div>
      </PageContainer>
    );
  }

  // Embeds, tracking setup and imports stay reachable on empty pages.
  const actionsMenu = (
    <TrafficActionsMenu
      importOpen={importOpen}
      onImportOpenChange={setImportOpen}
      organizationId={scope.organizationId}
      path={pathQuery}
      range={geoRange.query}
      traffic={scope.traffic}
      web={scope.web}
    />
  );

  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full min-w-0 space-y-6 px-4 lg:px-6">
        <PageHeading description={copy.description} title={t("title")}>
          <div className="flex min-h-8 max-w-full flex-wrap items-center gap-3">
            <TrafficDomainSelect
              hosts={scope.knownHosts}
              siteHosts={scope.siteHosts}
            />
            <GeoRangePicker control={geoRange} />
          </div>
        </PageHeading>
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
            {pathQuery ? null : emptyFooter?.(() => setImportOpen(true))}
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
