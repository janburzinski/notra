import { Data } from "effect";

import type { ImportKind } from "./analytics-imports";

/** One token or web key generation check. */
export class GeoIngestGenerationKey extends Data.Class<{
  readonly web: boolean;
  readonly organizationId: string;
  readonly projectId: string | null;
  readonly generation: number;
  readonly cachesChecks: boolean;
}> {}

/**
 * One organization or project scope. With `recent`, a successful answer is
 * kept in process; without it, concurrent lookups only share one call.
 */
export class GeoIngestScopeCacheKey extends Data.Class<{
  readonly organizationId: string;
  readonly projectId: string | null;
  readonly recent: boolean;
}> {}

/** Completed imports of one kind in one organization or project. */
export class CompletedImportsCacheKey extends Data.Class<{
  readonly organizationId: string;
  readonly projectId: string | null;
  readonly kind: ImportKind;
}> {}
