import { logError } from "@notra/ai/utils/server-log";
import { getAnalyticsRedis } from "@notra/analytics/cache/redis";
import {
  isTinybirdConfigured,
  queryGeoTrafficTrendsDaily,
  queryGeoTrafficTrendsDetail,
  queryGeoTrafficTrendsProjects,
  queryGeoTrafficTrendsRolling,
} from "@notra/analytics/tinybird/client";
import { shiftDay } from "@notra/analytics/utils/demo-pipe";
import { geoHiddenSourceParams } from "@notra/geo-core/geo/hidden-sources";
import { todayIsoDate } from "@notra/geo-core/utils/day-label";
import { publicAiTrafficSnapshotSchema } from "@notra/schemas/api/public-ai-traffic";
import type { PublicAiTrafficSnapshot } from "@notra/schemas/types/api/public-ai-traffic";

import {
  PUBLIC_DATA_CACHE_KEY_PREFIX,
  PUBLIC_DATA_CACHE_TTL_SECONDS,
  PUBLIC_DATA_DETAIL_DAYS,
  PUBLIC_DATA_MEMORY_TTL_MS,
  PUBLIC_DATA_ROLLING_DAYS,
  PUBLIC_DATA_INGEST_GAP,
  PUBLIC_DATA_SITE_CAP_FACTOR,
} from "@/constants/public-data";
import { realTrafficProjectIds } from "@/lib/analytics/real-traffic-projects";
import {
  buildPublicAiTrafficSnapshot,
  publicAiTrafficWindow,
} from "@/utils/public-ai-traffic";

/** One build per day per instance, shared by concurrent first requests. */
const pending = new Map<string, Promise<PublicAiTrafficSnapshot | null>>();
/**
 * The day's snapshot once built or read, so later requests skip Redis and,
 * without Redis, don't repeat the 60-day queries. With Redis it is re-read
 * after `PUBLIC_DATA_MEMORY_TTL_MS`, so a rebuild on another instance shows.
 */
let latest: {
  day: string;
  snapshot: PublicAiTrafficSnapshot;
  readAt: number;
} | null = null;

function cacheKey(today: string): string {
  return `${PUBLIC_DATA_CACHE_KEY_PREFIX}:${today}`;
}

async function computeSnapshot(
  today: string
): Promise<PublicAiTrafficSnapshot | null> {
  if (!isTinybirdConfigured()) {
    return null;
  }
  const window = publicAiTrafficWindow(today);
  const hidden = geoHiddenSourceParams();
  // The first chart day's week starts six days before the window.
  const readFrom = shiftDay(window.from, 1 - PUBLIC_DATA_ROLLING_DAYS);
  // Weeks reach back over the whole chart window, so every project with
  // traffic in it gets checked against the sample and demo filter.
  const projectRows =
    (
      await queryGeoTrafficTrendsProjects({
        date_from: readFrom,
        date_to: window.toExclusive,
        baseline_from: readFrom,
        recent_from: window.recentFrom,
        ...hidden,
      })
    )?.data ?? [];
  const projectIds = [...new Set(projectRows.map((row) => row.project_id))];
  const real = await realTrafficProjectIds(projectIds);
  const excluded = projectIds.filter((id) => !real.has(id));
  const [dailyResult, rollingResult, detailResult] = await Promise.all([
    queryGeoTrafficTrendsDaily({
      date_from: window.from,
      date_to: window.toExclusive,
      excluded_project_ids: excluded.join(","),
      site_cap_factor: PUBLIC_DATA_SITE_CAP_FACTOR,
      ...hidden,
    }),
    queryGeoTrafficTrendsRolling({
      date_from: window.from,
      date_to: window.toExclusive,
      window_days: PUBLIC_DATA_ROLLING_DAYS,
      excluded_project_ids: excluded.join(","),
      skip_from: PUBLIC_DATA_INGEST_GAP.from,
      skip_to: PUBLIC_DATA_INGEST_GAP.to,
      ...hidden,
    }),
    queryGeoTrafficTrendsDetail({
      date_from: shiftDay(today, -PUBLIC_DATA_DETAIL_DAYS),
      date_to: window.toExclusive,
      previous_from: shiftDay(today, -PUBLIC_DATA_DETAIL_DAYS * 2),
      excluded_project_ids: excluded.join(","),
      ...hidden,
    }),
  ]);
  const daily = dailyResult?.data ?? [];

  return buildPublicAiTrafficSnapshot({
    today,
    generatedAt: new Date().toISOString(),
    daily: daily.map((row) => ({
      day: String(row.day),
      visitor_type: row.visitor_type,
      source: row.source,
      category: row.category,
      visits: Number(row.visits),
      markdown_visits: Number(row.markdown_visits),
      projects: Number(row.projects),
    })),
    rolling: (rollingResult?.data ?? []).map((row) => ({
      day: String(row.day),
      visitor_type: row.visitor_type,
      source: row.source,
      category: row.category,
      visits: Number(row.visits),
      markdown_visits: Number(row.markdown_visits),
      projects: Number(row.projects),
      site_days: Number(row.site_days),
    })),
    projects: projectRows
      .filter((row) => real.has(row.project_id))
      .map((row) => ({
        project_id: row.project_id,
        visitor_type: row.visitor_type,
        source: row.source,
        weeks_ago: Number(row.weeks_ago),
        visits: Number(row.visits),
        markdown_visits: Number(row.markdown_visits),
      })),
    detail: (detailResult?.data ?? []).map((row) => ({
      section: row.section,
      visitor_type: row.visitor_type,
      key: row.key,
      share: Number(row.share),
      previous_share: Number(row.previous_share),
      sites: Number(row.sites),
      previous_sites: Number(row.previous_sites),
      subset_sites: Number(row.subset_sites),
    })),
  });
}

async function readCached(
  today: string
): Promise<PublicAiTrafficSnapshot | null> {
  const redis = getAnalyticsRedis();
  if (!redis) {
    return null;
  }
  try {
    const parsed = publicAiTrafficSnapshotSchema.safeParse(
      await redis.get(cacheKey(today))
    );
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logError("Public AI traffic cache read failed", error);
    return null;
  }
}

async function writeCached(snapshot: PublicAiTrafficSnapshot, today: string) {
  const redis = getAnalyticsRedis();
  if (!redis) {
    return;
  }
  try {
    await redis.set(cacheKey(today), snapshot, {
      ex: PUBLIC_DATA_CACHE_TTL_SECONDS,
    });
  } catch (error) {
    logError("Public AI traffic cache write failed", error);
  }
}

/** Builds today's snapshot and stores it, replacing any cached one. */
export async function publishPublicAiTrafficSnapshot(
  today = todayIsoDate()
): Promise<PublicAiTrafficSnapshot | null> {
  const snapshot = await computeSnapshot(today);
  if (snapshot) {
    latest = { day: today, snapshot, readAt: Date.now() };
    await writeCached(snapshot, today);
  }
  return snapshot;
}

/** Today's snapshot from the cache, or built now and cached. */
async function todaysSnapshot(
  today: string
): Promise<PublicAiTrafficSnapshot | null> {
  const remembered = latest?.day === today ? latest : null;
  if (
    remembered &&
    (Date.now() - remembered.readAt < PUBLIC_DATA_MEMORY_TTL_MS ||
      !getAnalyticsRedis())
  ) {
    return remembered.snapshot;
  }
  const cached = await readCached(today);
  if (cached) {
    latest = { day: today, snapshot: cached, readAt: Date.now() };
    return cached;
  }
  // A Redis miss or failure keeps today's remembered snapshot rather than
  // rebuilding it on a public request.
  if (remembered) {
    return remembered.snapshot;
  }
  // Before the cron publishes today's, yesterday's stands in: a public
  // request then never runs the cross-customer queries or builds from a day
  // whose last ingest batch hasn't landed yet. Only an empty cache builds.
  const previous = await readCached(shiftDay(today, -1));
  if (previous) {
    latest = { day: today, snapshot: previous, readAt: Date.now() };
    return previous;
  }
  return publishPublicAiTrafficSnapshot(today);
}

/**
 * Today's published snapshot. The daily cron publishes it shortly after
 * midnight UTC; until then yesterday's is served. When
 * today's can't be built, yesterday's (kept for two days) stands in, so a
 * Tinybird outage doesn't blank the public page.
 */
export function getPublicAiTrafficSnapshot(): Promise<PublicAiTrafficSnapshot | null> {
  const today = todayIsoDate();
  const inflight = pending.get(today);
  if (inflight) {
    return inflight;
  }
  const promise = (async () => {
    try {
      const snapshot = await todaysSnapshot(today);
      if (snapshot) {
        return snapshot;
      }
    } catch (error) {
      const fallback = await readCached(shiftDay(today, -1));
      if (!fallback) {
        throw error;
      }
      logError("Public AI traffic build failed, serving yesterday's", error);
      return fallback;
    }
    return readCached(shiftDay(today, -1));
  })().finally(() => {
    pending.delete(today);
  });
  pending.set(today, promise);
  return promise;
}
