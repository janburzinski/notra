import { SITE_R2_KEYS } from "@notra/sites-core/constants/sites";
import {
  siteHostRecordSchema,
  siteManifestSchema,
  siteServingStateSchema,
} from "@notra/sites-core/schemas/deployment";
import type {
  SiteHostRecord,
  SiteServingState,
} from "@notra/sites-core/types/deployment";

import {
  HOST_TTL_MS,
  LOOKUP_CACHE_LIMIT,
  MANIFEST_CACHE_LIMIT,
  R2_READ_TIMEOUT_MS,
  SLOW_R2_READ_MS,
  STATE_TTL_MS,
} from "./constants/cache";
import type {
  LoadedManifest,
  ServerTimingName,
  TimedCacheEntry,
} from "./types/serving";
import type { SitesDeps } from "./types/worker";
import { StateUnavailableError } from "./utils/errors";

// Values are shared across requests, but in-flight reads are not: the Workers
// runtime ties a promise to the request that created it, so a read started by a
// request that was cancelled (a visitor closing the tab) never settles. Shared,
// it would hang every later request for that site in the isolate.
const hostCache = new Map<string, TimedCacheEntry<SiteHostRecord | null>>();
const stateCache = new Map<string, TimedCacheEntry<SiteServingState | null>>();
const manifestCache = new Map<string, LoadedManifest>();
// Bumped by resets, so a read that finishes afterwards cannot repopulate a cache.
let generation = 0;
// Orders reads, so a slow read that started earlier cannot replace a newer value.
let reads = 0;

export function resetCachesForTests() {
  hostCache.clear();
  stateCache.clear();
  manifestCache.clear();
  generation += 1;
}

async function readJson(
  deps: SitesDeps,
  key: string,
  timing: ServerTimingName
): Promise<unknown> {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutMs = deps.r2ReadTimeoutMs ?? R2_READ_TIMEOUT_MS;
  try {
    // The body is read inside the race too: R2 can return an object whose body stalls.
    return await Promise.race([
      (async () => {
        const object = await deps.bucket.get(key);
        return object ? JSON.parse(await object.text()) : null;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new StateUnavailableError(
                `R2 read for ${key} took longer than ${timeoutMs} ms`
              )
            ),
          timeoutMs
        );
      }),
    ]);
  } catch (error) {
    if (
      error instanceof StateUnavailableError ||
      error instanceof SyntaxError
    ) {
      throw error;
    }
    throw new StateUnavailableError(
      `R2 read failed for ${key}: ${String(error)}`
    );
  } finally {
    clearTimeout(timer);
    const durationMs = performance.now() - started;
    deps.timing?.record(timing, durationMs, "r2");
    if (durationMs >= SLOW_R2_READ_MS) {
      console.warn("sites.slow_r2_read", { key, durationMs });
    }
  }
}

function remember<K, V>(cache: Map<K, V>, limit: number, key: K, value: V) {
  if (!cache.has(key) && cache.size >= limit) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(key, value);
}

async function loadWithTtl<T>(
  deps: SitesDeps,
  cache: Map<string, TimedCacheEntry<T>>,
  key: string,
  ttlMs: number,
  timing: ServerTimingName,
  load: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  if (cached && deps.now().getTime() - cached.at < ttlMs) {
    deps.timing?.record(timing, 0, "cache");
    return cached.value;
  }
  const loadedIn = generation;
  reads += 1;
  const read = reads;
  // Freshness counts from when the read started, so a slow read cannot extend it.
  const startedAt = deps.now().getTime();
  const value = await load();
  const current = cache.get(key);
  if (loadedIn === generation && (!current || current.read < read)) {
    remember(cache, LOOKUP_CACHE_LIMIT, key, { value, at: startedAt, read });
  }
  return value;
}

export function loadHost(
  deps: SitesDeps,
  hostname: string
): Promise<SiteHostRecord | null> {
  return loadWithTtl(
    deps,
    hostCache,
    hostname,
    HOST_TTL_MS,
    "host",
    async () => {
      const raw = await readJson(deps, SITE_R2_KEYS.host(hostname), "host");
      const parsed = raw ? siteHostRecordSchema.safeParse(raw) : null;
      return parsed?.success ? parsed.data : null;
    }
  );
}

export function loadState(
  deps: SitesDeps,
  siteId: string
): Promise<SiteServingState | null> {
  return loadWithTtl(
    deps,
    stateCache,
    siteId,
    STATE_TTL_MS,
    "state",
    async () => {
      const raw = await readJson(deps, SITE_R2_KEYS.state(siteId), "state");
      if (raw === null) {
        return null;
      }
      const parsed = siteServingStateSchema.safeParse(raw);
      if (!parsed.success) {
        throw new StateUnavailableError(`Invalid serving state for ${siteId}`);
      }
      return parsed.data;
    }
  );
}

export async function loadManifest(
  deps: SitesDeps,
  siteId: string,
  deploymentId: string
): Promise<LoadedManifest | null> {
  const cacheKey = `${siteId}/${deploymentId}`;
  const cached = manifestCache.get(cacheKey);
  if (cached) {
    deps.timing?.record("manifest", 0, "cache");
    return cached;
  }
  const loadedIn = generation;
  const raw = await readJson(
    deps,
    SITE_R2_KEYS.manifest(siteId, deploymentId),
    "manifest"
  );
  if (!raw) {
    return null;
  }
  const parsed = siteManifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new StateUnavailableError(`Invalid manifest for ${cacheKey}`);
  }
  const manifest = parsed.data;
  if (manifest.siteId !== siteId || manifest.deploymentId !== deploymentId) {
    throw new StateUnavailableError(
      `Manifest ${cacheKey} does not match its location`
    );
  }
  const loaded = {
    manifest,
    files: new Map(manifest.files.map((file) => [file.path, file])),
  };
  if (loadedIn === generation) {
    remember(manifestCache, MANIFEST_CACHE_LIMIT, cacheKey, loaded);
  }
  return loaded;
}
