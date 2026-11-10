import type {
  AiTrafficResponse,
  GeoIngestMethod,
  GeoSettings,
  GeoTrafficSitesMode,
  WebAnalyticsResponse,
} from "@notra/geo-core/types/geo";
import type { ReactNode } from "react";

import type {
  GEO_TRAFFIC_PAGE_KINDS,
  GEO_TRAFFIC_TABS,
} from "@/constants/geo-traffic-pages";
import type { DashboardGeoIngestSetup, GeoRangeControl } from "@/types/geo";

export type GeoTrafficPageKind = (typeof GEO_TRAFFIC_PAGE_KINDS)[number];

export type GeoTrafficTab = (typeof GEO_TRAFFIC_TABS)[number];

/** Data both analytics pages share: scope, filters, settings and pickers. */
export interface TrafficPageScope {
  organizationId: string;
  organizationSlug: string;
  projectId: string | undefined;
  geoRange: GeoRangeControl;
  hostQuery: string;
  pathQuery: string;
  sites: GeoTrafficSitesMode | undefined;
  settings: GeoSettings | null;
  isSettingsPending: boolean;
  ingestSetup: DashboardGeoIngestSetup | undefined;
  isIngestPending: boolean;
  traffic: AiTrafficResponse | undefined;
  isTrafficPending: boolean;
  web: WebAnalyticsResponse | undefined;
  isWebPending: boolean;
  knownHosts: readonly string[];
  /** Hosts served by Notra Sites, grouped separately in the domain picker. */
  siteHosts: readonly string[];
  knownPaths: readonly string[];
}

interface TrafficPageCopy {
  description: string;
  setupDescription: string;
  emptyRangeTitle: string;
  emptyRangeDescription: string;
}

/** The people section the AI analytics page shows without web analytics. */
export interface AiAnalyticsPeople {
  show: boolean;
  /** Summary with the breakdown tables merged in once they answer the same filter. */
  web: WebAnalyticsResponse | undefined;
  breakdownsPending: boolean;
  hasPreviousData: boolean;
  /** People count as data, or may once the summary loads. */
  hasData: boolean;
  isPending: boolean;
}

export interface TrafficPageEmptyProps {
  scope: TrafficPageScope;
  copy: TrafficPageCopy;
  hasPreviousData: boolean;
  installMethod?: GeoIngestMethod;
  installDescription?: string;
}

export interface TrafficPageShellProps extends TrafficPageEmptyProps {
  isEmpty: boolean;
  /**
   * Shown under the empty state when no page filter is set. Gets the opener
   * of the page's import dialog, which outlives the switch to the data view.
   */
  emptyFooter?: (openImport: () => void) => ReactNode;
  children: ReactNode;
}

export interface TrafficViewedInput {
  page: GeoTrafficPageKind;
  ready: boolean;
  hasSettings: boolean;
  hasData: boolean;
  rangePreset: string;
}

export interface TrafficPageSkeletonFrameProps {
  description: string;
  geoRange?: GeoRangeControl;
  children: ReactNode;
}

export interface TrafficPageSkeletonProps {
  geoRange?: GeoRangeControl;
}
