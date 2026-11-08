import { logError } from "@notra/ai/utils/server-log";
import { isTinybirdConfigured } from "@notra/analytics/tinybird/client";
import {
  loadAiTraffic,
  loadGeoTrafficPages,
} from "@notra/geo-core/geo/programs";
import { toGeoTrafficPreviousTotals } from "@notra/geo-core/utils/ai-traffic";
import { webHostFilter } from "@notra/geo-core/utils/geo-project-domains";
import { Effect } from "effect";
import { defineTool } from "eve/tools";

import {
  AI_TRAFFIC_QUERY_FAILED_MESSAGE,
  ANALYTICS_PROJECT_NOT_FOUND_MESSAGE,
  WEB_ANALYTICS_NOT_CONFIGURED_MESSAGE,
} from "../constants/analytics";
import { getAiTrafficInputSchema } from "../schemas/analytics-tools";
import {
  resolveAnalyticsProject,
  resolveAnalyticsRange,
  sumDailyAiVisits,
} from "../utils/analytics";
import { requireOrganizationId } from "../utils/organization";

export function createGetAiTrafficTool() {
  return defineTool({
    description:
      "Get AI agent traffic to the project's website from Notra AI analytics: requests from AI crawlers (such as GPTBot, ClaudeBot or PerplexityBot) and visits from people who clicked through from AI assistants (such as ChatGPT or Perplexity), with the previous period of equal length for comparison, visits per AI source, daily visits by visitor type, and the pages AI agents read most. Use for questions about AI crawlers, bots, AI referrals or which pages AI reads. Use get_web_analytics for all human visitors and get_geo_overview for how often AI assistants mention the brand. Scoped to a project (default: the oldest). Returns the exact UTC date range covered.",
    inputSchema: getAiTrafficInputSchema,
    async execute(input, ctx) {
      const organizationId = requireOrganizationId(ctx);
      if (!isTinybirdConfigured()) {
        return WEB_ANALYTICS_NOT_CONFIGURED_MESSAGE;
      }
      const range = resolveAnalyticsRange(input);
      if (typeof range === "string") {
        return range;
      }

      try {
        const project = await resolveAnalyticsProject(
          organizationId,
          input.projectId
        );
        if (!project) {
          return ANALYTICS_PROJECT_NOT_FOUND_MESSAGE;
        }
        const scope = { organizationId, projectId: project.id };
        const window = { from: range.from, to: range.to };
        const [traffic, pages] = await Effect.runPromise(
          Effect.all(
            [
              loadAiTraffic(scope, window, webHostFilter(input.host)),
              loadGeoTrafficPages(
                scope,
                window,
                input.limit,
                undefined,
                input.host
              ),
            ],
            { concurrency: "unbounded" }
          )
        );
        const { totals } = traffic;
        const previous = toGeoTrafficPreviousTotals(
          traffic.sources,
          traffic.previousConversions
        );
        return {
          scope: { project, host: input.host ?? null },
          range,
          comparison:
            "previous_* values cover the same number of days immediately before range.from.",
          totals: {
            crawler_visits: totals.crawler,
            previous_crawler_visits: previous?.crawler ?? null,
            ai_referral_visits: totals.aiReferral,
            previous_ai_referral_visits: previous?.aiReferral ?? null,
            live_assistant_fetches: totals.cited,
            previous_live_assistant_fetches: previous?.cited ?? null,
            conversions: totals.conversions,
            previous_conversions: traffic.previousConversions,
          },
          definitions:
            "crawler_visits: requests from AI crawlers. live_assistant_fetches: the part of them an AI assistant made while answering a user. ai_referral_visits: people who clicked through from an AI assistant. conversions: AI referral visits that reached a configured conversion path, null when none are set.",
          sources: traffic.sources.slice(0, input.limit).map((source) => ({
            source: source.source,
            visitor_type: source.visitorType,
            agent: source.agent,
            category: source.category,
            visits: source.visits,
            previous_visits: source.previousVisits ?? null,
            markdown_visits: source.markdownVisits,
            pages: source.paths,
            last_seen_at: source.lastSeenAt,
          })),
          daily: sumDailyAiVisits(traffic.points),
          top_pages: pages.pages.map((page) => ({
            host: page.host,
            path: page.path,
            source: page.source,
            visitor_type: page.visitorType,
            visits: page.visits,
            previous_visits: page.previousVisits ?? null,
          })),
          ...(totals.crawler + totals.aiReferral === 0
            ? {
                note: "No AI agent traffic in this range. The Notra middleware, log drain or notra.js may not be installed on this site yet.",
              }
            : {}),
        };
      } catch (error) {
        logError("AI traffic tool failed", error, {
          organizationId,
          projectId: input.projectId,
        });
        return AI_TRAFFIC_QUERY_FAILED_MESSAGE;
      }
    },
  });
}
