import { GEO_PRODUCT_CREATE_INTERNAL_PATH } from "@notra/ai/constants/geo-tools";
import { createGeoProductInputSchema } from "@notra/ai/schemas/geo-tools";
import { logError } from "@notra/ai/utils/server-log";
import {
  geoProductCreateRequestSchema,
  geoProductCreateResponseSchema,
} from "@notra/geo-core/schemas/geo-agent-products";
import { defineTool } from "eve/tools";

import {
  GEO_PRODUCT_CREATE_FAILED_MESSAGE,
  GEO_PRODUCT_TASK_DENIED_MESSAGE,
} from "../constants/analytics";
import { callDashboardGeoRoute } from "../utils/geo-dashboard";
import { requireOrganizationId } from "../utils/organization";
import { getSessionAttribute } from "../utils/session";

export function createCreateGeoProductTool() {
  return defineTool({
    description:
      "Add a product to a GEO project when the user asks for one, or names a product or product line the company sells that the project doesn't have yet. Name it the way the company's site does, never a customer segment, plan tier or single feature. Tracked prompts without a product that fit it are filed into it right away, and prompts added later are filed automatically. Returns status created with sortedPrompts, the number of prompts it picked up, or status exists with the product that already has the name. To move specific prompts into it, call move_geo_prompts next.",
    inputSchema: createGeoProductInputSchema,
    approval: (ctx) =>
      getSessionAttribute(ctx, "surface") === "task"
        ? { type: "denied", reason: GEO_PRODUCT_TASK_DENIED_MESSAGE }
        : "not-applicable",
    async execute({ projectId, name, niche }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      try {
        return await callDashboardGeoRoute(
          GEO_PRODUCT_CREATE_INTERNAL_PATH,
          geoProductCreateRequestSchema.parse({
            organizationId,
            projectId,
            name,
            niche,
          }),
          geoProductCreateResponseSchema
        );
      } catch (error) {
        logError("Create GEO product tool failed", error, { organizationId });
        return GEO_PRODUCT_CREATE_FAILED_MESSAGE;
      }
    },
  });
}
