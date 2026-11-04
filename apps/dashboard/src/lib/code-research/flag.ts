import { isCodeResearchConfigured } from "@notra/ai/utils/code-research-box";

import { CODE_RESEARCH_FLAG_KEY } from "@/constants/code-research";
import { getFlagsManager } from "@/lib/geo/flag";

/**
 * Whether the content agent may read the organization's repository in a
 * sandbox. Fails closed: flag errors keep code research off.
 */
export async function isCodeResearchEnabledForOrganization(
  organizationId: string
): Promise<boolean> {
  if (!isCodeResearchConfigured()) {
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  const manager = getFlagsManager();
  if (!manager) {
    return false;
  }
  try {
    const result = await manager.getFlag(CODE_RESEARCH_FLAG_KEY, {
      organizationId,
      properties: { organizationId },
    });
    return result.enabled;
  } catch {
    return false;
  }
}
