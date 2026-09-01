import { getGeoTimeseriesInputSchema } from "@notra/ai/schemas/geo-tools";
import { loadGeoTimeseriesForTool } from "@notra/ai/utils/geo-tool-data";
import { defineTool } from "eve/tools";

import { runGeoTool } from "../utils/geo-tool";
import { requireOrganizationId } from "../utils/organization";

export function createGetGeoTimeseriesTool() {
  return defineTool({
    description:
      "Get daily GEO performance per AI engine, including checks, mentions, mention rate, and average position. Use for visibility trends and engine comparisons over time. Omit projectId for all projects or use an ID from list_geo_projects.",
    inputSchema: getGeoTimeseriesInputSchema,
    async execute({ projectId, days }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      return runGeoTool("GEO timeseries", () =>
        loadGeoTimeseriesForTool(organizationId, projectId, days)
      );
    },
  });
}
