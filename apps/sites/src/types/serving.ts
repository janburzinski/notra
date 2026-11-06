import type {
  SiteManifest,
  SiteManifestFile,
} from "@notra/sites-core/types/deployment";

import type { SitesDeps } from "./worker";

export interface SiteRequestContext {
  deps: SitesDeps;
  request: Request;
  url: URL;
  host: string;
  origin: string;
}

export interface ResolvedDeployment {
  siteId: string;
  deploymentId: string;
  isPreview: boolean;
  trafficToken: string | null;
}

export interface LoadedManifest {
  manifest: SiteManifest;
  files: Map<string, SiteManifestFile>;
}

export interface TimedCacheEntry<T> {
  value: T;
  at: number;
  /** Order of the read that produced the value; only a later read replaces it. */
  read: number;
}

export interface ServeFileParams {
  deps: SitesDeps;
  request: Request;
  siteId: string;
  deploymentId: string;
  file: SiteManifestFile;
  status: number;
  isPreview: boolean;
  contentSecurityPolicy?: string;
  analytics?: AnalyticsScriptTag | null;
  extraHeaders?: Record<string, string>;
}

export interface AnalyticsScriptTag {
  scriptSrc: string;
  eventPath: string;
  consent: boolean;
  reportsView: boolean;
}

export interface RedirectMatch {
  location: string;
  status: number;
}

export interface MarkdownNotFoundParams {
  path: string;
  indexPath: string | null;
  llmsPath: string;
}

export type ServerTimingName = "host" | "state" | "manifest";

export interface ServerTimingEntry {
  name: ServerTimingName;
  durationMs: number;
  /** Where the value came from: the isolate's cache or R2. */
  source: "cache" | "r2";
}

export interface ServerTiming {
  entries: ServerTimingEntry[];
  record(
    name: ServerTimingName,
    durationMs: number,
    source: "cache" | "r2"
  ): void;
}
