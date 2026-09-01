import { getGeoPromptResultsInputSchema } from "@notra/ai/schemas/geo-tools";
import { loadGeoPromptResultsForTool } from "@notra/ai/utils/geo-tool-data";
import { defineTool } from "eve/tools";

import { runGeoTool } from "../utils/geo-tool";
import { requireOrganizationId } from "../utils/organization";

export function createGetGeoPromptResultsTool() {
  return defineTool({
    description:
      "Get the latest GEO result for each tracked prompt and AI engine, including brand mention, position, sentiment, and an answer excerpt. Use to find prompts the brand wins or loses and questions that need better content. Use includeAnswers only when full answers are necessary.",
    inputSchema: getGeoPromptResultsInputSchema,
    async execute({ projectId, days, limit, includeAnswers }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      return runGeoTool("GEO prompt results", () =>
        loadGeoPromptResultsForTool(
          organizationId,
          projectId,
          days,
          limit,
          includeAnswers
        )
      );
    },
  });
}
