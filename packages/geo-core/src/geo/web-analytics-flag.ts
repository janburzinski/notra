import { webAnalyticsFlagState } from "@notra/ai/utils/web-analytics-access";
import { Cache, Effect, Option } from "effect";

import {
  GEO_INGEST_MEMO_MAX_ENTRIES,
  GEO_WEB_FLAG_LAST_KNOWN_MS,
  GEO_WEB_IDENTITY_MEMO_MS,
} from "../constants/ingest";

// Only written with Cache.set and read with Cache.getOption, so its lookup
// never runs.
const lastKnown = Effect.runSync(
  Cache.make({
    capacity: GEO_INGEST_MEMO_MAX_ENTRIES,
    timeToLive: GEO_WEB_FLAG_LAST_KNOWN_MS,
    lookup: (_organizationId: string) => Effect.succeed(false),
  })
);

/**
 * Whether the organization's web analytics flag is on. When the flag service
 * cannot answer, its last answer of the past day holds, so a short outage
 * neither drops beacons nor hides imports; with no known answer it is off.
 */
export const readWebAnalyticsFlag = Effect.fnUntraced(function* (
  organizationId: string
) {
  const state = yield* webAnalyticsFlagState(organizationId);
  if (state === "unavailable") {
    const known = yield* Cache.getOption(lastKnown, organizationId);
    return Option.getOrElse(known, () => false);
  }
  const enabled = state === "enabled";
  yield* Cache.set(lastKnown, organizationId, enabled);
  return enabled;
});

const answers = Effect.runSync(
  Cache.make({
    capacity: GEO_INGEST_MEMO_MAX_ENTRIES,
    timeToLive: GEO_WEB_IDENTITY_MEMO_MS,
    lookup: readWebAnalyticsFlag,
  })
);

/**
 * {@link readWebAnalyticsFlag}, asked at most once a minute per organization
 * in this process, so beacons do not each ask the flag service.
 */
export const isWebAnalyticsFlagOn = (organizationId: string) =>
  Cache.get(answers, organizationId);
