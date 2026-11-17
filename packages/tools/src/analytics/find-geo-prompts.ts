import { GEO_PROMPT_FIND_INTERNAL_PATH } from "@notra/ai/constants/geo-tools";
import { findGeoPromptsInputSchema } from "@notra/ai/schemas/geo-tools";
import { logError } from "@notra/ai/utils/server-log";
import {
  geoPromptFindRequestSchema,
  geoPromptFindResponseSchema,
} from "@notra/geo-core/schemas/geo-prompt-scan";
import { defineTool } from "eve/tools";

import { GEO_QUERY_FAILED_MESSAGE } from "../constants/analytics";
import { callDashboardGeoRoute } from "../utils/geo-dashboard";
import { requireOrganizationId } from "../utils/organization";

export function createFindGeoPromptsTool() {
  return defineTool({
    description:
      "Find the project's enabled tracked GEO prompts, auto-generated and custom, that match a few words, with their ids. Use it before scan_geo_prompt to name the exact prompt, or when the user asks which prompts are tracked. Returns up to 20 prompts and the total that matched; when more than one fits the request, ask the user which one.",
    inputSchema: findGeoPromptsInputSchema,
    async execute({ projectId, query }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      try {
        return await callDashboardGeoRoute(
          GEO_PROMPT_FIND_INTERNAL_PATH,
          geoPromptFindRequestSchema.parse({
            organizationId,
            projectId,
            query,
          }),
          geoPromptFindResponseSchema
        );
      } catch (error) {
        logError("Find GEO prompts tool failed", error, { organizationId });
        return GEO_QUERY_FAILED_MESSAGE;
      }
    },
  });
}
