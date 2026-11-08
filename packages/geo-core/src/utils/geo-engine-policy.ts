import {
  GEO_ENGINE_POLICY_EFFECTIVE_AT,
  GEO_ENGINE_POLICY_NEW_ORGS_FROM,
  GEO_ENGINE_POLICY_FAMILY_REPLACEMENTS,
  GEO_SELF_SERVE_ENGINE_IDS,
} from "../constants/geo-engine-policy";

export function isGeoEnginePolicyActive(now: number = Date.now()): boolean {
  return (
    process.env.NODE_ENV !== "test" && now >= GEO_ENGINE_POLICY_EFFECTIVE_AT
  );
}

export function isGeoEnginePolicyActiveFor(
  createdAt: Date | null,
  now: number = Date.now()
): boolean {
  return (
    isGeoEnginePolicyActive(now) ||
    (process.env.NODE_ENV !== "test" &&
      createdAt !== null &&
      createdAt.getTime() >= GEO_ENGINE_POLICY_NEW_ORGS_FROM)
  );
}

export function isGeoSelfServeEngine(engine: string): boolean {
  return GEO_SELF_SERVE_ENGINE_IDS.has(engine);
}

export function geoEnginePolicyReplacement(
  engine: string,
  now: number = Date.now()
): string | undefined {
  if (!isGeoEnginePolicyActive(now) || isGeoSelfServeEngine(engine)) {
    return undefined;
  }
  return GEO_ENGINE_POLICY_FAMILY_REPLACEMENTS.find(([prefix]) =>
    engine.startsWith(prefix)
  )?.[1];
}
