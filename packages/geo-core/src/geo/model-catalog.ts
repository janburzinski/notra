import { Effect } from "effect";

import { GEO_ENGINE_DISPLAY_LABELS } from "../constants/geo-engine-policy";
import {
  GEO_MODEL_FEED_RETRY_SECONDS,
  GEO_MODEL_FEED_REVALIDATE_SECONDS,
  GEO_MODEL_FEED_TIMEOUT_MS,
  GEO_MODEL_FEED_URL,
} from "../constants/geo-model-catalog";
import { GeoEngineCredentialsRequired } from "../deps";
import { geoModelFeedSchema } from "../schemas/geo-model-feed";
import type { GeoModelCatalog, GeoResolvedModelCatalog } from "../types/geo";
import { isGeoSelfServeEngine } from "../utils/geo-engine-policy";
import { logGeoFailure } from "../utils/geo-log";
import {
  buildGeoModelCatalogFromFeed,
  seedGeoModelCatalog,
  withoutGeoModelCatalogEntries,
} from "../utils/geo-model-catalog";

const MS_PER_SECOND = 1000;

interface NextRevalidateRequestInit extends RequestInit {
  next?: { revalidate?: number };
}

const cachedByCredentials = new Map<
  boolean,
  { catalog: GeoModelCatalog; expiresAt: number }
>();
const refreshingByCredentials = new Map<boolean, Promise<GeoModelCatalog>>();

async function fetchGeoModelCatalog(
  requireCredentials: boolean
): Promise<GeoModelCatalog> {
  const init: NextRevalidateRequestInit = {
    next: { revalidate: GEO_MODEL_FEED_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(GEO_MODEL_FEED_TIMEOUT_MS),
  };
  const response = await fetch(GEO_MODEL_FEED_URL, init);
  if (!response.ok) {
    throw new Error(`Model feed responded with ${response.status}`);
  }
  const feed = geoModelFeedSchema.parse(await response.json());
  const catalog = buildGeoModelCatalogFromFeed(feed.data, requireCredentials);
  if (catalog.models.length === 0) {
    throw new Error("Model feed returned no eligible models");
  }
  return catalog;
}

/** One feed request at a time per catalog; concurrent readers share it. */
function refreshGeoModelCatalog(
  requireCredentials: boolean
): Promise<GeoModelCatalog> {
  const pending = refreshingByCredentials.get(requireCredentials);
  if (pending) {
    return pending;
  }
  const refresh = fetchGeoModelCatalog(requireCredentials)
    .then((catalog) => {
      cachedByCredentials.set(requireCredentials, {
        catalog,
        expiresAt:
          Date.now() + GEO_MODEL_FEED_REVALIDATE_SECONDS * MS_PER_SECOND,
      });
      return catalog;
    })
    .catch((error: unknown) => {
      const cached = cachedByCredentials.get(requireCredentials);
      logGeoFailure(
        "geo.model_catalog.feed_unavailable",
        "Model feed unavailable, using seed catalog",
        error,
        { hasCachedCatalog: cached !== undefined }
      );
      const fallback =
        cached?.catalog ?? seedGeoModelCatalog(requireCredentials);
      cachedByCredentials.set(requireCredentials, {
        catalog: fallback,
        expiresAt: Date.now() + GEO_MODEL_FEED_RETRY_SECONDS * MS_PER_SECOND,
      });
      return fallback;
    })
    .finally(() => {
      refreshingByCredentials.delete(requireCredentials);
    });
  refreshingByCredentials.set(requireCredentials, refresh);
  return refresh;
}

async function loadSharedGeoModelCatalog(
  requireCredentials: boolean
): Promise<GeoModelCatalog> {
  const cached = cachedByCredentials.get(requireCredentials);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.catalog;
  }
  return await refreshGeoModelCatalog(requireCredentials);
}

export const loadGeoModelCatalog = Effect.fn("geo.modelCatalog")(function* (
  _organizationId: string
) {
  const requireCredentials = yield* GeoEngineCredentialsRequired;
  const catalog = yield* Effect.promise(() =>
    loadSharedGeoModelCatalog(requireCredentials)
  );
  const available = withoutGeoModelCatalogEntries(
    catalog,
    catalog.models
      .filter((model) => !isGeoSelfServeEngine(model.id))
      .map((model) => model.id)
  );
  const resolved: GeoResolvedModelCatalog = {
    ...available,
    models: available.models.map((model) => ({
      ...model,
      label: GEO_ENGINE_DISPLAY_LABELS[model.id] ?? model.label,
      hidden: false,
      supportsGroundedChecks: false,
    })),
  };
  return resolved;
});
