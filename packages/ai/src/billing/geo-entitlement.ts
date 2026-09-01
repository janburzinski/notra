import { GEO_ENTITLEMENT_CACHE_TTL_MS } from "@notra/ai/constants/geo-entitlement";
import { createMemoryTtlCache } from "@notra/ai/router/ttl-cache";

import { allowUnmeteredAiInDevelopment, autumn } from "./autumn";
import { FEATURES } from "./features";

const geoEntitlementCache = createMemoryTtlCache<boolean>();

export async function hasGeoEntitlement(organizationId: string): Promise<boolean> {
  if (allowUnmeteredAiInDevelopment) {
    return true;
  }
  if (!autumn) {
    return false;
  }

  const cached = await geoEntitlementCache.get(organizationId);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const result = await autumn.check({
      customerId: organizationId,
      featureId: FEATURES.AI_ANSWERS,
    });
    await geoEntitlementCache.set(organizationId, result.allowed, GEO_ENTITLEMENT_CACHE_TTL_MS);
    return result.allowed;
  } catch (error) {
    console.error("[GEO Entitlement] Check failed", {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
