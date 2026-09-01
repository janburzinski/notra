import { allowUnmeteredAiInDevelopment, autumn } from "./autumn";
import { FEATURES } from "./features";

export async function hasGeoEntitlement(organizationId: string): Promise<boolean> {
  if (allowUnmeteredAiInDevelopment) {
    return true;
  }
  if (!autumn) {
    return false;
  }

  try {
    const result = await autumn.check({
      customerId: organizationId,
      featureId: FEATURES.AI_ANSWERS,
    });
    return result.allowed;
  } catch (error) {
    console.error("[GEO Entitlement] Check failed", {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
