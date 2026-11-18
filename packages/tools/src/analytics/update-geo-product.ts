import { GEO_PRODUCT_UPDATE_INTERNAL_PATH } from "@notra/ai/constants/geo-tools";
import { updateGeoProductInputSchema } from "@notra/ai/schemas/geo-tools";
import { logError } from "@notra/ai/utils/server-log";
import {
  geoProductUpdateRequestSchema,
  geoProductUpdateResponseSchema,
} from "@notra/geo-core/schemas/geo-agent-products";
import { defineTool } from "eve/tools";

import {
  GEO_PRODUCT_UPDATE_FAILED_MESSAGE,
  GEO_PRODUCT_TASK_DENIED_MESSAGE,
} from "../constants/analytics";
import { callDashboardGeoRoute } from "../utils/geo-dashboard";
import { requireOrganizationId } from "../utils/organization";
import { getSessionAttribute } from "../utils/session";

export function createUpdateGeoProductTool() {
  return defineTool({
    description:
      "Rename one of the project's GEO products or change who it is for, when the user asks. Pass the product's current name in product. Its prompts stay with it. An unknown name returns the project's products.",
    inputSchema: updateGeoProductInputSchema,
    approval: (ctx) =>
      getSessionAttribute(ctx, "surface") === "task"
        ? { type: "denied", reason: GEO_PRODUCT_TASK_DENIED_MESSAGE }
        : "not-applicable",
    async execute({ projectId, product, name, niche }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      try {
        return await callDashboardGeoRoute(
          GEO_PRODUCT_UPDATE_INTERNAL_PATH,
          geoProductUpdateRequestSchema.parse({
            organizationId,
            projectId,
            product,
            name,
            niche,
          }),
          geoProductUpdateResponseSchema
        );
      } catch (error) {
        logError("Update GEO product tool failed", error, { organizationId });
        return GEO_PRODUCT_UPDATE_FAILED_MESSAGE;
      }
    },
  });
}
