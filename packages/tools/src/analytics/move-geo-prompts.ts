import { GEO_PROMPTS_MOVE_INTERNAL_PATH } from "@notra/ai/constants/geo-tools";
import { moveGeoPromptsInputSchema } from "@notra/ai/schemas/geo-tools";
import { logError } from "@notra/ai/utils/server-log";
import {
  geoPromptsMoveRequestSchema,
  geoPromptsMoveResponseSchema,
} from "@notra/geo-core/schemas/geo-agent-products";
import { defineTool } from "eve/tools";

import {
  GEO_PRODUCT_TASK_DENIED_MESSAGE,
  GEO_PROMPTS_MOVE_FAILED_MESSAGE,
} from "../constants/analytics";
import { callDashboardGeoRoute } from "../utils/geo-dashboard";
import { requireOrganizationId } from "../utils/organization";
import { getSessionAttribute } from "../utils/session";

export function createMoveGeoPromptsTool() {
  return defineTool({
    description:
      "Move tracked custom GEO prompts into one of the project's products, or out of their product with product null. Find the prompts with find_geo_prompts first and pass their ids. Auto prompts from the brand settings can't belong to a product. unmatched lists prompts that weren't moved and why; when one lists choices, ask the user which one. An unknown product name returns the project's products. Moving prompts does not change how new prompts are filed.",
    inputSchema: moveGeoPromptsInputSchema,
    approval: (ctx) =>
      getSessionAttribute(ctx, "surface") === "task"
        ? { type: "denied", reason: GEO_PRODUCT_TASK_DENIED_MESSAGE }
        : "not-applicable",
    async execute({ projectId, prompts, product }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      try {
        return await callDashboardGeoRoute(
          GEO_PROMPTS_MOVE_INTERNAL_PATH,
          geoPromptsMoveRequestSchema.parse({
            organizationId,
            projectId,
            prompts,
            product,
          }),
          geoPromptsMoveResponseSchema
        );
      } catch (error) {
        logError("Move GEO prompts tool failed", error, { organizationId });
        return GEO_PROMPTS_MOVE_FAILED_MESSAGE;
      }
    },
  });
}
