import {
  fetchWebpage,
  isContextDevConfigured,
} from "@notra/ai/utils/context-dev";
import { logInfo, logWarn } from "@notra/ai/utils/server-log";
import type { GeoScopeInput } from "@notra/geo-core/types/geo";
import { GEO_SHELF_TITLE_MAX_LENGTH } from "@notra/schemas/constants/dashboard/geo-shelf";
import { shelfFetchUrl } from "@notra/schemas/utils/dashboard/shelf-url";
import { Effect } from "effect";

import {
  GEO_SHELF_FETCH_UNREADABLE_STATUSES,
  GEO_SHELF_FETCH_CACHE_MS,
  GEO_SHELF_FETCH_CONCURRENCY,
  GEO_SHELF_FETCH_MIN_TEXT_LENGTH,
  GEO_SHELF_FETCH_TIMEOUT_MS,
} from "@/constants/geo-shelf";
import { assertStablePublicShelfUrl } from "@/lib/geo-shelf/preview";
import { loadGeoShelfContext, storeKey } from "@/lib/geo-shelf/service";
import {
  listGeoShelfFetchCandidates,
  writeGeoShelfFetchResult,
} from "@/lib/geo-shelf/store";
import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import {
  mergeFetchedPlacements,
  readShelfPage,
} from "@/utils/geo-shelf-page-read";

import type {
  GeoShelfFetchCandidate,
  GeoShelfFetchOutcome,
  GeoShelfPageBrand,
  GeoShelfStoreSeed,
} from "../../types/geo-shelf";

const MARKDOWN_SYNTAX = /[#*_>`|[\]()-]+/g;
const WHITESPACE_RUN = /\s+/g;

interface GeoShelfFetchSummary {
  read: number;
  blocked: number;
  failed: number;
}

function shelfPageBrands(seed: GeoShelfStoreSeed): GeoShelfPageBrand[] {
  return [
    {
      competitorId: null,
      name: seed.settings.companyName,
      domain: seed.ownDomain,
      aliases: seed.settings.aliases,
    },
    ...seed.competitors.map((competitor) => ({
      competitorId: competitor.id,
      name: competitor.name,
      domain: competitor.domain,
      aliases: competitor.synonyms,
    })),
  ];
}

function httpStatusOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return null;
  }
  const { status } = error as { status: unknown };
  return typeof status === "number" ? status : null;
}

function visibleTextLength(markdown: string): number {
  return markdown
    .replace(MARKDOWN_SYNTAX, " ")
    .replace(WHITESPACE_RUN, " ")
    .trim().length;
}

async function readShelfSource(
  candidate: GeoShelfFetchCandidate,
  brands: readonly GeoShelfPageBrand[]
): Promise<GeoShelfFetchOutcome> {
  try {
    const fetchUrl = shelfFetchUrl(candidate.url);
    await assertStablePublicShelfUrl(fetchUrl);
    const page = await fetchWebpage({
      url: fetchUrl,
      includeImages: false,
      includeLinks: true,
      onlyMainContent: true,
      maxAgeMs: GEO_SHELF_FETCH_CACHE_MS,
      timeoutMS: GEO_SHELF_FETCH_TIMEOUT_MS,
    });
    const finalUrl = page.metadata?.finalUrl ?? page.url ?? null;
    if (finalUrl) {
      await assertStablePublicShelfUrl(finalUrl);
    }
    const markdown = page.markdown ?? "";
    if (visibleTextLength(markdown) < GEO_SHELF_FETCH_MIN_TEXT_LENGTH) {
      return { status: "blocked" };
    }
    const title =
      page.metadata?.title?.trim().slice(0, GEO_SHELF_TITLE_MAX_LENGTH) || null;
    return {
      status: "ok",
      title,
      read: readShelfPage({
        url: candidate.url,
        title: candidate.title ?? title,
        markdown,
        currentKind: candidate.kind,
        brands,
      }),
    };
  } catch (error) {
    const status = httpStatusOf(error);
    const blocked =
      status !== null && GEO_SHELF_FETCH_UNREADABLE_STATUSES.includes(status);
    logWarn("[GEO] shelf page read failed", {
      url: candidate.url,
      status,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { status: blocked ? "blocked" : "failed" };
  }
}

async function forEachWithLimit<T>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      if (item !== undefined) {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- each worker reads one page at a time by design
        await run(item);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
}

/**
 * Reads the most cited third-party pages on the shelf and records which
 * tracked brands each one names. This is what fills the "Opportunities"
 * filter: pages AI engines cite that list competitors but not you.
 */
async function fetchGeoShelfPages(
  seed: GeoShelfStoreSeed,
  now: Date = new Date()
): Promise<GeoShelfFetchSummary> {
  const summary: GeoShelfFetchSummary = { read: 0, blocked: 0, failed: 0 };
  if (!isContextDevConfigured()) {
    return summary;
  }
  const key = storeKey(seed);
  const candidates = await listGeoShelfFetchCandidates(key, now);
  if (candidates.length === 0) {
    return summary;
  }
  const brands = shelfPageBrands(seed);
  await forEachWithLimit(
    candidates,
    GEO_SHELF_FETCH_CONCURRENCY,
    async (candidate) => {
      const outcome = await readShelfSource(candidate, brands);
      const checkedAt = new Date().toISOString();
      await writeGeoShelfFetchResult(key, candidate.id, (current) => {
        if (outcome.status !== "ok") {
          return {
            fetchStatus: outcome.status,
            lastFetchedAt: checkedAt,
            kind: current.kind,
            title: current.title,
            placements: current.placements,
          };
        }
        return {
          fetchStatus: "ok",
          lastFetchedAt: checkedAt,
          // A teammate's kind edit during the read beats the classifier.
          kind:
            current.kind === candidate.kind ? outcome.read.kind : current.kind,
          title: current.title ?? outcome.title,
          placements: mergeFetchedPlacements({
            existing: current.placements,
            brands,
            results: outcome.read.brands,
            checkedAt,
          }),
        };
      });
      summary[outcome.status === "ok" ? "read" : outcome.status] += 1;
    }
  );
  logInfo("[GEO] shelf pages read", { ...key, ...summary });
  return summary;
}

/** Entry point for the scan workflow, which only knows the project scope. */
export async function fetchGeoShelfPagesForScope(
  scope: GeoScopeInput
): Promise<GeoShelfFetchSummary> {
  const context = await Effect.runPromise(
    loadGeoShelfContext(scope).pipe(Effect.provide(geoCoreDashboardLayer))
  );
  if (!context.settings) {
    return { read: 0, blocked: 0, failed: 0 };
  }
  return await fetchGeoShelfPages({
    ...context,
    settings: context.settings,
    members: [],
  });
}
