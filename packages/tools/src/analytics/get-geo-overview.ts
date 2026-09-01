import { getGeoOverviewInputSchema } from "@notra/ai/schemas/geo-tools";
import { loadGeoOverviewForTool } from "@notra/ai/utils/geo-tool-data";
import { defineTool } from "eve/tools";

import { runGeoTool } from "../utils/geo-tool";
import { requireOrganizationId } from "../utils/organization";

export function createGetGeoOverviewTool() {
  return defineTool({
    description:
      "Get the organization's GEO (AI visibility) status: how often AI engines like ChatGPT, Claude, and Gemini mention the company when asked relevant questions, per engine mention rate, average position, and the competitor brands engines recommend instead. Use to inform content strategy that improves AI visibility.",
    inputSchema: getGeoOverviewInputSchema,
    async execute({ projectId, days }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      return runGeoTool("GEO overview", () =>
        loadGeoOverviewForTool(organizationId, projectId, days)
      );
    },
  });
}
