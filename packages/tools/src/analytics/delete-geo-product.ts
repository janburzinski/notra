import { GEO_PRODUCT_DELETE_INTERNAL_PATH } from "@notra/ai/constants/geo-tools";
import { deleteGeoProductInputSchema } from "@notra/ai/schemas/geo-tools";
import { logError } from "@notra/ai/utils/server-log";
import {
  geoProductDeleteRequestSchema,
  geoProductDeleteResponseSchema,
} from "@notra/geo-core/schemas/geo-agent-products";
import { defineTool } from "eve/tools";

import {
  GEO_PRODUCT_DELETE_FAILED_MESSAGE,
  GEO_PRODUCT_TASK_DENIED_MESSAGE,
} from "../constants/analytics";
import { callDashboardGeoRoute } from "../utils/geo-dashboard";
import { requireOrganizationId } from "../utils/organization";
import { getSessionAttribute } from "../utils/session";

export function createDeleteGeoProductTool() {
  return defineTool({
    description:
      "Delete one of the project's GEO products, only when the user asks to delete or remove it. The user approves each call. Its prompts stay tracked and move into another product when one fits, and the weekly website check never adds it back. Returns how many prompts lost the product and how many moved into another one. An unknown name returns the project's products.",
    inputSchema: deleteGeoProductInputSchema,
    approval: (ctx) =>
      getSessionAttribute(ctx, "surface") === "task"
        ? { type: "denied", reason: GEO_PRODUCT_TASK_DENIED_MESSAGE }
        : "user-approval",
    async execute({ projectId, product }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      try {
        return await callDashboardGeoRoute(
          GEO_PRODUCT_DELETE_INTERNAL_PATH,
          geoProductDeleteRequestSchema.parse({
            organizationId,
            projectId,
            product,
          }),
          geoProductDeleteResponseSchema
        );
      } catch (error) {
        logError("Delete GEO product tool failed", error, { organizationId });
        return GEO_PRODUCT_DELETE_FAILED_MESSAGE;
      }
    },
  });
}
