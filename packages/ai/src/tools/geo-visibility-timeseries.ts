import { getGeoVisibilityTimeseriesInputSchema } from "@notra/ai/schemas/geo-tools";
import type { GeoToolConfig } from "@notra/ai/types/geo-tools";
import { toolDescription } from "@notra/ai/utils/description";
import {
  queryGeoCheckTimeseries,
  toGeoCheckWindow,
} from "@notra/db/utils/geo-checks";
import { type Tool, tool } from "ai";

export function createGetGeoVisibilityTimeseriesTool(
  config: GeoToolConfig
): Tool {
  return tool({
    description: toolDescription({
      toolName: "getGeoVisibilityTimeseries",
      intro:
        "Returns daily GEO visibility performance by AI engine, including checks, mentions, mention rate, and average position.",
      whenToUse:
        "When the user asks whether AI visibility is improving or declining over time, or wants to compare trends between engines.",
      usageNotes:
        "Results cover all GEO projects in the organization for a trailing window from 1 to 365 days.",
    }),
    inputSchema: getGeoVisibilityTimeseriesInputSchema,
    execute: async ({ days }) => {
      const rows = await queryGeoCheckTimeseries(
        { organizationId: config.organizationId, projectId: null },
        toGeoCheckWindow({ days })
      );

      return {
        points: rows.map((row) => ({
          day: row.day,
          engine: row.engine,
          checks: row.checks,
          mentions: row.mentions,
          mentionRate: row.checks === 0 ? 0 : row.mentions / row.checks,
          averagePosition: row.avgPosition,
        })),
      };
    },
  });
}
