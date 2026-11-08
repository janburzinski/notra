"use client";

import {
  ingestAllowedHosts,
  unionTrafficHosts,
} from "@notra/geo-core/utils/geo-project-domains";

import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import {
  useAiTraffic,
  useGeoIngestSetup,
  useGeoSettings,
  useGeoTrafficPages,
  useWebAnalytics,
} from "@/lib/hooks/use-geo";
import { useGeoActiveProject } from "@/lib/hooks/use-geo-active-project";
import { useGeoRange } from "@/lib/hooks/use-geo-range";
import { useGeoTrafficHostQuery } from "@/lib/hooks/use-geo-traffic-host";
import {
  useKnownTrafficPaths,
  useTrafficPathQuery,
} from "@/lib/hooks/use-traffic-path";
import { useTrafficSitesMode } from "@/lib/hooks/use-traffic-sites";
import type { TrafficPageScope } from "@/types/geo-traffic-pages";
import {
  trafficHostsFromPages,
  trafficPathOptions,
} from "@/utils/ai-traffic-pages";
import { resolveOrganizationId } from "@/utils/geo-overview-organization";
import { trafficSiteHosts } from "@/utils/traffic-sites";
import { webHostsForSelect } from "@/utils/web-analytics";

/**
 * Shared data for the AI and web analytics pages. The domain and path
 * pickers read the unfiltered page inventory so a selected filter never hides
 * the other options.
 */
export function useTrafficPageScope(
  organizationSlug: string
): TrafficPageScope {
  const { projectId } = useGeoProjectScope();
  const { getOrganization, activeOrganization } = useOrganizationsContext();
  const organizationId = resolveOrganizationId(
    organizationSlug,
    activeOrganization,
    getOrganization(organizationSlug)
  );
  const { domain: brandDomain } = useGeoActiveProject(organizationId);
  const geoRange = useGeoRange();
  const [hostQuery] = useGeoTrafficHostQuery();
  const [pathQuery] = useTrafficPathQuery();
  const sites = useTrafficSitesMode();

  const { data: settingsData, isPending: isSettingsPending } =
    useGeoSettings(organizationId);
  const { data: ingestSetup, isPending: isIngestPending } =
    useGeoIngestSetup(organizationId);
  const {
    data: traffic,
    isPending: isTrafficPending,
    isPlaceholderData: isTrafficPlaceholder,
  } = useAiTraffic(organizationId, geoRange.query, hostQuery, pathQuery, sites);
  const {
    data: web,
    isPending: isWebPending,
    isPlaceholderData: isWebPlaceholder,
  } = useWebAnalytics(
    organizationId,
    geoRange.query,
    hostQuery,
    pathQuery,
    sites
  );
  const { data: inventory } = useGeoTrafficPages(
    organizationId,
    geoRange.query
  );
  const inventoryPages = inventory?.pages ?? [];

  const knownHosts = unionTrafficHosts(
    ingestAllowedHosts(brandDomain, settingsData?.settings?.domains),
    [...trafficHostsFromPages(inventoryPages), ...webHostsForSelect(web)]
  );
  const knownPaths = useKnownTrafficPaths(
    trafficPathOptions(web?.pages ?? [], inventoryPages),
    `${organizationId}:${projectId ?? ""}`
  );

  return {
    organizationId,
    organizationSlug,
    projectId,
    geoRange,
    hostQuery,
    pathQuery,
    sites,
    settings: settingsData?.settings ?? null,
    isSettingsPending,
    ingestSetup,
    isIngestPending,
    traffic,
    isTrafficPending: isTrafficPending || isTrafficPlaceholder,
    web,
    isWebPending: isWebPending || isWebPlaceholder,
    knownHosts,
    siteHosts: trafficSiteHosts(web),
    knownPaths,
  };
}
