import {
  GEO_DIRECT_GROUNDED_PROVIDERS,
  GEO_OPENCODE_ENGINE_ID,
} from "../constants/geo";
import {
  GEO_MODEL_BATCH_SUFFIX,
  GEO_MODEL_REPLACED_IDS,
} from "../constants/geo-model-catalog";
import type {
  GeoGroundedEngine,
  GeoModelCatalog,
  GeoModelGateway,
  GeoResolvedModelCatalog,
  GeoScanSkipReason,
  GeoZdrMode,
  GeoZdrPolicy,
} from "../types/geo";
import { isGeoBoxCodingAgent } from "./geo-coding-agents";
import { isGeoContextEngine } from "./geo-context";
import { engineModelOf } from "./geo-engine-family";
import { geoEnginePolicyReplacement } from "./geo-engine-policy";
import {
  geoDefaultEngines,
  getGeoModelCatalogEntry,
  isGeoEngineZdrCapable,
} from "./geo-model-catalog";
import { isGeoOlostepEngine } from "./geo-olostep";

/** Known catalog ids, in catalog order. Unknown ids are dropped. */
export function sortKnownEngines(
  catalog: GeoModelCatalog,
  ids: Iterable<string>
): string[] {
  const selected = new Set(ids);
  return catalog.models
    .filter((model) => selected.has(model.id))
    .map((model) => model.id);
}

/** Canonicalize saved batch variants and replace retired catalog ids. */
export function remapRetiredGeoEngineIds(
  ids: Iterable<string>,
  applyPolicy = true
): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of ids) {
    const base = id.endsWith(GEO_MODEL_BATCH_SUFFIX)
      ? id.slice(0, -GEO_MODEL_BATCH_SUFFIX.length)
      : id;
    const replaced = GEO_MODEL_REPLACED_IDS[base] ?? base;
    const mapped = applyPolicy
      ? (geoEnginePolicyReplacement(replaced) ?? replaced)
      : replaced;
    if (seen.has(mapped)) {
      continue;
    }
    seen.add(mapped);
    next.push(mapped);
  }
  return next;
}

/**
 * Resolve a this-run engine selection. `undefined` keeps the full tracked set.
 * An explicit selection may include catalog models the project does not track,
 * so a one-off scan can try a model before tracking it. Unknown ids and
 * untracked legacy models are dropped.
 */
export function scopeGeoScanEngines(
  catalog: GeoModelCatalog,
  tracked: readonly string[],
  requested?: readonly string[]
): string[] {
  if (!requested) {
    return [...tracked];
  }
  const trackedIds = new Set(remapRetiredGeoEngineIds(tracked));
  return sortKnownEngines(
    catalog,
    remapRetiredGeoEngineIds(requested).filter(
      (engine) =>
        trackedIds.has(engine) ||
        !getGeoModelCatalogEntry(catalog, engine)?.hidden
    )
  );
}

/**
 * Requested engines a this-run selection must turn down: ids the catalog
 * doesn't know and hidden legacy models the project doesn't track. Only exact
 * catalog ids, retired ids with a named replacement and the project's own
 * tracked ids count as known, because the engine policy folds every unknown id
 * of a family (`google/ai-overveiw`) into that family's default engine.
 */
export function unknownGeoScanEngines(
  catalog: GeoModelCatalog,
  tracked: readonly string[],
  requested: readonly string[]
): string[] {
  const trackedIds = new Set([
    ...tracked,
    ...remapRetiredGeoEngineIds(tracked, false),
  ]);
  const scoped = new Set(scopeGeoScanEngines(catalog, tracked, requested));
  return [
    ...new Set(
      requested.filter((engine) => {
        const [named] = remapRetiredGeoEngineIds([engine], false);
        const known =
          named !== undefined &&
          (getGeoModelCatalogEntry(catalog, named) !== undefined ||
            trackedIds.has(engine) ||
            trackedIds.has(named));
        const [mapped] = remapRetiredGeoEngineIds([engine]);
        return !(known && mapped && scoped.has(mapped));
      })
    ),
  ];
}

/** Every engine a this-run selection may name, in catalog order. */
export function scannableGeoScanEngines(
  catalog: GeoModelCatalog,
  tracked: readonly string[]
): string[] {
  return scopeGeoScanEngines(
    catalog,
    tracked,
    catalog.models.map((model) => model.id)
  );
}

/**
 * Whether a run's engine selection leaves out a tracked engine. Such a run
 * must not cover a scheduled project scan, or the skipped engines would go a
 * whole interval without data.
 */
export function isPartialGeoScanEngineScope(
  tracked: readonly string[],
  scanEngines: readonly string[]
): boolean {
  const scanned = new Set(scanEngines);
  return remapRetiredGeoEngineIds(tracked).some(
    (engine) => !scanned.has(engine)
  );
}

/**
 * Bare catalog calls that still search the web: consumer apps and Google AI
 * Overview scraped through Context or Olostep, and Box coding agents. Cursor is
 * excluded — it runs with no tools.
 */
export function isGeoNativeSearchEngine(
  catalog: GeoModelCatalog,
  engine: string
): boolean {
  const gateway = resolveGeoEngineGateway(catalog, engine);
  return gateway === "box" || gateway === "olostep" || gateway === "context";
}

/** Whether a catalog model runs with web search: grounded route or native search. */
export function isGeoWebSearchEngine(
  catalog: GeoResolvedModelCatalog,
  engine: string
): boolean {
  return (
    catalog.models.some(
      (model) => model.id === engine && model.supportsGroundedChecks
    ) || isGeoNativeSearchEngine(catalog, engine)
  );
}

/** Whether a stored check's engine id answered with web search. */
export function geoEngineUsedWebSearch(engine: string): boolean {
  return (
    engineModelOf(engine) !== engine ||
    isGeoOlostepEngine(engine) ||
    isGeoContextEngine(engine) ||
    engine === GEO_OPENCODE_ENGINE_ID ||
    isGeoBoxCodingAgent(GEO_MODEL_REPLACED_IDS[engine] ?? engine)
  );
}

/**
 * Empty engine scope must not become a successful zero-check scan. A requested
 * selection with no catalog model left, or a set that ZDR rejects in full, is
 * a skip — not a completed pollable run.
 */
export function geoScanEmptyEngineSkipReason(
  scanEngines: readonly string[],
  runnableEngineCount: number,
  requestedEngines?: readonly string[]
): GeoScanSkipReason | null {
  if (
    scanEngines.length === 0 &&
    (requestedEngines !== undefined || runnableEngineCount === 0)
  ) {
    return "scoped_engines_missing";
  }
  if (scanEngines.length > 0 && runnableEngineCount === 0) {
    return "zdr";
  }
  return null;
}

/**
 * Maps a project's stored engine selection onto the engines the scan should
 * run. Unknown ids (models that left the catalog) are dropped; `null` or an
 * empty selection falls back to the default set.
 */
export function resolveTrackedEngines(
  catalog: GeoModelCatalog,
  stored: readonly string[] | null | undefined
): string[] {
  const configured = remapRetiredGeoEngineIds(stored ?? []);
  const selected = sortKnownEngines(catalog, configured);
  return selected.length > 0 ? selected : geoDefaultEngines(catalog);
}

/**
 * Decide how strictly an engine asks the router for zero data retention.
 * - ZDR off for the project → `nonEnforcedMode` ("preferred" by default,
 *   "none" without the add-on).
 * - ZDR on and the model has a ZDR host → "required" (fail closed).
 * - ZDR on, no ZDR host, approved by the user → "preferred".
 * - ZDR on, no ZDR host, not approved → null: the engine must be skipped.
 */
export function resolveGeoZdrMode(
  catalog: GeoModelCatalog,
  engine: string,
  policy: GeoZdrPolicy
): GeoZdrMode | null {
  if (!policy.enforceZdr) {
    return policy.nonEnforcedMode ?? "preferred";
  }
  if (isGeoEngineZdrCapable(catalog, engine)) {
    return "required";
  }
  return policy.nonZdrApprovedEngines.includes(engine) ? "preferred" : null;
}

/**
 * Same decision for a grounded engine. Gateway-served models take their ZDR
 * coverage from the catalog when it lists them; direct vendor SDK engines
 * bypass the router entirely, so under enforced ZDR they run only when the
 * user approved that specific engine.
 */
export function resolveGeoGroundedZdrMode(
  catalog: GeoModelCatalog,
  engine: GeoGroundedEngine,
  policy: GeoZdrPolicy
): GeoZdrMode | null {
  if (engine.provider === "gateway-meta") {
    return !policy.enforceZdr ||
      policy.nonZdrApprovedEngines.includes(engineModelOf(engine.key))
      ? "none"
      : null;
  }
  if (!policy.enforceZdr) {
    return policy.nonEnforcedMode ?? "preferred";
  }
  const routed = !GEO_DIRECT_GROUNDED_PROVIDERS.has(engine.provider);
  const coverage = routed
    ? (getGeoModelCatalogEntry(catalog, engine.model)?.zdr ?? engine.zdr)
    : engine.zdr;
  if (coverage !== "none") {
    return "required";
  }
  return policy.nonZdrApprovedEngines.includes(engineModelOf(engine.key))
    ? "preferred"
    : null;
}

/** Gateway pin for models that only one gateway serves, else undefined. */
export function resolveGeoEngineGateway(
  catalog: GeoModelCatalog,
  engine: string
): GeoModelGateway | undefined {
  const gateways = getGeoModelCatalogEntry(catalog, engine)?.gateways;
  return gateways && gateways.length === 1 ? gateways[0] : undefined;
}

/**
 * Drop every selected engine that cannot run under ZDR. Nothing is swapped
 * for a sibling model; an empty result uses the ZDR-capable default set.
 */
export function applyGeoZdrEngineFallback(
  catalog: GeoModelCatalog,
  selected: readonly string[],
  policy: GeoZdrPolicy
): string[] {
  if (!policy.enforceZdr) {
    return sortKnownEngines(catalog, remapRetiredGeoEngineIds(selected));
  }

  const next = remapRetiredGeoEngineIds(selected).filter(
    (engine) => resolveGeoZdrMode(catalog, engine, policy) !== null
  );

  const sorted = sortKnownEngines(catalog, next);
  if (sorted.length > 0) {
    return sorted;
  }

  const defaults = geoDefaultEngines(catalog).filter((engine) =>
    isGeoEngineZdrCapable(catalog, engine)
  );
  if (defaults.length > 0) {
    return defaults;
  }
  return catalog.models
    .filter(
      (model) => !model.hidden && isGeoEngineZdrCapable(catalog, model.id)
    )
    .slice(0, 1)
    .map((model) => model.id);
}

export function zdrRunnableEngines(
  catalog: GeoModelCatalog,
  tracked: readonly string[],
  policy: GeoZdrPolicy
): string[] {
  if (
    !policy.enforceZdr ||
    tracked.some(
      (engine) => resolveGeoZdrMode(catalog, engine, policy) !== null
    )
  ) {
    return [...tracked];
  }
  return applyGeoZdrEngineFallback(catalog, tracked, policy);
}
