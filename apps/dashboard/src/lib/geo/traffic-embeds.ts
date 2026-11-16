import { createHash } from "node:crypto";

import { logWarn } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { geoSettings, geoTrafficEmbeds, projects } from "@notra/db/schema";
import { advisoryXactLock } from "@notra/db/utils/advisory-xact-lock";
import { geoCheckGenerationKey } from "@notra/db/utils/geo-check-cache";
import { GEO_SELF_SERVE_ENGINE_IDS } from "@notra/geo-core/constants/geo-engine-policy";
import { geoDb } from "@notra/geo-core/geo/effect";
import {
  loadAiTraffic,
  loadGeoCompetitorShare,
  loadGeoCompetitors,
  loadGeoLanguageShare,
  loadGeoOverview,
  loadGeoSettings,
  loadGeoTimeseries,
} from "@notra/geo-core/geo/programs";
import { resolveGeoScope } from "@notra/geo-core/geo/projects";
import {
  loadWebAnalytics,
  loadWebCountries,
} from "@notra/geo-core/geo/web-analytics";
import type { GeoScopeInput, GeoWindowInput } from "@notra/geo-core/types/geo";
import { webHostFilter } from "@notra/geo-core/utils/geo-project-domains";
import { TRAFFIC_EMBED_CHARTS } from "@notra/schemas/constants/dashboard/traffic-embed";
import { Redis } from "@upstash/redis";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import {
  TRAFFIC_EMBED_CACHE_PREFIX,
  TRAFFIC_EMBED_CHART_SOURCES,
  TRAFFIC_EMBED_CHECK_SOURCES,
  TRAFFIC_EMBED_CONFIG_MISS,
  TRAFFIC_EMBED_CONFIG_TTL_SECONDS,
  TRAFFIC_EMBED_DATA_FRESH_SECONDS,
  TRAFFIC_EMBED_DATA_TTL_SECONDS,
  TRAFFIC_EMBED_ID_LENGTH,
  TRAFFIC_EMBED_MAX_PER_ORGANIZATION,
  TRAFFIC_EMBED_REDIS_READ_TIMEOUT_MS,
  TRAFFIC_EMBED_REDIS_WRITE_TIMEOUT_MS,
  TRAFFIC_EMBED_REFRESH_LOCK_SECONDS,
} from "@/constants/traffic-embed";
import { afterResponse } from "@/lib/framework/after-response";
import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import type { GeoDashboardRuntime } from "@/types/geo-runtime";
import type {
  PublicTrafficEmbed,
  TrafficEmbedCacheEntry,
  TrafficEmbedChart,
  TrafficEmbedConfig,
  TrafficEmbedRange,
  TrafficEmbedDataSource,
  TrafficEmbedSource,
  TrafficEmbedSourceData,
  TrafficEmbedSummary,
} from "@/types/traffic-embed";
import { withoutStoppedEngines } from "@/utils/geo-charts";
import { geoPresetRange } from "@/utils/geo-range";
import {
  isTrafficEmbedId,
  storedTrafficEmbedCharts,
  trafficEmbedCharts,
} from "@/utils/traffic-embed";
import { trafficEmbedShareOfVoiceRows } from "@/utils/traffic-embed-share-of-voice";

function createBoundedRedisClient(timeoutMs: number): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!(url && token)) {
    return null;
  }
  return new Redis({
    url,
    token,
    signal: () => AbortSignal.timeout(timeoutMs),
  });
}

const readRedis = createBoundedRedisClient(TRAFFIC_EMBED_REDIS_READ_TIMEOUT_MS);
const writeRedis = createBoundedRedisClient(
  TRAFFIC_EMBED_REDIS_WRITE_TIMEOUT_MS
);

/**
 * Loads in progress on this instance, so concurrent requests for a cold
 * embed share one query per source.
 */
const pendingLoads = new Map<string, Promise<unknown>>();

const configKey = (id: string) => `${TRAFFIC_EMBED_CACHE_PREFIX}:config:${id}`;
const dataKey = (
  id: string,
  source: TrafficEmbedDataSource,
  range: TrafficEmbedRange,
  to: string
) => `${TRAFFIC_EMBED_CACHE_PREFIX}:data:${id}:${source}:${range}:${to}`;
const refreshLockKey = (key: string) => `${key}:refresh`;

/** Best effort: a Redis outage or timeout falls back to the live lookup. */
async function readCache<T>(key: string): Promise<T | null> {
  if (!readRedis) {
    return null;
  }
  try {
    return await readRedis.get<T>(key);
  } catch (error) {
    logWarn("[geo] traffic embed cache read skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** One round trip for several keys; same fallback as `readCache`. */
async function readCaches(keys: readonly string[]): Promise<unknown[]> {
  const misses = keys.map(() => null);
  if (!readRedis) {
    return misses;
  }
  try {
    return await readRedis.mget<unknown[]>(...keys);
  } catch (error) {
    logWarn("[geo] traffic embed cache read skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
    return misses;
  }
}

async function writeCache(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  if (!writeRedis) {
    return;
  }
  try {
    await writeRedis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    logWarn("[geo] traffic embed cache write skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function dropConfigCache(id: string): Promise<void> {
  if (!writeRedis) {
    return;
  }
  try {
    await writeRedis.del(configKey(id));
  } catch (error) {
    logWarn("[geo] traffic embed cache drop skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const summaryColumns = {
  id: geoTrafficEmbeds.id,
  name: geoTrafficEmbeds.name,
  projectId: geoTrafficEmbeds.projectId,
  host: geoTrafficEmbeds.host,
  source: geoTrafficEmbeds.source,
  allowedOrigins: geoTrafficEmbeds.allowedOrigins,
  charts: geoTrafficEmbeds.charts,
  createdAt: geoTrafficEmbeds.createdAt,
};

function toSummary(row: {
  id: string;
  name: string;
  projectId: string | null;
  host: string | null;
  source: TrafficEmbedSource;
  allowedOrigins: string[];
  charts: string[];
  createdAt: Date;
}): TrafficEmbedSummary {
  return {
    ...row,
    charts: storedTrafficEmbedCharts(row.charts),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTrafficEmbeds(
  organizationId: string,
  projectId: string | null
): Promise<TrafficEmbedSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(geoTrafficEmbeds)
    .where(
      and(
        eq(geoTrafficEmbeds.organizationId, organizationId),
        projectId === null
          ? isNull(geoTrafficEmbeds.projectId)
          : eq(geoTrafficEmbeds.projectId, projectId),
        isNull(geoTrafficEmbeds.revokedAt)
      )
    )
    .orderBy(desc(geoTrafficEmbeds.createdAt));
  return rows.map(toSummary);
}

/** Null when the project isn't the organization's or the org is at its cap. */
export async function createTrafficEmbed(input: {
  organizationId: string;
  projectId: string | null;
  userId: string;
  name: string;
  host: string | null;
  source: TrafficEmbedSource;
  allowedOrigins: string[];
  charts: readonly TrafficEmbedChart[];
}): Promise<TrafficEmbedSummary | "limit" | null> {
  // The org lock serializes count + insert, so concurrent creates can't pass
  // the cap together.
  return db.transaction(async (tx) => {
    await advisoryXactLock(tx, `traffic-embed:${input.organizationId}`);
    const [project, [active]] = await Promise.all([
      input.projectId === null
        ? Promise.resolve(true)
        : tx
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(
                eq(projects.id, input.projectId),
                eq(projects.organizationId, input.organizationId)
              )
            )
            .limit(1)
            .then((rows) => rows.length > 0),
      tx
        .select({ value: count() })
        .from(geoTrafficEmbeds)
        .where(
          and(
            eq(geoTrafficEmbeds.organizationId, input.organizationId),
            isNull(geoTrafficEmbeds.revokedAt)
          )
        ),
    ]);
    if (!project) {
      return null;
    }
    if ((active?.value ?? 0) >= TRAFFIC_EMBED_MAX_PER_ORGANIZATION) {
      return "limit";
    }
    const [row] = await tx
      .insert(geoTrafficEmbeds)
      .values({
        id: nanoid(TRAFFIC_EMBED_ID_LENGTH),
        organizationId: input.organizationId,
        projectId: input.projectId,
        createdByUserId: input.userId,
        name: input.name,
        host: input.host,
        source: input.source,
        allowedOrigins: input.allowedOrigins,
        charts: storedTrafficEmbedCharts(input.charts),
      })
      .returning(summaryColumns);
    return row ? toSummary(row) : null;
  });
}

export async function updateTrafficEmbed(input: {
  organizationId: string;
  embedId: string;
  name: string;
  allowedOrigins: string[];
  /** Omitted keeps the stored charts. */
  charts?: readonly TrafficEmbedChart[];
}): Promise<TrafficEmbedSummary | null> {
  const [row] = await db
    .update(geoTrafficEmbeds)
    .set({
      name: input.name,
      allowedOrigins: input.allowedOrigins,
      ...(input.charts
        ? { charts: storedTrafficEmbedCharts(input.charts) }
        : {}),
    })
    .where(
      and(
        eq(geoTrafficEmbeds.id, input.embedId),
        eq(geoTrafficEmbeds.organizationId, input.organizationId),
        isNull(geoTrafficEmbeds.revokedAt)
      )
    )
    .returning(summaryColumns);
  await dropConfigCache(input.embedId);
  return row ? toSummary(row) : null;
}

export async function revokeTrafficEmbed(
  organizationId: string,
  embedId: string
): Promise<boolean> {
  const rows = await db
    .update(geoTrafficEmbeds)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(geoTrafficEmbeds.id, embedId),
        eq(geoTrafficEmbeds.organizationId, organizationId),
        isNull(geoTrafficEmbeds.revokedAt)
      )
    )
    .returning({ id: geoTrafficEmbeds.id });
  await dropConfigCache(embedId);
  return rows.length > 0;
}

/**
 * Read on every embed request, by the header middleware and the page loader.
 * Edits and revocations drop the cached entry, so the TTL only bounds a
 * failed drop. Unknown and revoked ids are cached as a miss, so repeated
 * requests for them don't reach the database.
 */
export async function getTrafficEmbedConfig(
  embedId: string
): Promise<TrafficEmbedConfig | null> {
  if (!isTrafficEmbedId(embedId)) {
    return null;
  }
  const cached = await readCache<CachedConfig>(configKey(embedId));
  return cached === null ? lookupTrafficEmbedConfig(embedId) : configOf(cached);
}

type CachedConfig = TrafficEmbedConfig | typeof TRAFFIC_EMBED_CONFIG_MISS;

function configOf(cached: CachedConfig): TrafficEmbedConfig | null {
  if (cached === TRAFFIC_EMBED_CONFIG_MISS) {
    return null;
  }
  return { ...cached, charts: storedTrafficEmbedCharts(cached.charts) };
}

/** The database lookup behind the config cache; fills it, hit or miss. */
async function lookupTrafficEmbedConfig(
  embedId: string
): Promise<TrafficEmbedConfig | null> {
  const [row] = await db
    .select({
      id: geoTrafficEmbeds.id,
      organizationId: geoTrafficEmbeds.organizationId,
      projectId: geoTrafficEmbeds.projectId,
      host: geoTrafficEmbeds.host,
      source: geoTrafficEmbeds.source,
      allowedOrigins: geoTrafficEmbeds.allowedOrigins,
      charts: geoTrafficEmbeds.charts,
    })
    .from(geoTrafficEmbeds)
    .where(
      and(eq(geoTrafficEmbeds.id, embedId), isNull(geoTrafficEmbeds.revokedAt))
    )
    .limit(1);
  const config: TrafficEmbedConfig | null = row
    ? { ...row, charts: storedTrafficEmbedCharts(row.charts) }
    : null;
  await writeCache(
    configKey(embedId),
    config ?? TRAFFIC_EMBED_CONFIG_MISS,
    TRAFFIC_EMBED_CONFIG_TTL_SECONDS
  );
  return config;
}

function runGeo<A, E>(
  effect: Effect.Effect<A, E, GeoDashboardRuntime>
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(geoCoreDashboardLayer)));
}

/**
 * The four brand settings share of voice needs, read straight from the row.
 * `loadGeoSettings` would also build the model catalog, which checks plan
 * access and made share of voice the slowest chart by far.
 */
const loadShareOfVoiceSettings = Effect.fn("geo.embedShareOfVoiceSettings")(
  function* (input: GeoScopeInput) {
    const scope = yield* resolveGeoScope(input);
    const projectId = scope.projectId;
    if (!projectId) {
      return null;
    }
    const [row] = yield* geoDb("embed settings lookup failed", () =>
      db
        .select({
          companyName: geoSettings.companyName,
          aliases: geoSettings.aliases,
          engines: geoSettings.engines,
          ignoredCompetitors: geoSettings.ignoredCompetitors,
        })
        .from(geoSettings)
        .where(eq(geoSettings.projectId, projectId))
        .limit(1)
    );
    return row ?? null;
  }
);

const loadRunningVisibility = Effect.fn("geo.embedRunningVisibility")(
  function* (scope: GeoScopeInput, window: GeoWindowInput) {
    const [timeseries, overview, settings] = yield* Effect.all(
      [
        loadGeoTimeseries(scope, window),
        loadGeoOverview(scope, window),
        loadShareOfVoiceSettings(scope),
      ],
      { concurrency: "unbounded" }
    );
    const stored = settings?.engines ?? [];
    return withoutStoppedEngines(
      overview.engines,
      timeseries.points,
      stored.length > 0 ? stored : [...GEO_SELF_SERVE_ENGINE_IDS]
    );
  }
);

type SourceLoader<K extends TrafficEmbedDataSource> = (
  config: TrafficEmbedConfig,
  scope: GeoScopeInput,
  window: GeoWindowInput
) => Promise<TrafficEmbedSourceData[K]>;

/**
 * Each loader returns only what its charts draw: no settings, prompts or
 * competitor lists leave the server.
 */
const SOURCE_LOADERS: { [K in TrafficEmbedDataSource]: SourceLoader<K> } = {
  // Web embeds keep only totals and the daily series, so pages, referrers
  // and hosts never reach the public page.
  traffic: async (config, scope, window) => {
    if (config.source === "web") {
      const { totals, points, imported } = await runGeo(
        loadWebAnalytics(
          scope,
          window,
          config.host ?? undefined,
          "",
          undefined,
          "summary",
          { engagement: false }
        )
      );
      return {
        source: "web",
        web: { totals, points, imported: imported ?? null },
      };
    }
    const traffic = await runGeo(
      loadAiTraffic(
        scope,
        window,
        webHostFilter(config.host ?? undefined),
        "",
        "",
        undefined,
        false
      )
    );
    return { source: "agents", traffic };
  },
  timeseries: async (_config, scope, window) =>
    (await runGeo(loadRunningVisibility(scope, window))).points,
  overview: async (_config, scope, window) =>
    (await runGeo(loadRunningVisibility(scope, window))).engines,
  shareOfVoice: async (_config, scope, window) => {
    const [share, { competitors }, settings, overview] = await runGeo(
      Effect.all(
        [
          loadGeoCompetitorShare(scope, window),
          loadGeoCompetitors(scope),
          loadShareOfVoiceSettings(scope),
          loadGeoOverview(scope, window),
        ],
        { concurrency: "unbounded" }
      )
    );
    return trafficEmbedShareOfVoiceRows({
      share,
      competitors,
      settings: settings
        ? {
            ...settings,
            // The assistants that answered never count as rivals, tracked
            // or not.
            engines: [
              ...(settings.engines ?? []),
              ...overview.engines.map((engine) => engine.engine),
            ],
          }
        : null,
    });
  },
  languages: async (_config, scope, window) =>
    (await runGeo(loadGeoLanguageShare(scope, window))).points,
  countries: (config, scope, window) =>
    runGeo(loadWebCountries(scope, window, config.host ?? undefined)),
};

function sourcesFor(
  charts: readonly TrafficEmbedChart[]
): TrafficEmbedDataSource[] {
  return [
    ...new Set(charts.flatMap((chart) => TRAFFIC_EMBED_CHART_SOURCES[chart])),
  ];
}

function isCacheEntry(value: unknown): value is TrafficEmbedCacheEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    typeof (value as { at?: unknown }).at === "number"
  );
}

/** Null when Redis is off or the counter isn't set; freshness then uses age only. */
async function readCheckGeneration(
  organizationId: string
): Promise<number | null> {
  const value = await readCache<number | string>(
    geoCheckGenerationKey(organizationId)
  );
  const generation = Number(value);
  return value === null || !Number.isFinite(generation) ? null : generation;
}

interface SourceRequest {
  source: TrafficEmbedDataSource;
  config: TrafficEmbedConfig;
  range: TrafficEmbedRange;
  window: { from: string; to: string };
  generation: number | null;
}

/**
 * Loads a source and caches it with its load time and generation. Concurrent
 * calls on this instance share one load.
 */
function refreshSource(
  request: SourceRequest
): Promise<TrafficEmbedCacheEntry> {
  const { source, config, range, window, generation } = request;
  const key = dataKey(config.id, source, range, window.to);
  const pending = pendingLoads.get(key) as
    | Promise<TrafficEmbedCacheEntry>
    | undefined;
  if (pending) {
    return pending;
  }
  const load = SOURCE_LOADERS[source](
    config,
    {
      organizationId: config.organizationId,
      ...(config.projectId ? { projectId: config.projectId } : {}),
    },
    window
  )
    .then(async (data) => {
      const entry: TrafficEmbedCacheEntry = {
        data,
        at: Date.now(),
        generation: TRAFFIC_EMBED_CHECK_SOURCES.has(source) ? generation : null,
      };
      await writeCache(key, entry, TRAFFIC_EMBED_DATA_TTL_SECONDS);
      return entry;
    })
    .finally(() => pendingLoads.delete(key));
  pendingLoads.set(key, load);
  return load;
}

/**
 * Refreshes a stale source after the response, so no viewer waits for it.
 * A short Redis lock keeps a wall of displays on several instances from
 * refreshing the same source together.
 */
function refreshInBackground(request: SourceRequest): void {
  const key = dataKey(
    request.config.id,
    request.source,
    request.range,
    request.window.to
  );
  if (pendingLoads.has(key)) {
    return;
  }
  const task = async () => {
    if (writeRedis) {
      const locked = await writeRedis
        .set(refreshLockKey(key), 1, {
          nx: true,
          ex: TRAFFIC_EMBED_REFRESH_LOCK_SECONDS,
        })
        .catch(() => "unavailable" as const);
      // Another instance holds it. When Redis can't answer, refresh anyway,
      // or the numbers would stay as old as the cache entry.
      if (locked === null) {
        return;
      }
    }
    await refreshSource(request).catch((error: unknown) =>
      logWarn("[geo] traffic embed refresh failed", {
        source: request.source,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  };
  try {
    afterResponse(task);
  } catch {
    // Outside a request (tests, scripts) there is no response to wait for.
    void task();
  }
}

/**
 * Fresh entries are served as they are. A stale one is served at once and
 * refreshed in the background. One from before the latest scan is reloaded
 * now, since check queries are fast and the new numbers are the point; if
 * that fails the old numbers stay. A missing or failed source is null.
 */
async function resolveSource(
  request: SourceRequest,
  cached: unknown,
  now: number
): Promise<TrafficEmbedCacheEntry | null> {
  const entry = isCacheEntry(cached) ? cached : null;
  const outdated =
    entry !== null &&
    TRAFFIC_EMBED_CHECK_SOURCES.has(request.source) &&
    request.generation !== null &&
    entry.generation !== request.generation;
  if (entry && !outdated) {
    if (now - entry.at >= TRAFFIC_EMBED_DATA_FRESH_SECONDS * 1000) {
      refreshInBackground(request);
    }
    return entry;
  }
  try {
    return await refreshSource(request);
  } catch (error) {
    logWarn("[geo] traffic embed source failed", {
      source: request.source,
      error: error instanceof Error ? error.message : String(error),
    });
    return entry;
  }
}

/**
 * Changes with the stored charts and domains and with the deploy, so a page
 * left open for days reloads into the current code and frame-ancestors.
 */
function embedRevision(config: TrafficEmbedConfig): string {
  const build =
    process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  return createHash("sha256")
    .update(
      JSON.stringify([build, config.charts, [...config.allowedOrigins].sort()])
    )
    .digest("base64url")
    .slice(0, 16);
}

/**
 * Null for unknown or revoked embeds, "blocked" when `allow` refuses the
 * request for this embed's domains. Nothing is loaded for a blocked request.
 */
export async function loadPublicTrafficEmbed(
  embedId: string,
  range: TrafficEmbedRange,
  chartsParam: unknown,
  allow: (config: TrafficEmbedConfig) => boolean
): Promise<PublicTrafficEmbed | "blocked" | null> {
  if (!isTrafficEmbedId(embedId)) {
    return null;
  }
  const { dateFrom: from, dateTo: to } = geoPresetRange(range);
  // The config decides which charts are allowed, but reading it first would
  // cost a second round trip. The URL's pick is read alongside it and only
  // used once the config allows it.
  const requested = sourcesFor(
    trafficEmbedCharts(chartsParam, TRAFFIC_EMBED_CHARTS)
  );
  const [cachedConfig, ...cachedData] = await readCaches([
    configKey(embedId),
    ...requested.map((source) => dataKey(embedId, source, range, to)),
  ]);
  const config =
    cachedConfig === null || cachedConfig === undefined
      ? await lookupTrafficEmbedConfig(embedId)
      : configOf(cachedConfig as CachedConfig);
  if (!config) {
    return null;
  }
  if (!allow(config)) {
    return "blocked";
  }
  const charts = trafficEmbedCharts(chartsParam, config.charts);
  const sources = sourcesFor(charts);
  const generation = sources.some((source) =>
    TRAFFIC_EMBED_CHECK_SOURCES.has(source)
  )
    ? await readCheckGeneration(config.organizationId)
    : null;
  const cachedBySource = new Map<TrafficEmbedDataSource, unknown>(
    requested.map((source, index) => [source, cachedData[index]])
  );
  // The URL asked for charts the config no longer allows, so it fell back
  // to the stored ones; read those sources' cache too before loading them.
  const unread = sources.filter((source) => !cachedBySource.has(source));
  if (unread.length > 0) {
    const extra = await readCaches(
      unread.map((source) => dataKey(embedId, source, range, to))
    );
    for (const [index, source] of unread.entries()) {
      cachedBySource.set(source, extra[index]);
    }
  }
  const now = Date.now();
  const entries = await Promise.all(
    sources.map((source) =>
      resolveSource(
        { source, config, range, window: { from, to }, generation },
        cachedBySource.get(source),
        now
      )
    )
  );
  // Every value came from SOURCE_LOADERS for its source, or from the cache
  // entry it wrote.
  const data = Object.fromEntries(
    sources.flatMap((source, index) => {
      const entry = entries[index];
      return entry ? [[source, entry.data]] : [];
    })
  ) as Partial<TrafficEmbedSourceData>;
  const oldest = Math.min(
    now,
    ...entries.flatMap((entry) => (entry ? [entry.at] : []))
  );
  return {
    range,
    from,
    to,
    charts,
    data,
    updatedAt: new Date(oldest).toISOString(),
    revision: embedRevision(config),
    allowedOrigins: config.allowedOrigins,
  };
}
