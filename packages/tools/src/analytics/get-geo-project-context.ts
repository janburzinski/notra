import { getGeoProjectContextInputSchema } from "@notra/ai/schemas/geo-tools";
import { loadGeoProjectContextForTool } from "@notra/ai/utils/geo-tool-data";
import { defineTool } from "eve/tools";

import { runGeoTool } from "../utils/geo-tool";
import { requireOrganizationId } from "../utils/organization";

export function createGetGeoProjectContextTool() {
  return defineTool({
    description:
      "Get one GEO project's brand aliases, configured competitors, tracked prompts, and latest per-engine checks. Use for detailed project-level GEO recommendations. Call list_geo_projects first and pass an exact project ID.",
    inputSchema: getGeoProjectContextInputSchema,
    async execute({ projectId, includeAnswers }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      return runGeoTool("GEO project context", () =>
        loadGeoProjectContextForTool(organizationId, projectId, includeAnswers)
      );
    },
  });
}
