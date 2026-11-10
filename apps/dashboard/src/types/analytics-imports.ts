import type {
  analyticsImportConnections,
  analyticsImports,
} from "@notra/db/schema";
import type {
  AnalyticsImportCapabilities,
  AnalyticsImportConnectionProvider,
  AnalyticsImportConnectionStatus,
  AnalyticsImportProvider,
  AnalyticsImportStatus,
} from "@notra/db/types/analytics-imports";
import type { Database } from "@notra/db/types/database";
import type {
  CloudflareCredentials,
  DatabuddyCredentials,
  GeoImportRecord,
  ImportDayRange,
  ImportKind,
  PlausibleCredentials,
  RybbitCredentials,
  VercelCredentials,
  WebImportRecord,
} from "@notra/geo-core/types/analytics-imports";
import type { Run } from "workflow/api";

import type { GeoDateRange } from "@/types/geo";

export type AnalyticsImportRow = typeof analyticsImports.$inferSelect;

/** The database or a transaction on it; plan reads go through either. */
export type AnalyticsImportReader = Pick<Database, "query">;

export type AnalyticsImportConnectionRow =
  typeof analyticsImportConnections.$inferSelect;

export type AnalyticsImportCredentials =
  | ({ provider: "plausible" } & PlausibleCredentials)
  | ({ provider: "cloudflare" } & CloudflareCredentials)
  | ({ provider: "vercel" } & VercelCredentials)
  | ({ provider: "rybbit" } & RybbitCredentials)
  | ({ provider: "databuddy" } & DatabuddyCredentials);

/** One request budget of a provider connection. */
export interface ImportRateWindow {
  requests: number;
  windowSeconds: number;
}

export type AnalyticsImportChunkOutcome =
  | { status: "done" }
  | { status: "cancelled" }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "failed"; error: string };

export interface AnalyticsImportPlan {
  chunks: string[];
}

/** Whether an import may start: imports from one account run one at a time. */
export type AnalyticsImportTurn =
  | { status: "ready" }
  | { status: "waiting"; retryAfterSeconds: number };

/** A workflow run's status, or "missing" when the runtime no longer knows it. */
export type AnalyticsImportRunState =
  | Awaited<Run<unknown>["status"]>
  | "missing";

/** What the recovery job did with stuck imports. */
export interface AnalyticsImportRecoveryResult {
  checked: number;
  restarted: number;
  failed: number;
}

/** How days another source already has for the domain are handled. */
export type AnalyticsImportOverlapMode = "skip" | "add";

/** Days another source already imported for the same domain. */
interface AnalyticsImportOverlap {
  importId: string;
  provider: AnalyticsImportProvider;
  sourceLabel: string;
  host: string;
  startDay: string;
  endDay: string;
}

/** An import's range when overlapping days are added together. */
export interface AnalyticsImportAddedRange {
  startDay: string | null;
  endDay: string | null;
  months: number;
  pageviews: number | null;
  clipped: boolean;
}

/** A source's page views: the total, and per day or month when known. */
export interface AnalyticsImportSourcePageviews {
  total: number | null;
  counts: Readonly<Record<string, number>> | null;
}

/** What one chunk wrote: Tinybird rows and page views (requests for crawlers). */
export interface AnalyticsImportWritten {
  rows: number;
  pageviews: number;
}

export interface FetchAnalyticsImportChunkInput {
  credentials: AnalyticsImportCredentials;
  connectionId: string;
  provider: AnalyticsImportProvider;
  ref: string;
  host: string;
  range: ImportDayRange;
}

export type AnalyticsImportChunkRecords =
  | { kind: "web"; records: WebImportRecord[] }
  | { kind: "geo"; records: GeoImportRecord[] };

export type { AnalyticsImportSummary } from "@notra/geo-core/types/analytics-import-summary";

export interface AnalyticsImportConnectionSummary {
  id: string;
  provider: AnalyticsImportConnectionProvider;
  label: string;
  status: AnalyticsImportConnectionStatus;
  lastError: string | null;
  createdAt: string;
}

export interface AnalyticsImportPreview {
  provider: AnalyticsImportProvider;
  kind: ImportKind;
  cutoffDay: string;
  /** First day Notra tracked the host; null before it tracked anything. */
  nativeStartDay: string | null;
  startDay: string | null;
  endDay: string | null;
  months: number;
  pageviews: number | null;
  /** Days another import already covers were left out. */
  clipped: boolean;
  /** Other sources that already have some of these days for the domain. */
  overlaps: AnalyticsImportOverlap[];
  /** This same source already imported some of these days. */
  alreadyImported: boolean;
  /** The range when those days are added together; null without overlaps. */
  added: AnalyticsImportAddedRange | null;
}

export interface PlanImportRangeInput {
  organizationId: string;
  projectId: string;
  provider: AnalyticsImportProvider;
  /** The source's identity; its own days are never imported twice. */
  sourceRef: string;
  host: string;
  requestedStart: string | null;
  requestedEnd: string | null;
  earliestDay: string | null;
  /** Defaults to skipping days other sources already have. */
  overlap?: AnalyticsImportOverlapMode;
}

/** Host, kind and native cut-off: what a plan needs before it reads other imports. */
export interface ImportRangeBase {
  host: string;
  kind: ImportKind;
  cutoffDay: string;
  /** The first day Notra tracked the host (today at the latest), or null before any traffic. */
  nativeStartDay: string | null;
}

/** Days an import of the same project, kind and domain scope already has. */
export interface CoveredImport extends ImportDayRange {
  id: string;
  provider: AnalyticsImportProvider;
  sourceRef: string;
  sourceLabel: string;
  host: string;
}

export interface ImportRangePlan extends ImportRangeBase {
  /** The days this import writes, for the chosen overlap mode. */
  range: ImportDayRange | null;
  /** Days another import already covers were left out. */
  clipped: boolean;
  /** The range when other sources' days are skipped. */
  skipped: ImportDayRange | null;
  /** The range when other sources' days are added together. */
  added: ImportDayRange | null;
  /** Unclipped range, to tell whether either one left days out. */
  unclipped: ImportDayRange | null;
  overlaps: AnalyticsImportOverlap[];
  /** The same source (an earlier upload of this export) already has some of these days. */
  alreadyImported: boolean;
}

export interface CreateAnalyticsImportInput {
  organizationId: string;
  projectId: string;
  userId: string;
  provider: AnalyticsImportProvider;
  connectionId: string | null;
  sourceRef: string;
  sourceLabel: string;
  host: string;
  requestedStart: string | null;
  requestedEnd: string | null;
  earliestDay: string | null;
  overlap?: AnalyticsImportOverlapMode;
  uploadKey?: string;
}

export interface SaveAnalyticsImportConnectionInput {
  organizationId: string;
  userId: string;
  label: string;
  credentials: AnalyticsImportCredentials;
}

/** What the connect form sends: one key or token, plus Vercel's team. */
export interface AnalyticsImportSecretInput {
  provider: AnalyticsImportConnectionProvider;
  secret: string;
  teamId?: string;
}

/** SSE-C parameters for one uploaded export. */
export interface AnalyticsImportUploadEncryption {
  SSECustomerAlgorithm: "AES256";
  SSECustomerKey: string;
  SSECustomerKeyMD5: string;
}

export type AnalyticsImportUploadTarget =
  | {
      mode: "storage";
      url: string;
      key: string;
      maxBytes: number;
      /** Headers the PUT must send; the URL's signature covers them. */
      headers: Record<string, string>;
    }
  | { mode: "inline"; maxBytes: number };

/** What the progress view shows for an import's status. */
export type AnalyticsImportProgressPhase =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  /** Its rows are being removed. */
  | "deleting"
  /** Gone from the list while its progress was open. */
  | "deleted";

/** What one chunk covers: a calendar month, a week (Vercel) or part of an export. */
export type AnalyticsImportChunkUnit = "month" | "week" | "batch" | "part";

export type AnalyticsImportChunkState =
  | "done"
  | "active"
  | "pending"
  | "failed";

export interface AnalyticsImportChunkSegment {
  key: string;
  /** Null when the chunk's days are not known, as for a multi-part export. */
  start: string | null;
  end: string | null;
  /** Days covered; 1 when the days are not known. */
  days: number;
  state: AnalyticsImportChunkState;
}

export interface AnalyticsImportProgressModel {
  phase: AnalyticsImportProgressPhase;
  unit: AnalyticsImportChunkUnit;
  /** Oldest first; chunks run newest first, so they fill from the end. */
  segments: AnalyticsImportChunkSegment[];
  /** Whether each segment's days are known. */
  exact: boolean;
  done: number;
  total: number;
  /** The chunk running, waiting or failed, if any. */
  current: AnalyticsImportChunkSegment | null;
}

/** Where "View analytics" shows an import: the page it lands on, and the range to set. */
export type AnalyticsImportViewTarget =
  | { mode: "inPlace"; range: GeoDateRange | null }
  | { mode: "navigate"; href: string };

/** A message under `geo.analyticsImport.progress`, with its values. */
export interface AnalyticsImportProgressMessage {
  key:
    | "importing"
    | "importedPageviews"
    | "importedRequests"
    | "stopped"
    | "chunks.month"
    | "chunks.week"
    | "chunks.batch"
    | "chunks.part"
    | "period"
    | "queuedBehind"
    | "queuedLine"
    | "waitingLine"
    | "waitingSoon"
    | "completedLine"
    | "failedLine"
    | "failedAny"
    | "deletingLine"
    | "deletedLine";
  values: Record<string, string | number>;
}

/** One part of the subtext: a message, or text that is already formatted. */
export type AnalyticsImportProgressPart =
  | AnalyticsImportProgressMessage
  | { text: string };

/**
 * The progress view: the mascot's dance or an icon, a title, and a subtext
 * of one or more parts joined by " · ".
 */
export interface AnalyticsImportProgressView {
  mascot: "sway" | "cheer" | null;
  icon: "stopped" | "deleted" | null;
  title: AnalyticsImportProgressMessage;
  detail: AnalyticsImportProgressPart[];
  /** A stopped import shows its error as the subtext when it has one. */
  showError: boolean;
}

/** What the view names: the running chunk, the provider, the wait and the import's days, formatted. */
export interface AnalyticsImportProgressContext {
  period: string | null;
  provider: string;
  seconds: number;
  startDate: string | null;
  endDate: string | null;
}

/** Where the dashboard is when "View analytics" is clicked. */
export interface AnalyticsImportViewPlace {
  slug: string;
  pathname: string;
  range: GeoDateRange;
  /** The current range as its URL param; null for the default. */
  rangeParam: string | null;
  today: string;
}

/** What "View analytics" may do: navigate, or widen the range and close Settings in place. */
export interface AnalyticsImportViewActions {
  push: (href: string) => void;
  setRange: (range: GeoDateRange) => void;
  /** Absent when Settings isn't open. */
  closeSettings?: () => void;
}
