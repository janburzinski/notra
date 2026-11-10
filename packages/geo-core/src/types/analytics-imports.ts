import type { ANALYTICS_IMPORT_KINDS } from "@notra/db/constants/analytics-imports";
import type {
  AnalyticsImportCapabilities,
  AnalyticsImportConnectionProvider,
  AnalyticsImportProvider,
} from "@notra/db/types/analytics-imports";

export type ImportKind = (typeof ANALYTICS_IMPORT_KINDS)[number];

/** Providers read through a stored connection; CSV exports are uploaded instead. */
export type ImportSourceProvider = Exclude<
  AnalyticsImportProvider,
  "plausible_csv"
>;

export type ImportWebGrain =
  | "total"
  | "page"
  | "entry_page"
  | "source"
  | "campaign"
  | "country"
  | "device"
  | "browser"
  | "os";

export type ImportReferrerGroup =
  | "ai"
  | "direct"
  | "internal"
  | "search"
  | "social"
  | "other";

export interface ImportProviderInfo {
  /** The stored connection it reads through; null for uploaded exports. */
  connection: AnalyticsImportConnectionProvider | null;
  kind: ImportKind;
  /** null: the provider reports it (Plausible keeps everything, Cloudflare per plan). */
  lookbackDays: number | null;
  /** Splits month chunks so one chunk fits the provider's request budget. */
  maxChunkDays?: number;
  /**
   * Whether rows can land on subdomains of the import's host, because the
   * provider reports a hostname per row. Vercel scopes a project to one
   * domain, so its rows only ever carry the import's host.
   */
  writesSubdomains: boolean;
  capabilities: AnalyticsImportCapabilities;
}

/** The hosts an import writes: its host and www alias, and maybe subdomains. */
export interface ImportHostScope {
  host: string;
  subdomains: boolean;
}

export interface ImportReferrerName {
  group: ImportReferrerGroup;
  source: string;
}

export interface ImportReferrerInput {
  /** A host or URL the visit came from. */
  referrer?: string;
  utmSource?: string;
  /** A display name such as Plausible's "Hacker News". */
  sourceName?: string;
  pageHost: string;
}

export interface ImportReferrer {
  host: string;
  group: ImportReferrerGroup;
  source: string;
  aiProduct: string;
}

/** Provider values before mapping; metrics a provider lacks stay undefined. */
export interface WebImportRecord {
  grain: ImportWebGrain;
  day: string;
  host?: string;
  path?: string;
  referrer?: string;
  sourceName?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  country?: string;
  device?: string;
  browser?: string;
  os?: string;
  visitors?: number | null;
  visits?: number | null;
  pageviews?: number;
  bounces?: number | null;
  visitDurationS?: number | null;
  entrances?: number | null;
}

export type WebImportDimension =
  | "host"
  | "path"
  | "referrer"
  | "sourceName"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "utmTerm"
  | "utmContent"
  | "country"
  | "device"
  | "browser"
  | "os";

export type WebImportMetric =
  | "visitors"
  | "visits"
  | "pageviews"
  | "bounces"
  | "visitDurationS"
  | "entrances";

/** One file of Plausible's CSV export and how its columns become a record. */
export interface PlausibleCsvTable {
  grain: ImportWebGrain;
  /** Headers the file must carry, read or not. */
  columns: readonly string[];
  dimensions: Readonly<Partial<Record<string, WebImportDimension>>>;
  /** Count columns in read order; one column may fill several metrics. */
  counts: readonly (readonly [string, WebImportMetric])[];
}

export type PlausibleCell = string | number | null;

/** One Plausible Stats API query per grain and how its row becomes a record. */
export interface PlausibleGrainQuery {
  grain: ImportWebGrain;
  dimensions: string[];
  metrics: string[];
  toRecord: (
    dimensions: PlausibleCell[],
    metrics: Record<string, number>
  ) => Partial<WebImportRecord>;
}

/** One Vercel breakdown dimension and the record field it fills. */
export interface VercelBreakdown {
  grain: ImportWebGrain;
  dimension: string;
  field: keyof WebImportRecord;
}

/** One Rybbit metric parameter and the record field its value fills. */
export interface RybbitBreakdown {
  grain: ImportWebGrain;
  parameter: string;
  field: keyof WebImportRecord;
}

/** One Databuddy query type and the record field its row name fills. */
export interface DatabuddyBreakdown {
  grain: ImportWebGrain;
  query: string;
  field: keyof WebImportRecord;
}

/** One Cloudflare Web Analytics query: its dimensions and the grains it feeds. */
export interface CloudflareRumQuery {
  dimensions: Readonly<Partial<Record<string, WebImportDimension>>>;
  grains: readonly ImportWebGrain[];
}

/** One page of a paginated provider listing; a falsy cursor ends it. */
export interface ImportPage<TCursor, TItem> {
  items: readonly TItem[];
  next: TCursor | null | undefined;
}

export interface GeoImportRecord {
  day: string;
  host: string;
  path: string;
  userAgent: string;
  verified: boolean;
  status: number;
  requests: number;
  sampleInterval: number;
}

export interface ImportRowContext {
  organizationId: string;
  projectId: string;
  siteId: string;
  importId: string;
  provider: AnalyticsImportProvider;
  /** Host for grains the provider reports without one. */
  host: string;
  importedAt: string;
  /** Hosts the project accepts; empty accepts every host. */
  allowedHosts?: readonly string[];
}

export interface ImportDayRange {
  start: string;
  end: string;
}

export interface ImportRangeInput {
  requestedStart: string | null;
  requestedEnd: string | null;
  /** First day the provider can still return. */
  earliestDay: string | null;
  /** First day with native data; imports end the day before. */
  cutoffDay: string;
  /** Days already covered by other completed or running imports. */
  covered: readonly ImportDayRange[];
}

export type ImportFetch = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export interface ImportSource {
  ref: string;
  label: string;
  host: string;
  provider: ImportSourceProvider;
  kind: ImportKind;
}

/** A Cloudflare GraphQL dataset's limits for one zone or account, in seconds. */
export interface CloudflareDatasetLimits {
  notOlderThan: number;
  maxDuration: number;
}

export interface ImportPreview {
  earliestDay: string | null;
  pageviews: number | null;
  /** Page views per month ("2026-08"), to count the days an import takes; null when unknown. */
  pageviewsByMonth: Record<string, number> | null;
}

export interface PlausibleCredentials {
  apiKey: string;
}

export interface CloudflareCredentials {
  apiToken: string;
}

export interface VercelCredentials {
  token: string;
  teamId?: string;
}

export interface RybbitCredentials {
  apiKey: string;
}

export interface DatabuddyCredentials {
  apiKey: string;
}

export interface PlausibleCsvSummary {
  firstDay: string | null;
  lastDay: string | null;
  pageviews: number;
  /** Page views per day, to count the days an import takes. */
  pageviewsByDay: Record<string, number>;
  files: string[];
  /** Records per day across every file, for sizing import chunks. */
  recordsByDay: Record<string, number>;
}

/** The most recent completed import, for the "tracking starts" chart marker. */
export interface ImportCoverage {
  provider: AnalyticsImportProvider;
  /** Last imported day (YYYY-MM-DD). */
  until: string;
  /** First day Notra itself tracked (YYYY-MM-DD), when known. */
  nativeStart: string | null;
}

export interface CompletedImportRow {
  id: string;
  provider: AnalyticsImportProvider;
  host: string;
  until: string | null;
  nativeStart: string | null;
}

export interface CompletedImports {
  ids: string;
  coverage: ImportCoverage | null;
}
