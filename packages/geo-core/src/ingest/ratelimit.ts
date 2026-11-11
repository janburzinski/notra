import { createLimiter } from "@notra/utils/ratelimit";
import { Redis } from "@upstash/redis";

import {
  GEO_INGEST_ADMISSION_RATELIMIT_MAX_REQUESTS,
  GEO_INGEST_ADMISSION_RATELIMIT_PREFIX,
  GEO_INGEST_RATELIMIT_TIMEOUT_MS,
  GEO_INGEST_REDIS_RETRIES,
  WEB_LIMIT_SCRIPT,
} from "../constants/ingest";

export const geoIngestRedis = Redis.fromEnv({
  retry: { retries: GEO_INGEST_REDIS_RETRIES },
});

// Redis is a hard dependency: the pipeline rejects on transport errors and
// timeouts. Fail fast so an outage answers 502 quickly instead of holding
// requests through the default 5 retries and 5 s limiter timeout.
export const geoIngestRatelimit = createLimiter({
  redis: geoIngestRedis,
  prefix: "ratelimit:geo-ingest",
  requests: 1000,
  window: "1m",
  timeout: GEO_INGEST_RATELIMIT_TIMEOUT_MS,
});

export const geoIngestAdmissionRatelimit = createLimiter({
  redis: geoIngestRedis,
  prefix: GEO_INGEST_ADMISSION_RATELIMIT_PREFIX,
  requests: GEO_INGEST_ADMISSION_RATELIMIT_MAX_REQUESTS,
  window: "1m",
  timeout: GEO_INGEST_RATELIMIT_TIMEOUT_MS,
});

/** The web budgets and AI daily counter; `EVALSHA`, then `EVAL` once. */
export const webLimitScript =
  geoIngestRedis.createScript<[number, number]>(WEB_LIMIT_SCRIPT);
