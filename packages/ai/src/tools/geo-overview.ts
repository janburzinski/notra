import { GEO_OVERVIEW_COMPETITOR_LIMIT } from "@notra/ai/constants/geo-tools";
import { getGeoOverviewInputSchema } from "@notra/ai/schemas/geo-tools";
import type { GeoToolConfig } from "@notra/ai/types/geo-tools";
import { toolDescription } from "@notra/ai/utils/description";
import {
  queryGeoCheckCompetitorShare,
  queryGeoCheckOverview,
  toGeoCheckWindow,
} from "@notra/db/utils/geo-checks";
import { type Tool, tool } from "ai";

export function createGetGeoOverviewTool(config: GeoToolConfig): Tool {
  return tool({
    description: toolDescription({
      toolName: "getGeoOverview",
      intro:
        "Returns the organization's GEO (AI visibility) performance across AI engines, including mention rates, average positions, and competitor share.",
      whenToUse:
        "When the user asks how visible their brand is in ChatGPT, Claude, Gemini, or other AI answers, or which competitors AI engines recommend instead.",
      usageNotes:
        "Results cover all GEO projects in the organization. Choose a trailing window from 1 to 365 days; the default is 30 days.",
    }),
    inputSchema: getGeoOverviewInputSchema,
    execute: async ({ days }) => {
      const scope = { organizationId: config.organizationId, projectId: null };
      const window = toGeoCheckWindow({ days });
      const [overview, competitors] = await Promise.all([
        queryGeoCheckOverview(scope, window),
        queryGeoCheckCompetitorShare(scope, window, GEO_OVERVIEW_COMPETITOR_LIMIT),
      ]);

      return {
        engines: overview.map((row) => ({
          engine: row.engine,
          checks: row.checks,
          mentions: row.mentions,
          mentionRate: row.mentionRate,
          averagePosition: row.avgPosition,
          lastCheckedAt: row.lastCheckedAt.toISOString(),
        })),
        competitorShare: competitors.map((row) => ({
          brand: row.brand,
          mentions: row.mentions,
        })),
      };
    },
  });
}
