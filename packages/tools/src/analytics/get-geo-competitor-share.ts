import { getGeoCompetitorShareInputSchema } from "@notra/ai/schemas/geo-tools";
import { loadGeoCompetitorShareForTool } from "@notra/ai/utils/geo-tool-data";
import { defineTool } from "eve/tools";

import { runGeoTool } from "../utils/geo-tool";
import { requireOrganizationId } from "../utils/organization";

export function createGetGeoCompetitorShareTool() {
  return defineTool({
    description:
      "Rank competitor brands by how often AI engines mention them in tracked GEO answers. Use to identify competitors that dominate AI recommendations. Omit projectId for all projects or use an ID from list_geo_projects.",
    inputSchema: getGeoCompetitorShareInputSchema,
    async execute({ projectId, days, limit }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      return runGeoTool("GEO competitor share", () =>
        loadGeoCompetitorShareForTool(organizationId, projectId, days, limit)
      );
    },
  });
}
