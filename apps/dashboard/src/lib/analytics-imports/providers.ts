import { IMPORT_PROVIDERS } from "@notra/geo-core/constants/analytics-imports";
import {
  fetchCloudflareCrawlerChunk,
  fetchCloudflareRumChunk,
  listCloudflareSources,
  previewCloudflareSource,
} from "@notra/geo-core/imports/cloudflare";
import {
  fetchPlausibleChunk,
  listPlausibleSites,
  previewPlausibleSite,
} from "@notra/geo-core/imports/plausible-api";
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
    default:
      return await listCloudflareSources(credentials, fetchImpl);
  }
}

/**
 * One cheap call that tells where the source's history starts: Plausible's
 * first month, Vercel's first month within its longest retention, or what
 * Cloudflare's plan still keeps.
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
