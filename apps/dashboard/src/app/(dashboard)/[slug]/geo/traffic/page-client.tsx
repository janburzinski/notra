"use client";

import { isTrafficPagePending } from "@notra/geo-core/utils/ai-traffic";
import { useTranslations } from "use-intl";

import { AiTrafficCard } from "@/components/geo/ai-traffic-card";
import { AiTrafficLogCard } from "@/components/geo/ai-traffic-log-card";
import { TrafficInstallButton } from "@/components/geo/traffic-install-button";
import { TrafficPageShell } from "@/components/geo/traffic-page-shell";
import { TrafficPagesCard } from "@/components/geo/traffic-pages-card";
import { WebVisitorsSection } from "@/components/geo/web-visitors-section";
import { SkeletonCrossfade } from "@/components/skeleton-crossfade";
import { useAiAnalyticsPeople } from "@/lib/hooks/use-ai-analytics-people";
import {
  useAiTrafficSources,
  useGeoTrafficPages,
  usePrefetchGeoTrafficLog,
} from "@/lib/hooks/use-geo";
import { useTrafficPageScope } from "@/lib/hooks/use-traffic-page-scope";
import { useTrafficViewed } from "@/lib/hooks/use-traffic-viewed";
import type { GeoPageClientProps } from "@/types/geo";
import { hasPreviousTraffic } from "@/utils/ai-traffic-groups";
import { withGeoProject } from "@/utils/geo-paths";
import { geoSettingsPath } from "@/utils/settings-path";

import { AiAnalyticsSkeleton } from "./skeleton";

export default function PageClient({ organizationSlug }: GeoPageClientProps) {
  const t = useTranslations("geo.pages.aiAnalytics");
  const tTraffic = useTranslations("geo.pages.traffic");
  const scope = useTrafficPageScope(organizationSlug);
  const { organizationId, projectId, geoRange, traffic, settings } = scope;
  const people = useAiAnalyticsPeople(scope);
  const {
    data: trafficPages,
    isPending: isPagesPending,
    isPlaceholderData: isPagesPlaceholder,
  } = useGeoTrafficPages(
    organizationId,
    geoRange.query,
    scope.hostQuery,
    scope.pathQuery,
    scope.sites
  );
  const {
    data: trafficSources,
    isError: isSourcesError,
    isPlaceholderData: isSourcesPlaceholder,
  } = useAiTrafficSources(
    organizationId,
    geoRange.query,
    scope.hostQuery,
    scope.pathQuery,
    scope.sites
  );
  usePrefetchGeoTrafficLog(
    organizationId,
    { host: scope.hostQuery, path: scope.pathQuery, sites: scope.sites },
    settings !== null
  );
  const pages = trafficPages?.pages ?? [];
  // Undefined keeps the page-count cells loading; an empty list after an error
  // shows the fast counts instead.
  const sourcePaths = isSourcesPlaceholder
    ? undefined
    : (trafficSources?.sources ?? (isSourcesError ? [] : undefined));

  const sources = traffic?.sources ?? [];
  const hasPreviousData = hasPreviousTraffic(sources) || people.hasPreviousData;
  const isEmpty =
    !scope.isTrafficPending &&
    !sources.some((source) => source.visits > 0) &&
    !people.hasData;
  const showSkeleton = isTrafficPagePending({
    isSettingsPending: scope.isSettingsPending,
    hasSettings: settings !== null,
    isTrafficPending: scope.isTrafficPending || people.isPending,
    isEmptyTraffic: isEmpty,
    isIngestPending: scope.isIngestPending,
  });

  useTrafficViewed({
    page: "agent-analytics",
    ready: !showSkeleton,
    hasSettings: settings !== null,
    hasData: !isEmpty,
    rangePreset: geoRange.preset,
  });

  return (
    <SkeletonCrossfade
      loading={showSkeleton}
      skeleton={<AiAnalyticsSkeleton geoRange={geoRange} />}
    >
      <TrafficPageShell
        copy={{
          description: people.show
            ? tTraffic("descriptionWithVisitors")
            : t("description"),
          setupDescription: t("setupDescription"),
          emptyRangeTitle: t("emptyRangeTitle"),
          emptyRangeDescription: t("emptyRangeDescription"),
        }}
        hasPreviousData={hasPreviousData}
        isEmpty={isEmpty}
        scope={scope}
      >
        <div className="flex flex-col gap-6">
          {people.show && people.web ? (
            <WebVisitorsSection
              breakdownsPending={people.breakdownsPending}
              range={geoRange.query}
              traffic={traffic}
              utm={{
                organizationId: scope.organizationId,
                host: scope.hostQuery,
                path: scope.pathQuery,
                sites: scope.sites,
              }}
              web={people.web}
            />
          ) : null}
          <AiTrafficCard
            crawlerSetup={
              scope.pathQuery ? undefined : (
                <TrafficInstallButton setup={scope.ingestSetup} />
              )
            }
            isPending={scope.isTrafficPending}
            pages={pages}
            range={geoRange.query}
            settingsHref={withGeoProject(
              geoSettingsPath(organizationSlug),
              projectId
            )}
            showHero={!people.show}
            sourcePaths={sourcePaths}
            traffic={traffic}
          />
          <TrafficPagesCard
            compare={hasPreviousTraffic(sources)}
            isPending={isPagesPending || isPagesPlaceholder}
            pages={pages}
          />
          <AiTrafficLogCard organizationId={organizationId} />
        </div>
      </TrafficPageShell>
    </SkeletonCrossfade>
  );
}
