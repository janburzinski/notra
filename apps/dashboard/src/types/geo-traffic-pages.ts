import type {
  AiTrafficResponse,
  GeoIngestMethod,
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

/** Data both analytics pages share: scope, filters, setup state and pickers. */
export interface TrafficPageScope {
  organizationId: string;
  organizationSlug: string;
  projectId: string | undefined;
  geoRange: GeoRangeControl;
  hostQuery: string;
  pathQuery: string;
  sites: GeoTrafficSitesMode | undefined;
  /**
   * Analytics only need a project with a website, not GEO tracking: the
   * notra.js key and the accepted hosts both come from the project.
   */
  hasProject: boolean;
  isProjectPending: boolean;
  /** Whether the project has GEO settings, which hold its extra domains. */
  hasGeoSettings: boolean;
  /** The project's website, from its brand identity. */
  domain: string | null;
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
  emptyRangeTitle: string;
  emptyRangeDescription: string;
  /** Under "Connect your website" when the organization has no project. */
  websiteDescription: string;
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
  isSetUp: boolean;
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
