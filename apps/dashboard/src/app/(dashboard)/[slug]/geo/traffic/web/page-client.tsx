"use client";

import { isTrafficPagePending } from "@notra/geo-core/utils/ai-traffic";
import { useTranslations } from "use-intl";

import { ImportHistoryCard } from "@/components/analytics-import/import-history-card";
import { TrafficPageShell } from "@/components/geo/traffic-page-shell";
import { WebVisitorsSection } from "@/components/geo/web-visitors-section";
import { SkeletonCrossfade } from "@/components/skeleton-crossfade";
import { useWebAnalyticsBreakdowns } from "@/lib/hooks/use-geo";
import { useTrafficPageScope } from "@/lib/hooks/use-traffic-page-scope";
import { useKnownTrafficPaths } from "@/lib/hooks/use-traffic-path";
import { useTrafficViewed } from "@/lib/hooks/use-traffic-viewed";
import type { GeoPageClientProps } from "@/types/geo";
import { trafficPathOptions } from "@/utils/ai-traffic-pages";
import {
  hasPreviousWebPeriod,
  hasWebAnalytics,
  withWebBreakdowns,
} from "@/utils/web-analytics";

import { WebAnalyticsSkeleton } from "./skeleton";

export default function PageClient({ organizationSlug }: GeoPageClientProps) {
  const t = useTranslations("geo.pages.webAnalytics");
  const scope = useTrafficPageScope(organizationSlug);
  const { organizationId, geoRange } = scope;
  const {
    data: webBreakdowns,
    isPending: isBreakdownsPending,
    isPlaceholderData: isBreakdownsPlaceholder,
  } = useWebAnalyticsBreakdowns(
    organizationId,
    geoRange.query,
    scope.hostQuery,
    scope.pathQuery,
    scope.sites
  );
  // Only merge breakdowns and summary that answer the same filter.
  const breakdownsStale = isBreakdownsPlaceholder || scope.isWebPending;
  const web = withWebBreakdowns(
    scope.web,
    breakdownsStale ? undefined : webBreakdowns
  );
  // The summary carries no pages, so the page filter also offers the pages
  // notra.js recorded; paths stay known once seen, like the AI inventory's.
  const knownPaths = useKnownTrafficPaths(
    [...scope.knownPaths, ...trafficPathOptions(webBreakdowns?.pages ?? [])],
    `${organizationId}:${scope.projectId ?? ""}`
  );

  const isEmpty = !scope.isWebPending && !hasWebAnalytics(web);
  const showSkeleton = isTrafficPagePending({
    isSettingsPending: scope.isProjectPending,
    hasSettings: scope.hasProject,
    isTrafficPending: scope.isWebPending,
    isEmptyTraffic: isEmpty,
    isIngestPending: scope.isIngestPending,
  });

  useTrafficViewed({
    page: "web-analytics",
    ready: !showSkeleton,
    isSetUp: scope.hasProject,
    hasData: !isEmpty,
    rangePreset: geoRange.preset,
  });

  return (
    <SkeletonCrossfade
      loading={showSkeleton}
      skeleton={<WebAnalyticsSkeleton geoRange={geoRange} />}
    >
      <TrafficPageShell
        copy={{
          description: t("description"),
          emptyRangeTitle: t("emptyRangeTitle"),
          emptyRangeDescription: t("emptyRangeDescription"),
          websiteDescription: t("websiteDescription"),
        }}
        emptyFooter={(openImport) => <ImportHistoryCard onOpen={openImport} />}
        hasPreviousData={hasPreviousWebPeriod(web)}
        installDescription={t("installDescription")}
        installMethod="script"
        isEmpty={isEmpty}
        scope={{ ...scope, knownPaths }}
      >
        {web ? (
          <WebVisitorsSection
            breakdownsPending={isBreakdownsPending || breakdownsStale}
            engagement={web.engagement}
            range={geoRange.query}
            showScriptReports
            utm={{
              organizationId: scope.organizationId,
              host: scope.hostQuery,
              path: scope.pathQuery,
              sites: scope.sites,
            }}
            web={web}
          />
        ) : null}
      </TrafficPageShell>
    </SkeletonCrossfade>
  );
}
