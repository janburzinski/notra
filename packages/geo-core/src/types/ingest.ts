import type { GeoLogEvent } from "@notra/ai/types/evlog";
import type { GeoTrafficEventRow } from "@notra/analytics/tinybird/datasources";
import type {
  WebErrorRow,
  WebEventRow,
  WebPageEngagementRow,
  WebPageViewRow,
} from "@notra/analytics/types/tinybird-datasources";
import type { GeoRequestPayload } from "@usenotra/geo";
import type { z } from "zod";

import type {
  geoRequestPayloadSchema,
  mcpEventSchema,
  webBeaconRelayPayloadSchema,
  webEngagementPayloadSchema,
} from "../schemas/geo";
import type {
  cloudflareLogpushRecordSchema,
  vercelDrainLogSchema,
} from "../schemas/geo-drains";
import type {
  GeoDrainProvider,
  GeoIngestIdentity,
  GeoVisitorType,
} from "./geo";

export type GeoIngestDefer = (task: () => Promise<void>) => void;

export interface GeoIngestAuthContext {
  readonly organizationId?: string;
  readonly projectId?: string | null;
  readonly siteId?: string;
}

export type GeoIngestAuthRejectionReason =
  | "invalid_signature"
  | "identity_missing"
  | "token_revoked"
  | "site_inactive"
  | "site_token_not_allowed";

export type GeoIngestAuthLookupStage = "identity_lookup" | "site_lookup";

/** Write buffer between the ingest pipeline and Tinybird. */
export interface GeoIngestBuffer {
  /**
   * Returns false when the buffer cannot take the event, in which case the
   * pipeline writes it to Tinybird directly.
   */
  enqueue: (event: GeoTrafficEventRow) => boolean;
  enqueueWeb?: (row: WebPageViewRow) => boolean;
  enqueueEngagement?: (row: WebPageEngagementRow) => boolean;
  enqueueWebEvent?: (row: WebEventRow) => boolean;
  enqueueWebError?: (row: WebErrorRow) => boolean;
  /** Writes an organization's buffered events now, for open live views. */
  expedite: (organizationId: string) => void;
  /**
   * Counts tracked events for billing. Returns false when it cannot take
   * them, in which case the pipeline reports them to Autumn directly, as it
   * does for every event without a usage buffer.
   */
  trackUsage?: (organizationId: string, value: number) => boolean;
}

export interface GeoIngestAnalyticsInput {
  identity: GeoIngestIdentity;
  event: GeoTrafficEventRow;
}

export interface GeoVisitorSignals {
  clientHints: boolean;
  fetchMode: string | null;
  tracing: boolean;
}

export interface GeoVisitorInput {
  userAgent: string | undefined;
  referer: string | undefined;
  accept: string | undefined;
  signals?: GeoVisitorSignals;
}

export interface GeoVisitorClassification {
  visitorType: GeoVisitorType;
  source: string;
  agent: string;
  category: string;
  confidence: string;
}

export interface GeoJourneyInput {
  url: URL;
  source: string;
  ip: string | undefined;
  capturedAt: Date;
  visitorType: GeoVisitorType;
  category: string;
}

export interface GeoJourneyTuning {
  bucketSeconds: number;
  fullIp: boolean;
}

export interface GeoTrafficEventInput {
  organizationId: string;
  projectId: string | null;
  siteId?: string;
  payload: GeoRequestPayload;
  url: URL;
  capturedAt: Date;
  classification: GeoVisitorClassification;
  journey: GeoJourneyResolution;
}

export interface GeoJourneyResolution {
  journeyId: string;
  path: string;
}

export type GeoIngestDropReason =
  | "visitor_type"
  | "host"
  | "site"
  | "not_site"
  | "web_rate_limited"
  | "network_rate_limited"
  | "quota"
  | "consent"
  | "origin";

/** Admits one request for `key`; `now` is for tests. */
export type LocalRateLimit = (key: string, now?: number) => boolean;

export interface McpEventInput {
  identity: GeoIngestIdentity;
  payload: McpEventPayload;
  capturedAt: Date;
}

export type GeoIngestResult =
  | {
      outcome: "ingested";
      organizationId: string;
      projectId: string | null;
      visitorType: GeoVisitorType;
      source: string;
      agent: string;
      ingestMs: number;
    }
  | {
      outcome: "dropped";
      reason: GeoIngestDropReason;
      organizationId: string;
      projectId: string | null;
      visitorType: GeoVisitorType;
      host?: string;
    };

export type GeoIngestRuntime = "unkey" | "vercel" | "local";

export interface BatchedRow {
  organization_id: string;
}

export type GeoIngestPayload = z.infer<typeof geoRequestPayloadSchema>;

export type McpEventPayload = z.infer<typeof mcpEventSchema>;

type WebEngagementPayload = z.infer<typeof webEngagementPayloadSchema>;

/** A notra.js beacon without its key, page URL and referrer. */
export type WebBeaconFields = z.infer<
  typeof webBeaconRelayPayloadSchema
>["beacon"];

export interface WebPageViewInput {
  identity: GeoIngestIdentity;
  payload: GeoIngestPayload;
  url: URL;
  capturedAt: Date;
  classification: GeoVisitorClassification;
  /** notra.js page view id, so engagement, events and vitals join to it. */
  viewId?: string;
  /** From a `data-hash` install: store its path-like hash route. */
  hashRoutes?: boolean;
}

export interface WebEventInput {
  identity: GeoIngestIdentity;
  /** The beacon's request envelope: IP and user agent for the visitor id. */
  payload: GeoIngestPayload;
  url: URL;
  capturedAt: Date;
  viewId: string;
  /** Host and path of the clicked link to another host. */
  outboundUrl: string;
  /** From a `data-hash` install: store its path-like hash route. */
  hashRoutes?: boolean;
}

export interface WebErrorReport {
  message: string;
  source: string;
  line: number;
}

export interface WebErrorInput {
  identity: GeoIngestIdentity;
  payload: GeoIngestPayload;
  url: URL;
  capturedAt: Date;
  viewId: string;
  error: WebErrorReport;
  /** From a `data-hash` install: store its path-like hash route. */
  hashRoutes?: boolean;
}

export interface WebEngagementInput {
  identity: GeoIngestIdentity;
  payload: WebEngagementPayload;
  url: URL;
  capturedAt: Date;
  /** From a `data-hash` install: store its path-like hash route. */
  hashRoutes?: boolean;
}

export interface WebReferrer {
  host: string;
  group: string;
  source: string;
  aiProduct: string;
}

export interface WebSession {
  id: string;
  index: number;
  origin?: string;
}

export type VercelDrainLog = z.infer<typeof vercelDrainLogSchema>;

export type CloudflareLogpushRecord = z.infer<
  typeof cloudflareLogpushRecordSchema
>;

export interface GeoDrainRecord {
  payload: GeoIngestPayload;
  dedupeKey: string;
}

export type GeoDrainHeaders = Map<string, string | string[] | null>;

export interface GeoIngestHandled {
  response: Response;
  fields: Omit<GeoLogEvent, "event">;
}

export type GeoDrainRecordOutcome =
  | "ingested"
  | "dropped"
  | "duplicate"
  | "rate_limited"
  | "invalid"
  | "failed";

export interface GeoDrainSummary {
  provider: GeoDrainProvider;
  organizationId: string;
  projectId: string;
  lines: number;
  requests: number;
  aiRequests: number;
  ingested: number;
  duplicates: number;
}

export interface WebCollectOptions {
  /** Country for an IP when no edge header carries one (in-process GeoIP). */
  lookupCountry?: (ip: string) => string | undefined;
}

/**
 * Where a verified identity comes from: a write token, a Notra Site's
 * server-side report, notra.js on a Notra Site (relayed by the Site), or
 * notra.js with a public key.
 */
export type GeoIngestIdentityKind = "server" | "site" | "site-beacon" | "web";

/** What an identity kind may record and how its checks are enforced. */
export interface GeoIngestIdentityPolicy {
  /** Records people's page views and engagement, not only AI traffic. */
  recordsVisits: boolean;
  /** Must match the scope's current token generation; rotation revokes it. */
  followsRotation: boolean;
  /**
   * Which visitors become AI traffic events: every tracked type, only AI
   * referrals while no server SDK or drain already reports them, or only AI
   * referrals the visitor allowed measuring (a Site behind a cookie banner).
   */
  aiEvents: "tracked" | "referrals-without-server" | "consented-referrals";
  /** Marks the scope as reported by server-side tracking. */
  marksServerTraffic: boolean;
  /** Posts on every page view, so scope checks are cached in process. */
  cachesChecks: boolean;
}
