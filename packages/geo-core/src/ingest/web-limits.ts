import { redis } from "@notra/ai/utils/redis";
import type { Limiter } from "@notra/utils/types/ratelimit";

import {
  WEB_AI_DAILY_CAP,
  WEB_AI_DAILY_KEY_PREFIX,
  WEB_AI_RATELIMIT_MAX_REQUESTS,
  WEB_DAILY_COUNTER_TTL_SECONDS,
  WEB_INGEST_RATELIMIT_MAX_REQUESTS,
  WEB_LOCAL_LIMITER_MAX_KEYS,
  WEB_NETWORK_RATELIMIT_MAX_REQUESTS,
  WEB_RATELIMIT_WINDOW_MS,
  WEB_SHARED_NETWORK_KEY,
  WEB_SHARED_NETWORK_RATELIMIT_MAX_REQUESTS,
} from "../constants/ingest";
import type { GeoIngestIdentity } from "../types/geo";
import type { LocalRateLimit } from "../types/ingest";
import { geoIngestScopeKey } from "../utils/geo-ingest-identity-policy";
import { createLocalRateLimit } from "../utils/local-rate-limit";
import {
  webAiRatelimit,
  webIngestRatelimit,
  webNetworkRatelimit,
  webSharedNetworkRatelimit,
} from "./ratelimit";

const local = (requests: number) =>
  createLocalRateLimit(
    requests,
    WEB_RATELIMIT_WINDOW_MS,
    WEB_LOCAL_LIMITER_MAX_KEYS
  );
const localProject = local(WEB_INGEST_RATELIMIT_MAX_REQUESTS);
const localNetwork = local(WEB_NETWORK_RATELIMIT_MAX_REQUESTS);
const localSharedNetwork = local(WEB_SHARED_NETWORK_RATELIMIT_MAX_REQUESTS);
const localAi = local(WEB_AI_RATELIMIT_MAX_REQUESTS);
const localDailyCounts = new Map<string, number>();

/**
 * The shared limiter's answer, or this process's own bucket when it times
 * out or fails: an outage must not lift the limit, and must not drop every
 * beacon either.
 */
async function admit(
  limiter: Limiter,
  fallback: LocalRateLimit,
  key: string
): Promise<boolean> {
  try {
    const result = await limiter.limit(key);
    return result.reason === "timeout" ? fallback(key) : result.success;
  } catch {
    return fallback(key);
  }
}

/** The project's beacon budget, shared by every browser that sends it. */
export function admitWebProject(admissionKey: string): Promise<boolean> {
  return admit(webIngestRatelimit, localProject, admissionKey);
}

/**
 * One network's share of a project's beacons, checked first so a copied key
 * sent from one place cannot spend the project budget. Without a trusted
 * client IP every visitor counts against one shared bucket.
 */
export function admitWebNetwork(
  identity: GeoIngestIdentity,
  network: string | null
): Promise<boolean> {
  const key = JSON.stringify([
    identity.organizationId,
    identity.projectId,
    network ?? WEB_SHARED_NETWORK_KEY,
  ]);
  return network
    ? admit(webNetworkRatelimit, localNetwork, key)
    : admit(webSharedNetworkRatelimit, localSharedNetwork, key);
}

async function countToday(key: string): Promise<number | null> {
  const client = redis;
  if (!client) {
    if (localDailyCounts.size >= WEB_LOCAL_LIMITER_MAX_KEYS) {
      localDailyCounts.clear();
    }
    const count = (localDailyCounts.get(key) ?? 0) + 1;
    localDailyCounts.set(key, count);
    return count;
  }
  try {
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, WEB_DAILY_COUNTER_TTL_SECONDS);
    }
    return count;
  } catch {
    return null;
  }
}

/**
 * Whether a browser-reported AI referral may become an AI traffic event. It
 * has its own per-minute budget, never the server SDK's, and a daily cap per
 * project; anything over is not recorded, so it is never billed either. A
 * failed check records nothing: the page view is already stored.
 */
export async function admitWebAiEvent(
  identity: GeoIngestIdentity,
  day: string
): Promise<boolean> {
  const scope = geoIngestScopeKey(identity);
  if (!(await admit(webAiRatelimit, localAi, JSON.stringify([scope, "web"])))) {
    return false;
  }
  const count = await countToday(`${WEB_AI_DAILY_KEY_PREFIX}:${scope}:${day}`);
  return count !== null && count <= WEB_AI_DAILY_CAP;
}
