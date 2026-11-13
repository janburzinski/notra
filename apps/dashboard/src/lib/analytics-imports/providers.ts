import { IMPORT_PROVIDERS } from "@notra/geo-core/constants/analytics-imports";
import {
  fetchCloudflareCrawlerChunk,
  fetchCloudflareRumChunk,
  listCloudflareSources,
  previewCloudflareSource,
} from "@notra/geo-core/imports/cloudflare";
import {
  fetchDatabuddyChunk,
  listDatabuddyWebsites,
  previewDatabuddyWebsite,
} from "@notra/geo-core/imports/databuddy";
import {
  fetchPlausibleChunk,
  listPlausibleSites,
  previewPlausibleSite,
} from "@notra/geo-core/imports/plausible-api";
import {
  canonicalPostHogSourceRef,
  fetchPostHogChunk,
  listPostHogSources,
  previewPostHogSource,
  resolvePostHogCredentials,
} from "@notra/geo-core/imports/posthog";
import {
  fetchRybbitChunk,
  listRybbitSites,
  previewRybbitSite,
} from "@notra/geo-core/imports/rybbit";
import {
  fetchVercelChunk,
  listVercelProjects,
  previewVercelProject,
} from "@notra/geo-core/imports/vercel";
import type {
  ImportPreview,
  ImportSource,
  ImportSourceProvider,
} from "@notra/geo-core/types/analytics-imports";
import {
  earliestDayForLookback,
  toDay,
} from "@notra/geo-core/utils/analytics-import-range";

import type {
  AnalyticsImportChunkRecords,
  AnalyticsImportCredentials,
  FetchAnalyticsImportChunkInput,
} from "@/types/analytics-imports";

import { rateLimitedImportFetch } from "./rate-limit";

/**
 * Fills in what a key alone doesn't say before it is saved: the PostHog
 * region it belongs to. Other providers' keys are stored as entered.
 */
export async function resolveImportCredentials(
  credentials: AnalyticsImportCredentials,
  connectionId: string
): Promise<AnalyticsImportCredentials> {
  if (credentials.provider !== "posthog") {
    return credentials;
  }
  return {
    provider: "posthog",
    ...(await resolvePostHogCredentials(
      credentials,
      rateLimitedImportFetch(credentials.provider, connectionId)
    )),
  };
}

/**
 * The ref an import is planned, stored and deduplicated under. PostHog's
 * names the host it reads, so a listed host and a typed one share it;
 * other providers' refs already name one site.
 */
export function canonicalImportSourceRef(
  provider: ImportSourceProvider,
  ref: string,
  host: string
): string {
  return provider === "posthog" ? canonicalPostHogSourceRef(ref, host) : ref;
}

export async function listImportSources(
  credentials: AnalyticsImportCredentials,
  connectionId: string
): Promise<ImportSource[]> {
  const fetchImpl = rateLimitedImportFetch(credentials.provider, connectionId);
  switch (credentials.provider) {
    case "plausible":
      return await listPlausibleSites(credentials, fetchImpl);
    case "vercel":
      return await listVercelProjects(credentials, fetchImpl);
    case "rybbit":
      return await listRybbitSites(credentials, fetchImpl);
    case "databuddy":
      return await listDatabuddyWebsites(credentials, fetchImpl);
    case "posthog":
      return await listPostHogSources(credentials, fetchImpl);
    default:
      return await listCloudflareSources(credentials, fetchImpl);
  }
}

/**
 * One cheap call that tells where the source's history starts: Plausible's
 * or Rybbit's first month, Databuddy's or PostHog's first day, Vercel's first
 * month within its longest retention, or what Cloudflare's plan still keeps.
 */
export async function previewImportSource(
  credentials: AnalyticsImportCredentials,
  connectionId: string,
  provider: ImportSourceProvider,
  ref: string
): Promise<ImportPreview> {
  const fetchImpl = rateLimitedImportFetch(credentials.provider, connectionId);
  switch (credentials.provider) {
    case "plausible":
      return await previewPlausibleSite(credentials, ref, fetchImpl);
    case "rybbit":
      return await previewRybbitSite(
        credentials,
        ref,
        toDay(new Date()),
        fetchImpl
      );
    case "databuddy":
      return await previewDatabuddyWebsite(
        credentials,
        ref,
        toDay(new Date()),
        fetchImpl
      );
    case "posthog":
      return await previewPostHogSource(credentials, ref, fetchImpl);
    case "vercel": {
      const today = toDay(new Date());
      return await previewVercelProject(
        credentials,
        ref,
        {
          start:
            earliestDayForLookback(
              IMPORT_PROVIDERS.vercel.lookbackDays,
              today
            ) ?? today,
          end: today,
        },
        fetchImpl
      );
    }
    default:
      return await previewCloudflareSource(
        credentials,
        provider === "cloudflare_rum" ? "cloudflare_rum" : "cloudflare",
        ref,
        fetchImpl
      );
  }
}

export async function fetchImportChunk({
  credentials,
  connectionId,
  provider,
  ref,
  host,
  range,
}: FetchAnalyticsImportChunkInput): Promise<AnalyticsImportChunkRecords> {
  const fetchImpl = rateLimitedImportFetch(credentials.provider, connectionId);
  switch (credentials.provider) {
    case "plausible":
      return {
        kind: "web",
        records: await fetchPlausibleChunk(credentials, ref, range, fetchImpl),
      };
    case "rybbit":
      return {
        kind: "web",
        records: await fetchRybbitChunk(
          credentials,
          ref,
          host,
          range,
          fetchImpl
        ),
      };
    case "databuddy":
      return {
        kind: "web",
        records: await fetchDatabuddyChunk(
          credentials,
          ref,
          host,
          range,
          fetchImpl
        ),
      };
    case "posthog":
      return {
        kind: "web",
        records: await fetchPostHogChunk(
          credentials,
          ref,
          host,
          range,
          fetchImpl
        ),
      };
    case "vercel":
      return {
        kind: "web",
        records: await fetchVercelChunk(
          credentials,
          ref,
          host,
          range,
          fetchImpl
        ),
      };
    default:
      return provider === "cloudflare_rum"
        ? {
            kind: "web",
            records: await fetchCloudflareRumChunk(
              credentials,
              ref,
              range,
              fetchImpl
            ),
          }
        : {
            kind: "geo",
            records: await fetchCloudflareCrawlerChunk(
              credentials,
              ref,
              range,
              fetchImpl
            ),
          };
  }
}
