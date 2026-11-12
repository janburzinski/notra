import {
  GEO_ENGINE_POLICY_FAMILY_REPLACEMENTS,
  GEO_SELF_SERVE_ENGINE_IDS,
} from "../constants/geo-engine-policy";

export function isGeoSelfServeEngine(engine: string): boolean {
  return GEO_SELF_SERVE_ENGINE_IDS.has(engine);
}

export function geoEnginePolicyReplacement(engine: string): string | undefined {
  if (isGeoSelfServeEngine(engine)) {
    return undefined;
  }
  return GEO_ENGINE_POLICY_FAMILY_REPLACEMENTS.find(([prefix]) =>
    engine.startsWith(prefix)
  )?.[1];
}
