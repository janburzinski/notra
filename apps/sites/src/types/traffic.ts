export interface TrafficPayload {
  timestamp: string;
  method: string;
  url: string;
  ip?: string;
  geo?: { country?: string };
  referer?: string;
  userAgent?: string;
  accept?: string;
  acceptLanguage?: string;
  requestId?: string;
  status?: number;
  signals: {
    clientHints: boolean;
    fetchMode: string | null;
    prefetch: boolean;
    tracing: boolean;
  };
  visitorConsent?: boolean;
}

export interface TrafficReport {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  ingestUrl: string;
  token: string;
  request: Request;
  method: string;
  referer: string | null;
  publicUrl: string;
  proxied: boolean;
  status: number;
  visitorConsent?: boolean;
}

export interface BeaconReport extends TrafficReport {
  /** What notra.js sent, without its key, page URL and referrer. */
  beacon: Record<string, unknown>;
}

/** A notra.js beacon posted to the Site's own event endpoint. */
export interface AnalyticsBeacon {
  /** Path, query and hash of the page notra.js reported. */
  page: string;
  /** The page's referrer, sent with page views only. */
  referrer: string | null;
  isPageView: boolean;
  fields: Record<string, unknown>;
}

export interface IngestPost {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  ingestUrl: string;
  token: string;
  kind: "traffic" | "beacon";
  buildBody: () => unknown;
}
