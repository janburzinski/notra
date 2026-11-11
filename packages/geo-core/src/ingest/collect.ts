import { verifyGeoWebKey } from "@notra/geo-core/geo/ingest";
import { webCollectPayloadSchema } from "@notra/geo-core/schemas/geo";
import { getClientNetworkKey } from "@notra/utils/client-ip";
import { Effect } from "effect";

import { GEO_WEB_COLLECT_MAX_BODY_BYTES } from "../constants/ingest";
import type {
  GeoIngestBuffer,
  GeoIngestDefer,
  WebCollectOptions,
} from "../types/ingest";
import {
  readLimitedText,
  webCollectEnvelope,
} from "../utils/web-collect-request";
import {
  GeoIngestInvalidPayloadError,
  GeoIngestInvalidTokenError,
  GeoIngestPayloadTooLargeError,
  GeoIngestUnparseableUrlError,
} from "./errors";
import { isWebAnalyticsAdmitted } from "./identity";
import { droppedResult, runWebBeacon } from "./pipeline";
import { admitWebNetwork } from "./web-limits";

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Ingests one beacon from notra.js. The body is text/plain so browsers never
 * send a CORS preflight; the public key inside it picks the project, and the
 * shared pipeline applies the same host allowlist, bot filtering, sessions and
 * rate limits as server-side page views. Notra Sites relay the same beacons
 * with their token instead (`runGeoIngest`).
 */
export const runWebCollect = Effect.fn("geoIngest.collect")(function* (
  request: Request,
  defer: GeoIngestDefer,
  buffer?: GeoIngestBuffer,
  options?: WebCollectOptions
) {
  const text = yield* Effect.promise(() =>
    readLimitedText(request, GEO_WEB_COLLECT_MAX_BODY_BYTES)
  );
  if (text === null) {
    return yield* Effect.fail(new GeoIngestPayloadTooLargeError({}));
  }
  const parsed = webCollectPayloadSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    return yield* Effect.fail(
      new GeoIngestInvalidPayloadError({ issues: parsed.error.issues })
    );
  }
  const payload = parsed.data;
  const identity = verifyGeoWebKey(payload.k);
  if (!identity) {
    return yield* Effect.fail(
      new GeoIngestInvalidTokenError({ authReason: "invalid_signature" })
    );
  }
  if (!(yield* isWebAnalyticsAdmitted(identity))) {
    return droppedResult(identity, "human", "web_analytics_disabled");
  }
  const url = URL.parse(payload.u);
  if (!url) {
    return yield* Effect.fail(
      new GeoIngestUnparseableUrlError({ url: payload.u })
    );
  }
  // Checked before any I/O: a key copied to another site costs no Redis call.
  const origin = request.headers.get("origin");
  if (origin && URL.parse(origin)?.host !== url.host) {
    return droppedResult(identity, "human", "origin", url.hostname);
  }
  if (
    !(yield* Effect.promise(() =>
      admitWebNetwork(identity, getClientNetworkKey(request.headers))
    ))
  ) {
    return droppedResult(identity, "human", "network_rate_limited");
  }
  return yield* runWebBeacon(
    identity,
    payload,
    webCollectEnvelope(request.headers, payload.u, payload.r, options),
    url,
    defer,
    buffer
  );
});
