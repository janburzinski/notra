import { redis } from "@notra/ai/utils/redis";
import { Effect } from "effect";

import { GEO_CONVERSATION_RUN_CLAIM_TTL_SECONDS } from "../constants/geo-conversations";
import { GeoConversationRunInProgressError } from "../geo/errors";
import type { GeoConversationRunKind } from "../types/geo";
import { geoLogWarn } from "./geo-log";

const RELEASE_OWN_CLAIM_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0";

/**
 * Runs `run` only if no other run of the same conversation or persona is in
 * flight. Agents retry a run whose call timed out while it was still going,
 * which would answer and bill every prompt twice. Without Redis the run goes
 * ahead unguarded.
 */
export function withGeoConversationRunClaim<A, E, R>(
  claim: { kind: GeoConversationRunKind; organizationId: string; id: string },
  run: Effect.Effect<A, E, R>
): Effect.Effect<A, E | GeoConversationRunInProgressError, R> {
  const client = redis;
  if (!client) {
    return run;
  }
  const key = `geo:conversation-run:${claim.kind}:${claim.organizationId}:${claim.id}`;
  const token = crypto.randomUUID();

  const acquire = Effect.tryPromise(() =>
    client.set(key, token, {
      nx: true,
      ex: GEO_CONVERSATION_RUN_CLAIM_TTL_SECONDS,
    })
  ).pipe(
    Effect.map((result) => (result === null ? "taken" : "claimed")),
    Effect.catch((cause) =>
      geoLogWarn({
        event: "geo.conversation_run.claim_unavailable",
        organizationId: claim.organizationId,
        kind: claim.kind,
        id: claim.id,
        error: String(cause),
      }).pipe(Effect.as("unguarded" as const))
    )
  );

  const release = Effect.tryPromise(() =>
    client.eval(RELEASE_OWN_CLAIM_SCRIPT, [key], [token])
  ).pipe(Effect.ignore);

  return Effect.acquireUseRelease(
    acquire,
    (state): Effect.Effect<A, E | GeoConversationRunInProgressError, R> =>
      state === "taken"
        ? Effect.fail(
            new GeoConversationRunInProgressError({
              kind: claim.kind,
              id: claim.id,
            })
          )
        : run,
    (state) => (state === "claimed" ? release : Effect.void)
  );
}
