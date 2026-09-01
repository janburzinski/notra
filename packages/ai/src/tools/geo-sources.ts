import {
  GEO_SOURCE_DOMAIN_LIMIT,
  GEO_SOURCES_MAX_SCANNED_RESULTS,
  GEO_SOURCES_ROW_SCAN_MULTIPLIER,
} from "@notra/ai/constants/geo-tools";
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
      const rowScanLimit = Math.min(
        limit * GEO_SOURCES_ROW_SCAN_MULTIPLIER,
        GEO_SOURCES_MAX_SCANNED_RESULTS,
      );
      const rows = await queryGeoCheckPromptResults(
        { organizationId: config.organizationId, projectId: null },
        toGeoCheckWindow({ days }),
        { limit: rowScanLimit, promptId, engine },
      );
      const seen = new Set<string>();
      const sources = rows
        .flatMap((row) =>
          row.grounding.sources.map((source) => ({
            projectId: row.projectId,
            promptId: row.promptId,
            engine: row.engine,
            domain: source.domain,
            title: source.title,
            url: source.url,
            lastCheckedAt: row.lastCheckedAt.toISOString(),
          })),
        )
        .filter((source) => {
          const key = `${source.projectId}:${source.promptId}:${source.engine}:${source.url}`;
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
        resultsMayBeTruncated: sources.length > limit || rows.length === rowScanLimit,
        domains: Array.from(domainCounts, ([domain, citations]) => ({
          domain,
          citations,
        }))
          .sort(
            (left, right) =>
              right.citations - left.citations || left.domain.localeCompare(right.domain),
          )
          .slice(0, GEO_SOURCE_DOMAIN_LIMIT),
      };
    },
  });
}
