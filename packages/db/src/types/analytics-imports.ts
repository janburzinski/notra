import type {
  ANALYTICS_IMPORT_CONNECTION_PROVIDERS,
  ANALYTICS_IMPORT_CONNECTION_STATUSES,
  ANALYTICS_IMPORT_PROVIDERS,
  ANALYTICS_IMPORT_STATUSES,
} from "../constants/analytics-imports";

export type AnalyticsImportProvider =
  (typeof ANALYTICS_IMPORT_PROVIDERS)[number];

export type AnalyticsImportConnectionProvider =
  (typeof ANALYTICS_IMPORT_CONNECTION_PROVIDERS)[number];

export type AnalyticsImportStatus = (typeof ANALYTICS_IMPORT_STATUSES)[number];

export type AnalyticsImportConnectionStatus =
  (typeof ANALYTICS_IMPORT_CONNECTION_STATUSES)[number];

/** Which metrics an import's provider can supply; missing ones read as 0. */
export interface AnalyticsImportCapabilities {
  visitors: boolean;
  visits: boolean;
  bounces: boolean;
  utm: boolean;
  entryPages: boolean;
  sampled: boolean;
}
