import { logError } from "@notra/ai/utils/server-log";
import { getAnalyticsRedis } from "@notra/analytics/cache/redis";
import {
  isTinybirdConfigured,
  queryGeoTrafficTrendsDaily,
  queryGeoTrafficTrendsProjects,
} from "@notra/analytics/tinybird/client";
import { shiftDay } from "@notra/analytics/utils/demo-pipe";
import { geoHiddenSourceParams } from "@notra/geo-core/geo/hidden-sources";
import { todayIsoDate } from "@notra/geo-core/utils/day-label";
import { publicAiTrafficSnapshotSchema } from "@notra/schemas/api/public-ai-traffic";
import type { PublicAiTrafficSnapshot } from "@notra/schemas/types/api/public-ai-traffic";

import {
  PUBLIC_DATA_CACHE_KEY_PREFIX,
  PUBLIC_DATA_CACHE_TTL_SECONDS,
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
 * without Redis, don't repeat the 60-day queries.
 */
let latest: { day: string; snapshot: PublicAiTrafficSnapshot } | null = null;

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
  // Weeks reach back over the whole chart window, so every project with
  // traffic in it gets checked against the sample and demo filter.
  const projectRows =
    (
      await queryGeoTrafficTrendsProjects({
        date_from: window.from,
        date_to: window.toExclusive,
        baseline_from: window.from,
        recent_from: window.recentFrom,
        ...hidden,
      })
    )?.data ?? [];
  const projectIds = [...new Set(projectRows.map((row) => row.project_id))];
  const real = await realTrafficProjectIds(projectIds);
  const excluded = projectIds.filter((id) => !real.has(id));
  const daily =
    (
      await queryGeoTrafficTrendsDaily({
        date_from: window.from,
        date_to: window.toExclusive,
        excluded_project_ids: excluded.join(","),
        site_cap_factor: PUBLIC_DATA_SITE_CAP_FACTOR,
        ...hidden,
      })
    )?.data ?? [];

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
    latest = { day: today, snapshot };
    await writeCached(snapshot, today);
  }
  return snapshot;
}

/** Today's snapshot from the cache, or built now and cached. */
async function todaysSnapshot(
  today: string
): Promise<PublicAiTrafficSnapshot | null> {
  if (latest?.day === today) {
    return latest.snapshot;
  }
  const cached = await readCached(today);
  if (cached) {
    latest = { day: today, snapshot: cached };
    return cached;
  }
  return publishPublicAiTrafficSnapshot(today);
}

/**
 * Today's published snapshot. The daily cron publishes it shortly after
 * midnight UTC; a request before that builds it once and caches it. When
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
