import type {
  GeoAudienceType,
  GeoModelCatalog,
  GeoModelCatalogEntry,
} from "@notra/geo-core/types/geo";
import {
  geoEnginesForAudience,
  geoModelsForProvider,
} from "@notra/geo-core/utils/geo-model-catalog";

import {
  GEO_CODING_AGENT_PROVIDERS,
  GEO_CONSUMER_APP_GATEWAYS,
  GEO_PICKER_ENGINE_ROWS,
  GEO_PICKER_PROVIDER_LABELS,
  GEO_PROVIDER_PREFERRED_ENGINES,
} from "@/constants/geo-engine-recommendation";
import type { GeoEngineProviderEntry } from "@/types/geo";

const BATCH_LABEL = /\(batch\)$/i;

function isConsumerApp(model: GeoModelCatalogEntry) {
  return (
    !(model.id in GEO_PICKER_ENGINE_ROWS) &&
    model.gateways.some((gateway) => GEO_CONSUMER_APP_GATEWAYS.has(gateway))
  );
}

function pickerProviderId(model: GeoModelCatalogEntry): string {
  return GEO_PICKER_ENGINE_ROWS[model.id]?.id ?? model.provider;
}

export function isGeoCodingAgentProvider(providerId: string) {
  return GEO_CODING_AGENT_PROVIDERS.has(providerId);
}

/**
 * Picker rows, one per provider, plus one per engine in
 * `GEO_PICKER_ENGINE_ROWS`, listed ahead of the provider they belong to.
 */
export function geoPickerProviders(
  catalog: GeoModelCatalog,
  selected: ReadonlySet<string>
): GeoEngineProviderEntry[] {
  return catalog.providers.flatMap((provider) => {
    const models = geoModelsForProvider(catalog, provider.id, selected);
    const ownRows = Object.entries(GEO_PICKER_ENGINE_ROWS).flatMap(
      ([engine, row]) => {
        const model = models.find((entry) => entry.id === engine);
        return model ? [{ provider: row, models: [model] }] : [];
      }
    );
    const rest = models.filter(
      (model) => !(model.id in GEO_PICKER_ENGINE_ROWS)
    );
    const providerRow = {
      provider: {
        ...provider,
        label: GEO_PICKER_PROVIDER_LABELS[provider.id] ?? provider.label,
      },
      models: rest,
    };
    return rest.length > 0 ? [...ownRows, providerRow] : ownRows;
  });
}

/**
 * Projects do not store their audience yet, so it is read back from the
 * engines they track: consumer apps mean buyers who never pick a model.
 * Google's search surfaces are left out, since any project can turn them on, and general
 * and commerce brands get the same picks, so commerce is never returned.
 */
export function inferGeoAudience(
  catalog: GeoModelCatalog,
  engines: readonly string[]
): GeoAudienceType {
  const consumerApp = engines.some((engine) => {
    const model = catalog.models.find((entry) => entry.id === engine);
    return model ? isConsumerApp(model) : false;
  });
  return consumerApp ? "general" : "technical";
}

export function recommendedGeoProviders(
  catalog: GeoModelCatalog,
  audience: GeoAudienceType
): Set<string> {
  const engines = new Set(geoEnginesForAudience(catalog, audience));
  return new Set(
    catalog.models
      .filter((model) => engines.has(model.id))
      .map(pickerProviderId)
  );
}

/**
 * Model to turn on when a provider is enabled. Technical buyers call the API
 * models; everyone else meets the provider through its consumer app.
 */
export function pickGeoProviderEngines(
  eligible: readonly GeoModelCatalogEntry[],
  audience: GeoAudienceType
): string[] {
  const candidates = eligible.filter(
    (model) => !model.hidden && !BATCH_LABEL.test(model.label)
  );
  const preferred = candidates.find((model) =>
    GEO_PROVIDER_PREFERRED_ENGINES.has(model.id)
  );
  const fallback = candidates.find((model) => model.default) ?? candidates[0];
  const pick =
    audience === "technical"
      ? (preferred ?? fallback)
      : (candidates.find(isConsumerApp) ?? preferred ?? fallback);
  return pick ? [pick.id] : [];
}
