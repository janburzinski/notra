import { redis } from "@notra/ai/utils/redis";

import {
  GEO_INGEST_RATELIMIT_TIMEOUT_MS,
  WEB_AI_DAILY_CAP,
  WEB_AI_DAILY_KEY_PREFIX,
  WEB_AI_RATELIMIT_MAX_REQUESTS,
  WEB_AI_RATELIMIT_PREFIX,
  WEB_DAILY_COUNTER_TTL_SECONDS,
  WEB_INGEST_RATELIMIT_MAX_REQUESTS,
  WEB_INGEST_RATELIMIT_PREFIX,
  WEB_LOCAL_LIMITER_MAX_KEYS,
  WEB_NETWORK_RATELIMIT_MAX_REQUESTS,
  WEB_NETWORK_RATELIMIT_PREFIX,
  WEB_RATELIMIT_WINDOW_MS,
  WEB_SHARED_NETWORK_KEY,
  WEB_SHARED_NETWORK_RATELIMIT_MAX_REQUESTS,
  WEB_SHARED_NETWORK_RATELIMIT_PREFIX,
} from "../constants/ingest";
import type { GeoIngestIdentity } from "../types/geo";
import type {
  LocalRateLimit,
  WebBeaconAdmission,
  WebBudget,
} from "../types/ingest";
import { geoIngestScopeKey } from "../utils/geo-ingest-identity-policy";
import { createLocalRateLimit } from "../utils/local-rate-limit";
import { webLimitScript } from "./ratelimit";

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
// Budgets Redis refused, until their window ends, as @upstash/ratelimit's
// ephemeral cache keeps them: a spent budget costs no round trip.
const refusedUntil = new Map<string, number>();

function budget(
  prefix: string,
  requests: number,
  fallback: LocalRateLimit,
  identifier: string
): WebBudget {
  return { key: `${prefix}:${identifier}`, identifier, requests, fallback };
}

function projectBudget(admissionKey: string): WebBudget {
  return budget(
    WEB_INGEST_RATELIMIT_PREFIX,
    WEB_INGEST_RATELIMIT_MAX_REQUESTS,
    localProject,
    admissionKey
  );
}

/** Without a trusted client IP every visitor counts against one bucket. */
function networkBudget(
  identity: GeoIngestIdentity,
  network: string | null
): WebBudget {
  const identifier = JSON.stringify([
    identity.organizationId,
    identity.projectId,
    network ?? WEB_SHARED_NETWORK_KEY,
  ]);
  return network
    ? budget(
        WEB_NETWORK_RATELIMIT_PREFIX,
        WEB_NETWORK_RATELIMIT_MAX_REQUESTS,
        localNetwork,
        identifier
      )
    : budget(
        WEB_SHARED_NETWORK_RATELIMIT_PREFIX,
        WEB_SHARED_NETWORK_RATELIMIT_MAX_REQUESTS,
        localSharedNetwork,
        identifier
      );
}

function isRefused(key: string, now: number): boolean {
  const until = refusedUntil.get(key);
  if (until === undefined) {
    return false;
  }
  if (until < now) {
    refusedUntil.delete(key);
    return false;
  }
  return true;
}

function refuseUntilNextWindow(key: string, window: number): void {
  if (refusedUntil.size >= WEB_LOCAL_LIMITER_MAX_KEYS) {
    const oldest = refusedUntil.keys().next().value;
    if (oldest !== undefined) {
      refusedUntil.delete(oldest);
    }
  }
  refusedUntil.set(key, (window + 1) * WEB_RATELIMIT_WINDOW_MS);
}

/**
 * Runs the limit script on `budgets` (and `counter`) at `now`: how many
 * budgets admitted, and the counter's value. Null when Redis fails or is
 * slower than the limiter timeout.
 */
async function runLimitScript(
  budgets: readonly WebBudget[],
  now: number,
  counter?: string
): Promise<{ admitted: number; count: number } | null> {
  const window = Math.floor(now / WEB_RATELIMIT_WINDOW_MS);
  const keys = budgets.flatMap((item) => [
    `${item.key}:${window}`,
    `${item.key}:${window - 1}`,
  ]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      webLimitScript.exec(
        counter === undefined ? keys : [...keys, counter],
        [
          now,
          WEB_RATELIMIT_WINDOW_MS,
          WEB_DAILY_COUNTER_TTL_SECONDS,
          ...budgets.map((item) => item.requests),
        ].map(String)
      ),
      new Promise<null>((resolve) => {
        timer = setTimeout(resolve, GEO_INGEST_RATELIMIT_TIMEOUT_MS, null);
      }),
    ]);
    if (!result) {
      return null;
    }
    const [admitted, count] = result;
    const refused = budgets[admitted];
    if (refused) {
      refuseUntilNextWindow(refused.key, window);
    }
    return { admitted, count };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Spends `budgets` in order and returns how many admitted the request; the
 * first refusal ends the check, so later budgets are not spent. When Redis
 * cannot answer, each budget's own bucket in this process decides: an outage
 * must not lift the limits, and must not drop every beacon either.
 */
async function admitBudgets(budgets: readonly WebBudget[]): Promise<number> {
  const now = Date.now();
  const blocked = budgets.findIndex((item) => isRefused(item.key, now));
  const checked = blocked === -1 ? budgets : budgets.slice(0, blocked);
  if (checked.length === 0) {
    return 0;
  }
  const result = await runLimitScript(checked, now);
  if (result) {
    return result.admitted;
  }
  let admitted = 0;
  for (const item of checked) {
    if (!item.fallback(item.identifier)) {
      break;
    }
    admitted += 1;
  }
  return admitted;
}

/** The project's beacon budget, shared by every browser that sends it. */
export async function admitWebProject(admissionKey: string): Promise<boolean> {
  return (await admitBudgets([projectBudget(admissionKey)])) === 1;
}

/**
 * A notra.js beacon's budgets. One network's share of a project's beacons is
 * checked first, so a copied key sent from one place cannot spend the project
 * budget; when the beacon reaches the project budget with its network's
 * unchecked, both are checked in one round trip.
 */
export function createWebBeaconAdmission(
  identity: GeoIngestIdentity,
  network: string | null
): WebBeaconAdmission {
  const networkLimit = networkBudget(identity, network);
  let networkAdmitted: Promise<boolean> | undefined;
  return {
    network: () => {
      networkAdmitted ??= admitBudgets([networkLimit]).then(
        (admitted) => admitted === 1
      );
      return networkAdmitted;
    },
    project: async (admissionKey) => {
      if (networkAdmitted) {
        if (!(await networkAdmitted)) {
          return "network_rate_limited";
        }
        return (await admitWebProject(admissionKey))
          ? null
          : "web_rate_limited";
      }
      const admitted = admitBudgets([
        networkLimit,
        projectBudget(admissionKey),
      ]);
      networkAdmitted = admitted.then((count) => count > 0);
      const count = await admitted;
      if (count === 0) {
        return "network_rate_limited";
      }
      return count === 1 ? "web_rate_limited" : null;
    },
  };
}

function countLocally(key: string): number {
  if (localDailyCounts.size >= WEB_LOCAL_LIMITER_MAX_KEYS) {
    localDailyCounts.clear();
  }
  const count = (localDailyCounts.get(key) ?? 0) + 1;
  localDailyCounts.set(key, count);
  return count;
}

/**
 * Whether a browser-reported AI referral may become an AI traffic event. It
 * has its own per-minute budget, never the server SDK's, and a daily cap per
 * project, checked and counted in one round trip; anything over is not
 * recorded, so it is never billed either. A failed check records nothing:
 * the page view is already stored. Without Redis (local development) both
 * are counted in this process.
 */
export async function admitWebAiEvent(
  identity: GeoIngestIdentity,
  day: string
): Promise<boolean> {
  const scope = geoIngestScopeKey(identity);
  const minute = budget(
    WEB_AI_RATELIMIT_PREFIX,
    WEB_AI_RATELIMIT_MAX_REQUESTS,
    localAi,
    JSON.stringify([scope, "web"])
  );
  const dailyKey = `${WEB_AI_DAILY_KEY_PREFIX}:${scope}:${day}`;
  const now = Date.now();
  if (isRefused(minute.key, now)) {
    return false;
  }
  const result = await runLimitScript([minute], now, dailyKey);
  if (!result) {
    return (
      !redis &&
      localAi(minute.identifier) &&
      countLocally(dailyKey) <= WEB_AI_DAILY_CAP
    );
  }
  return result.admitted === 1 && result.count <= WEB_AI_DAILY_CAP;
}
