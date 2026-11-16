import { redis } from "@notra/ai/utils/redis";

import {
  GEO_REJECTED_HOSTS_CACHE_PREFIX,
  GEO_REJECTED_HOSTS_DISMISSED_CACHE_PREFIX,
  GEO_REJECTED_HOSTS_DISMISSED_TTL_SECONDS,
  GEO_REJECTED_HOSTS_MAX,
  GEO_REJECTED_HOSTS_RECORD_INTERVAL_MS,
  GEO_REJECTED_HOSTS_RECORD_MEMORY_MAX_ENTRIES,
  GEO_REJECTED_HOSTS_TTL_SECONDS,
} from "../constants/geo";
import type { GeoIngestIdentity } from "../types/geo";
import { normalizeProjectDomain } from "../utils/geo-project-domains";

const lastRecordedAt = new Map<string, number>();

function scopeKey(organizationId: string, projectId: string): string {
  return `${organizationId}:${projectId}`;
}

/** Hosts by when they were last seen, so the stalest fall off first. */
function seenKey(organizationId: string, projectId: string): string {
  return `${GEO_REJECTED_HOSTS_CACHE_PREFIX}:${scopeKey(organizationId, projectId)}`;
}

/** Hit counts by host, holding a field only for hosts still in `seen`. */
function hitsKey(organizationId: string, projectId: string): string {
  return `${seenKey(organizationId, projectId)}:hits`;
}

/** Dismissed hosts scored by when each dismissal ends. */
function dismissedKey(organizationId: string, projectId: string): string {
  return `${GEO_REJECTED_HOSTS_DISMISSED_CACHE_PREFIX}:${scopeKey(organizationId, projectId)}`;
}

/**
 * Remembers a host whose traffic ingest dropped because it is not a tracked
 * domain, so the dashboard can offer to add it. Only project tokens count:
 * Notra Sites have a fixed host list and legacy organization tokens have no
 * project to suggest the domain for. Each replica writes a host at most once
 * per interval, so a host's count is minutes with traffic, not requests.
 */
export async function recordRejectedIngestHost(
  identity: GeoIngestIdentity,
  hostname: string
): Promise<void> {
  const client = redis;
  const host = normalizeProjectDomain(hostname);
  if (!(client && host && identity.projectId) || identity.site) {
    return;
  }
  const { organizationId, projectId } = identity;
  const seen = seenKey(organizationId, projectId);
  const memoryKey = `${seen}:${host}`;
  const now = Date.now();
  const previous = lastRecordedAt.get(memoryKey);
  if (
    previous !== undefined &&
    now - previous < GEO_REJECTED_HOSTS_RECORD_INTERVAL_MS
  ) {
    return;
  }
  if (lastRecordedAt.size >= GEO_REJECTED_HOSTS_RECORD_MEMORY_MAX_ENTRIES) {
    lastRecordedAt.clear();
  }
  lastRecordedAt.set(memoryKey, now);

  const hits = hitsKey(organizationId, projectId);
  const write = client.pipeline();
  write.hincrby(hits, host, 1);
  write.zadd(seen, { score: now, member: host });
  write.expire(hits, GEO_REJECTED_HOSTS_TTL_SECONDS);
  write.expire(seen, GEO_REJECTED_HOSTS_TTL_SECONDS);
  write.zrange(seen, 0, now - GEO_REJECTED_HOSTS_TTL_SECONDS * 1000, {
    byScore: true,
  });
  write.zrange(seen, 0, -(GEO_REJECTED_HOSTS_MAX + 1));
  const written = await write.exec().catch(() => null);
  // Hosts that went quiet past the TTL, or fell out of the newest `MAX`,
  // leave both structures so storage stays bounded per project.
  const stale = new Set(
    [written?.[4], written?.[5]].flatMap((members) =>
      Array.isArray(members) ? members.map(String) : []
    )
  );
  if (stale.size === 0) {
    return;
  }
  const trim = client.pipeline();
  trim.zrem(seen, ...stale);
  trim.hdel(hits, ...stale);
  await trim.exec().catch(() => null);
}

/**
 * Hosts seen within the TTL with at least `minHits`, most hits first, minus
 * those still dismissed.
 */
export async function readRejectedIngestHosts(
  organizationId: string,
  projectId: string,
  minHits: number
): Promise<string[]> {
  const client = redis;
  if (!client) {
    return [];
  }
  const now = Date.now();
  const [seen, dismissed] = await Promise.all([
    client.zrange<(string | number)[]>(
      seenKey(organizationId, projectId),
      now - GEO_REJECTED_HOSTS_TTL_SECONDS * 1000,
      "+inf",
      { byScore: true }
    ),
    client.zrange<(string | number)[]>(
      dismissedKey(organizationId, projectId),
      now,
      "+inf",
      { byScore: true }
    ),
  ]);
  const hidden = new Set(dismissed.map(String));
  const hosts = seen.map(String).filter((host) => !hidden.has(host));
  if (hosts.length === 0) {
    return [];
  }
  const counts =
    (await client.hmget<Record<string, number | string | null>>(
      hitsKey(organizationId, projectId),
      ...hosts
    )) ?? {};
  return hosts
    .map((host) => ({ host, hits: Number(counts[host] ?? 0) }))
    .filter((entry) => entry.hits >= minHits)
    .toSorted((left, right) => right.hits - left.hits)
    .map((entry) => entry.host);
}

export async function forgetRejectedIngestHost(
  organizationId: string,
  projectId: string,
  host: string
): Promise<void> {
  const client = redis;
  if (!client) {
    return;
  }
  const pipeline = client.pipeline();
  pipeline.zrem(seenKey(organizationId, projectId), host);
  pipeline.hdel(hitsKey(organizationId, projectId), host);
  await pipeline.exec().catch(() => null);
}

export async function dismissRejectedIngestHost(
  organizationId: string,
  projectId: string,
  host: string
): Promise<void> {
  const client = redis;
  if (!client) {
    return;
  }
  const key = dismissedKey(organizationId, projectId);
  const now = Date.now();
  const pipeline = client.pipeline();
  pipeline.zremrangebyscore(key, 0, now);
  pipeline.zadd(key, {
    score: now + GEO_REJECTED_HOSTS_DISMISSED_TTL_SECONDS * 1000,
    member: host,
  });
  pipeline.expire(key, GEO_REJECTED_HOSTS_DISMISSED_TTL_SECONDS);
  await pipeline.exec();
}
