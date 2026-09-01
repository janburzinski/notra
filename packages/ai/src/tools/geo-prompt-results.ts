import { GEO_PROMPT_RESULT_MAX_ANSWER_CHARS } from "@notra/ai/constants/geo-tools";
import { getGeoPromptResultsInputSchema } from "@notra/ai/schemas/geo-tools";
import type { GeoToolConfig } from "@notra/ai/types/geo-tools";
import { toolDescription } from "@notra/ai/utils/description";
import {
  queryGeoCheckPromptResults,
  toGeoCheckWindow,
} from "@notra/db/utils/geo-checks";
import { type Tool, tool } from "ai";

export function createGetGeoPromptResultsTool(config: GeoToolConfig): Tool {
  return tool({
    description: toolDescription({
      toolName: "getGeoPromptResults",
      intro:
        "Returns the newest GEO result for each tracked prompt and AI engine, including whether the brand was mentioned, its position, sentiment, and answer excerpt.",
      whenToUse:
        "When the user asks which questions the brand wins or loses, how an AI engine answered a tracked prompt, or needs evidence for a content opportunity.",
      usageNotes:
        "Results cover all GEO projects in the organization. Optionally filter by a tracked prompt id or AI engine. Full answers are optional and truncated to keep context bounded.",
    }),
    inputSchema: getGeoPromptResultsInputSchema,
    execute: async ({ days, limit, includeAnswers, promptId, engine }) => {
      const rows = await queryGeoCheckPromptResults(
        { organizationId: config.organizationId, projectId: null },
        toGeoCheckWindow({ days }),
        { limit, promptId, engine }
      );
      const results = rows.map((row) => ({
        projectId: row.projectId,
        promptId: row.promptId,
        engine: row.engine,
        prompt: row.prompt,
        mentioned: row.mentioned,
        position: row.position,
        sentiment: row.sentiment,
        excerpt: row.excerpt,
        ...(includeAnswers
          ? {
              answer: row.answer.slice(0, GEO_PROMPT_RESULT_MAX_ANSWER_CHARS),
              answerTruncated:
                row.answer.length > GEO_PROMPT_RESULT_MAX_ANSWER_CHARS,
            }
          : {}),
        finishReason: row.finishReason,
        truncated: row.truncated,
        lastCheckedAt: row.lastCheckedAt.toISOString(),
      }));

      return {
        results,
        returnedResults: results.length,
        resultsMayBeTruncated: rows.length === limit,
      };
    },
  });
}
