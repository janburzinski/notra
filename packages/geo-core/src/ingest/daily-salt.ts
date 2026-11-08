import { randomBytes } from "node:crypto";

import { geoLog } from "@notra/ai/evlog";
import { redis } from "@notra/ai/utils/redis";

import {
  WEB_DAILY_SALT_BYTES,
  WEB_DAILY_SALT_KEY_PREFIX,
  WEB_DAILY_SALT_SWEEP_MS,
  WEB_DAILY_SALT_TTL_SECONDS,
} from "../constants/ingest";
import { addDays, toDay } from "../utils/analytics-import-range";

const salts = new Map<string, Promise<string>>();
const localSalts = new Map<string, string>();
let sweeper: ReturnType<typeof setInterval> | undefined;

/**
 * Drops cached salts of days that ended more than a day ago, so memory keeps
 * no salt longer than Redis does (48 hours), even when no beacon arrives.
 */
export function forgetExpiredSalts(now = new Date(), keep?: string): void {
  const yesterday = addDays(toDay(now), -1);
  for (const cache of [salts, localSalts]) {
    for (const day of cache.keys()) {
      if (day < yesterday && day !== keep) {
        cache.delete(day);
      }
    }
  }
}

function startSweeper(): void {
  if (!sweeper) {
    sweeper = setInterval(() => forgetExpiredSalts(), WEB_DAILY_SALT_SWEEP_MS);
    // The sweep must never keep a process alive on its own.
    sweeper.unref?.();
  }
}

function randomSalt(prefix: string): string {
  return `${prefix}${randomBytes(WEB_DAILY_SALT_BYTES).toString("hex")}`;
}

/**
 * A random salt held only in this process's memory, for when Redis cannot
 * share one. Replicas then split a visitor, but the salt is never derived
 * from a secret and `forgetExpiredSalts` drops it once its day is over a day old.
 */
function localSalt(day: string, reason: unknown): string {
  const existing = localSalts.get(day);
  if (existing) {
    return existing;
  }
  const salt = randomSalt("l_");
  localSalts.set(day, salt);
  geoLog.error({
    event: "geo.ingest.salt_fallback",
    message: "Redis has no daily salt; using a random in-memory salt",
    day,
    reason: reason instanceof Error ? reason.message : "redis_unavailable",
  });
  return salt;
}

async function fetchSalt(day: string): Promise<string> {
  const client = redis;
  if (!client) {
    return localSalt(day, undefined);
  }
  const key = `${WEB_DAILY_SALT_KEY_PREFIX}:${day}`;
  try {
    // Prefixed so the Upstash client never JSON-parses it into a number.
    await client.set(key, randomSalt("s_"), {
      nx: true,
      ex: WEB_DAILY_SALT_TTL_SECONDS,
    });
    const salt = await client.get<string>(key);
    if (typeof salt === "string" && salt.length > 0) {
      return salt;
    }
    return localSalt(day, undefined);
  } catch (error) {
    return localSalt(day, error);
  }
}

/**
 * A random salt per UTC day, shared through Redis and deleted after 48 hours,
 * so a visitor id can only ever be linked to an IP and user agent on the day
 * it was made. The in-memory fallback is not cached here, so the shared salt
 * takes over as soon as Redis answers again.
 */
export function dailySalt(day: string): Promise<string> {
  forgetExpiredSalts(new Date(), day);
  startSweeper();
  const cached = salts.get(day);
  if (cached) {
    return cached;
  }
  const pending = fetchSalt(day).then((salt) => {
    if (!salt.startsWith("s_")) {
      salts.delete(day);
    }
    return salt;
  });
  salts.set(day, pending);
  return pending;
}
