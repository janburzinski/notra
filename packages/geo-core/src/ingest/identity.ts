import {
  getGeoIngestTokenGeneration,
  getGeoWebKeyGeneration,
} from "@notra/geo-core/geo/ingest";
import type { GeoIngestIdentity } from "@notra/geo-core/types/geo";
import { Cache, Effect, Exit } from "effect";

import {
  GEO_INGEST_MEMO_MAX_ENTRIES,
  GEO_WEB_IDENTITY_MEMO_MS,
} from "../constants/ingest";
import { isWebAnalyticsFlagOn } from "../geo/web-analytics-flag";
import { GeoIngestGenerationKey } from "../types/ingest-cache-keys";
import {
  geoIngestIdentityKind,
  geoIngestIdentityPolicy,
} from "../utils/geo-ingest-identity-policy";
import { GeoIngestFailedError, GeoIngestInvalidTokenError } from "./errors";

// Concurrent checks of one key share a lookup. A passed check of an identity
// that posts on every page view is kept a minute so it skips Postgres; the
// generation is part of the key, so a rotated-out key is never admitted on the
// strength of the new key's check. An identity that ignores rotation (a Site)
// passes while its scope exists. Failed lookups are never kept.
const generations = Effect.runSync(
  Cache.makeWith(
    (key: GeoIngestGenerationKey) =>
      Effect.tryPromise(() =>
        (key.web ? getGeoWebKeyGeneration : getGeoIngestTokenGeneration)(
          key.organizationId,
          key.projectId
        )
      ),
    {
      capacity: GEO_INGEST_MEMO_MAX_ENTRIES,
      timeToLive: (exit, key) =>
        key.cachesChecks &&
        Exit.isSuccess(exit) &&
        (key.followsRotation
          ? exit.value === key.generation
          : exit.value !== null)
          ? GEO_WEB_IDENTITY_MEMO_MS
          : 0,
    }
  )
);

/**
 * notra.js beacons only count for organizations with the web analytics flag;
 * write tokens and Notra Sites are not behind it.
 */
export const isWebAnalyticsAdmitted = Effect.fnUntraced(function* (
  identity: GeoIngestIdentity
) {
  if (geoIngestIdentityKind(identity) !== "web") {
    return true;
  }
  return yield* isWebAnalyticsFlagOn(identity.organizationId);
});

/**
 * A valid signature is not enough: the token's generation must match the
 * token's organization or project scope (rotation revokes older generations), and the
 * organization (and project, when the token is project-scoped) must still
 * exist so leaked tokens die with the resources they were minted for. The
 * generation lookup also checks existence and project ownership. Checks fail
 * closed so a database outage cannot reauthorize a revoked token.
 */
export const assertGeoIngestIdentityActive = Effect.fnUntraced(function* (
  identity: GeoIngestIdentity
) {
  const policy = geoIngestIdentityPolicy(identity);
  const context = {
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    siteId: identity.site?.id,
  };
  const generation = yield* Cache.get(
    generations,
    new GeoIngestGenerationKey({
      web: geoIngestIdentityKind(identity) === "web",
      organizationId: identity.organizationId,
      projectId: identity.projectId,
      generation: identity.generation,
      cachesChecks: policy.cachesChecks,
      followsRotation: policy.followsRotation,
    })
  ).pipe(
    Effect.mapError(
      (error) =>
        new GeoIngestFailedError({
          ...context,
          cause: error.cause,
          stage: "identity_lookup",
        })
    )
  );
  if (generation === null) {
    return yield* Effect.fail(
      new GeoIngestInvalidTokenError({
        ...context,
        authReason: "identity_missing",
      })
    );
  }
  if (policy.followsRotation && generation !== identity.generation) {
    return yield* Effect.fail(
      new GeoIngestInvalidTokenError({
        ...context,
        authReason: "token_revoked",
      })
    );
  }
});
