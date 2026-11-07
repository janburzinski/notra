import { SITE_BUILD_LIMITS } from "@notra/sites-core/constants/sites";

export const TOOLCHAIN_REBUILD_DEDUPE_PREFIX = "toolchain-rebuild:";
export const TOOLCHAIN_REBUILD_LOCK = "sites-toolchain-rebuilds";

export const TOOLCHAIN_REBUILD_LIMITS = {
  /** Automatic rebuilds queued or building at once, across every site. */
  maxInFlight: 4,
  /** No rebuild starts while this many builds of any kind are in progress. */
  maxBusyBuilds: SITE_BUILD_LIMITS.maxConcurrentBuilds / 2,
  /** Older in-progress rows are stuck, not using a builder. */
  inFlightWindowMs: 60 * 60 * 1000,
} as const;
