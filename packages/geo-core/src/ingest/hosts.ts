import { redis } from "@notra/ai/utils/redis";
import { db } from "@notra/db/drizzle";
import { brandSettings, geoSettings, projects } from "@notra/db/schema";
import { GEO_INGEST_IDENTITY_ACTIVE_TTL_SECONDS } from "@notra/geo-core/constants/geo";
import { GEO_PROJECTS_OLDEST_ORDER } from "@notra/geo-core/constants/geo-projects";
import { geoIngestHostsCacheKey } from "@notra/geo-core/geo/ingest-hosts-cache";
import type { GeoIngestIdentity } from "@notra/geo-core/types/geo";
import { ingestAllowedHosts } from "@notra/geo-core/utils/geo-project-domains";
import { and, eq } from "drizzle-orm";
import { Cache, Effect, Exit } from "effect";

import {
  GEO_INGEST_MEMO_MAX_ENTRIES,
  GEO_WEB_IDENTITY_MEMO_MS,
} from "../constants/ingest";
import { GeoIngestScopeCacheKey } from "../types/ingest-cache-keys";
import { geoIngestIdentityPolicy } from "../utils/geo-ingest-identity-policy";

function isHostList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((host) => typeof host === "string")
  );
}

function parseCachedHosts(value: unknown): string[] | undefined {
  if (isHostList(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return isHostList(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function lookupAllowedHosts(
  scope: GeoIngestScopeCacheKey
): Promise<string[]> {
  const projectId =
    scope.projectId ??
    (
      await db.query.projects.findFirst({
        columns: { id: true },
        where: eq(projects.organizationId, scope.organizationId),
        orderBy: GEO_PROJECTS_OLDEST_ORDER,
      })
    )?.id;
  if (!projectId) {
    return [];
  }

  const rows = await db
    .select({
      websiteUrl: brandSettings.websiteUrl,
      domains: geoSettings.domains,
    })
    .from(projects)
    .innerJoin(brandSettings, eq(projects.brandSettingsId, brandSettings.id))
    .leftJoin(geoSettings, eq(geoSettings.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, scope.organizationId),
        eq(projects.id, projectId)
      )
    );

  const seen = new Set<string>();
  const hosts: string[] = [];
  for (const row of rows) {
    for (const host of ingestAllowedHosts(row.websiteUrl, row.domains ?? [])) {
      if (seen.has(host)) {
        continue;
      }
      seen.add(host);
      hosts.push(host);
    }
  }
  return hosts;
}

async function readAllowedHosts(
  scope: GeoIngestScopeCacheKey
): Promise<string[] | null> {
  const key = geoIngestHostsCacheKey(scope.organizationId, scope.projectId);
  const client = redis;
  if (client) {
    const cached = await client.get<string | string[]>(key).catch(() => null);
    const parsed = parseCachedHosts(cached);
    if (parsed) {
      return parsed;
    }
  }

  let hosts: string[];
  try {
    hosts = await lookupAllowedHosts(scope);
  } catch {
    return null;
  }

  if (client) {
    await client
      .set(key, JSON.stringify(hosts), {
        ex: GEO_INGEST_IDENTITY_ACTIVE_TTL_SECONDS,
      })
      .catch(() => null);
  }
  return hosts;
}

// Concurrent lookups of one scope share a call. For identities that post on
// every page view a successful answer is also kept a minute in process, on top
// of the shared Redis cache.
const memory = Effect.runSync(
  Cache.makeWith(
    // readAllowedHosts never rejects: a failed lookup answers null.
    (scope: GeoIngestScopeCacheKey) =>
      Effect.promise(() => readAllowedHosts(scope)),
    {
      capacity: GEO_INGEST_MEMO_MAX_ENTRIES,
      timeToLive: (exit, scope) =>
        scope.recent && Exit.isSuccess(exit) && exit.value !== null
          ? GEO_WEB_IDENTITY_MEMO_MS
          : 0,
    }
  )
);

/**
 * Brand website plus extra tracked domains for this token. `null` means the
 * lookup failed and ingest should fail open; an empty array is a successful
 * lookup with nothing configured and every host is dropped.
 */
export function loadIngestAllowedHosts(
  identity: GeoIngestIdentity
): Promise<string[] | null> {
  if (identity.site) {
    return Promise.resolve(identity.site.hosts);
  }
  return Effect.runPromise(
    Cache.get(
      memory,
      new GeoIngestScopeCacheKey({
        organizationId: identity.organizationId,
        projectId: identity.projectId,
        recent: geoIngestIdentityPolicy(identity).cachesChecks,
      })
    )
  );
}
