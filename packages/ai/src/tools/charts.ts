import {
  SHOW_CHART_TOOL_NAME,
  SHOW_GEO_CHART_TOOL_NAME,
} from "@notra/ai/constants/chart-tools";
import { showChartInputSchema } from "@notra/ai/schemas/chart-artifact";
import { showGeoChartInputSchema } from "@notra/ai/schemas/geo-tools";
import type { OrganizationToolConfig } from "@notra/ai/types/organization";
import { chartToolModelOutput } from "@notra/ai/utils/chart-artifact";
import { toolDescription } from "@notra/ai/utils/description";
import { loadGeoChartForTool } from "@notra/ai/utils/geo-tool-data";
import { type Tool, tool } from "ai";

const PLACEMENT_NOTE =
  "The chart appears in your answer exactly where you call this tool: write the sentence that leads into it first, call the tool, then say what stands out. Do not list every plotted value again in text.";

export function createShowGeoChartTool(config: OrganizationToolConfig): Tool {
  return tool({
    description: toolDescription({
      toolName: SHOW_GEO_CHART_TOOL_NAME,
      intro:
        "Draws a GEO chart from live data into your answer and returns the numbers it plots.",
      whenToUse:
        "When a visual makes a GEO answer clearer: engines compares mention rate per AI engine, trend shows whether visibility rises or falls, competitors shows share of voice across brands.",
      whenNotToUse:
        "For a one-number answer, for data the user did not ask about, or to draw the same chart twice in one answer.",
      usageNotes: `${PLACEMENT_NOTE} The returned numbers are the ones on the chart, so there is no need to also call getGeoOverview, getGeoTimeseries or getGeoCompetitorShare for the same window. Omit projectId for all projects, or use an ID from listGeoProjects.`,
    }),
    inputSchema: showGeoChartInputSchema,
    execute: ({ chart, projectId, days }) =>
      loadGeoChartForTool(config.organizationId, chart, projectId, days),
    toModelOutput: ({ output }) => chartToolModelOutput(output),
  });
}

export function createShowChartTool(): Tool {
  return tool({
    description: toolDescription({
      toolName: SHOW_CHART_TOOL_NAME,
      intro: "Draws a chart from numbers you already have into your answer.",
      whenToUse:
        "When performance numbers from another tool (post reach, traffic, counts over time) read better as a chart than as a list.",
      whenNotToUse: `For GEO visibility, engines or competitors: use ${SHOW_GEO_CHART_TOOL_NAME}. For a few numbers that fit in one sentence.`,
      usageNotes: `${PLACEMENT_NOTE} Use only values other tools returned; never estimate or invent points.`,
    }),
    inputSchema: showChartInputSchema,
    execute: ({ chart }) => ({ chart }),
    toModelOutput: () => ({
      type: "text" as const,
      value: JSON.stringify({ shown_to_user: true }),
    }),
  });
}
