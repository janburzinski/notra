import { GEO_SOURCE_DOMAIN_LIMIT } from "@notra/ai/constants/geo-tools";
import { getGeoSourcesInputSchema } from "@notra/ai/schemas/geo-tools";
import type { GeoToolConfig } from "@notra/ai/types/geo-tools";
import { toolDescription } from "@notra/ai/utils/description";
import { queryGeoCheckPromptResults, toGeoCheckWindow } from "@notra/db/utils/geo-checks";
import { type Tool, tool } from "ai";

export function createGetGeoSourcesTool(config: GeoToolConfig): Tool {
  return tool({
    description: toolDescription({
      toolName: "getGeoSources",
      intro:
        "Returns the web sources cited in the latest tracked AI answers and a count of the most frequently cited domains.",
      whenToUse:
        "When the user asks which websites influence AI answers, which domains earn citations, or what sources should inform a GEO content strategy.",
      usageNotes:
        "Optionally filter by a prompt id or AI engine returned by other GEO tools. Results cover all GEO projects in the organization.",
    }),
    inputSchema: getGeoSourcesInputSchema,
    execute: async ({ days, limit, promptId, engine }) => {
      const rows = await queryGeoCheckPromptResults(
        { organizationId: config.organizationId, projectId: null },
        toGeoCheckWindow({ days }),
      );
      const matchingRows = rows.filter(
        (row) =>
          (promptId === undefined || row.promptId === promptId) &&
          (engine === undefined || row.engine === engine),
      );
      const seen = new Set<string>();
      const sources = matchingRows
        .flatMap((row) =>
          row.grounding.sources.map((source) => ({
            promptId: row.promptId,
            engine: row.engine,
            domain: source.domain,
            title: source.title,
            url: source.url,
            lastCheckedAt: row.lastCheckedAt.toISOString(),
          })),
        )
        .filter((source) => {
          const key = `${source.promptId}:${source.engine}:${source.url}`;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
      const domainCounts = new Map<string, number>();
      for (const source of sources) {
        domainCounts.set(source.domain, (domainCounts.get(source.domain) ?? 0) + 1);
      }

      return {
        sources: sources.slice(0, limit),
        returnedSources: Math.min(sources.length, limit),
        totalSources: sources.length,
        domains: Array.from(domainCounts, ([domain, citations]) => ({
          domain,
          citations,
        }))
          .sort(
            (left, right) =>
              right.citations - left.citations || left.domain.localeCompare(right.domain),
          )
          .slice(0, GEO_SOURCE_DOMAIN_LIMIT),
        totalDomains: domainCounts.size,
      };
    },
  });
}
