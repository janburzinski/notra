import { listGeoProjectsInputSchema } from "@notra/ai/schemas/geo-tools";
import { loadGeoProjectsForTool } from "@notra/ai/utils/geo-tool-data";
import { defineTool } from "eve/tools";

import { runGeoTool } from "../utils/geo-tool";
import { requireOrganizationId } from "../utils/organization";

export function createListGeoProjectsTool() {
  return defineTool({
    description:
      "List the organization's GEO projects with project IDs, names, company names, tracking status, and latest scan time. Use before project-specific GEO tools when the user has not clearly identified a project. Never guess a project ID.",
    inputSchema: listGeoProjectsInputSchema,
    async execute(_input, ctx) {
      const organizationId = requireOrganizationId(ctx);
      return runGeoTool("GEO project list", () =>
        loadGeoProjectsForTool(organizationId)
      );
    },
  });
}
