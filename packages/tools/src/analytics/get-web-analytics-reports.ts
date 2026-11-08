import { WEB_ANALYTICS_UNAVAILABLE_MESSAGE } from "@notra/ai/constants/web-analytics-access";
import { logError } from "@notra/ai/utils/server-log";
import { isWebAnalyticsEnabledForOrganization } from "@notra/ai/utils/web-analytics-access";
import { isTinybirdConfigured } from "@notra/analytics/tinybird/client";
import { WEB_UTM_DIMENSIONS } from "@notra/geo-core/constants/web-analytics";
import {
  loadWebAnalytics,
  loadWebUtm,
} from "@notra/geo-core/geo/web-analytics";
import type {
  WebAnalyticsBreakdown,
  WebAnalyticsUtmRow,
} from "@notra/geo-core/types/geo";
import { Effect } from "effect";
import { defineTool } from "eve/tools";

import {
  ANALYTICS_PROJECT_NOT_FOUND_MESSAGE,
  WEB_ANALYTICS_NOT_CONFIGURED_MESSAGE,
  WEB_ANALYTICS_QUERY_FAILED_MESSAGE,
} from "../constants/analytics";
import { getWebAnalyticsReportsInputSchema } from "../schemas/analytics-tools";
import {
  resolveAnalyticsProject,
  resolveAnalyticsRange,
} from "../utils/analytics";
import { requireOrganizationId } from "../utils/organization";

function toRows(rows: readonly WebAnalyticsBreakdown[], limit: number) {
  return rows.slice(0, limit).map((row) => ({
    value: row.value || "Unknown",
    visitors: row.visitors,
    previous_visitors: row.previousVisitors ?? null,
  }));
}

function toUtmRows(rows: readonly WebAnalyticsUtmRow[], limit: number) {
  return rows.slice(0, limit).map((row) => ({
    value: row.value,
    sessions: row.sessions,
    previous_sessions: row.previousSessions,
    visitors: row.visitors,
  }));
}

export function createGetWebAnalyticsReportsTool() {
  return defineTool({
    description:
      "Get the website analytics reports beyond traffic from Notra web analytics: outbound link clicks, Core Web Vitals from real visits (p75 of LCP, INP, CLS, FCP and TTFB), JavaScript errors reported by notra.plus.js, browser languages, sessions per UTM source, medium, campaign, term and content, and how sessions from AI assistants behave compared to other sources, with the previous period of equal length for comparison. Use for questions about outbound clicks, page speed, errors, languages or UTM campaigns; use get_web_analytics for traffic, pages, referrers and countries. Scoped to a project (default: the oldest). Returns the exact UTC date range covered.",
    inputSchema: getWebAnalyticsReportsInputSchema,
    async execute(input, ctx) {
      const organizationId = requireOrganizationId(ctx);
      if (!(await isWebAnalyticsEnabledForOrganization(organizationId))) {
        return WEB_ANALYTICS_UNAVAILABLE_MESSAGE;
      }
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
        const path = input.path ?? "";
        const { limit } = input;
        const [web, utm] = await Effect.runPromise(
          Effect.all(
            [
              loadWebAnalytics(
                scope,
                window,
                input.host,
                path,
                undefined,
                "breakdowns",
                { scriptReports: true }
              ),
              Effect.forEach(
                WEB_UTM_DIMENSIONS,
                (dimension) =>
                  loadWebUtm(
                    scope,
                    window,
                    input.host,
                    path,
                    undefined,
                    dimension
                  ).pipe(
                    Effect.map(
                      (rows) => [dimension, toUtmRows(rows, limit)] as const
                    )
                  ),
                { concurrency: "unbounded" }
              ),
            ],
            { concurrency: "unbounded" }
          )
        );
        const script = web.script;
        const empty =
          !script ||
          (script.outboundLinks.length === 0 &&
            script.vitals.length === 0 &&
            script.errors.length === 0);
        return {
          scope: {
            project,
            host: input.host ?? null,
            path: input.path ?? null,
          },
          range,
          comparison:
            "previous_* values cover the same number of days immediately before range.from.",
          outbound_links: (script?.outboundLinks ?? [])
            .slice(0, limit)
            .map((link) => ({
              url: link.url,
              clicks: link.clicks,
              previous_clicks: link.previousClicks,
              visitors: link.visitors,
            })),
          web_vitals: {
            units:
              "p75 in milliseconds; cls is the layout shift score multiplied by 1000.",
            metrics: (script?.vitals ?? []).map((vital) => ({
              metric: vital.metric,
              p75: vital.p75,
              samples: vital.samples,
            })),
          },
          errors: (script?.errors ?? []).slice(0, limit).map((error) => ({
            message: error.message,
            source: error.source,
            events: error.events,
            page_views_affected: error.views,
          })),
          languages: toRows(script?.languages ?? [], limit),
          utm: {
            note: "Sessions per UTM value, counted on each session's first page. term and content from notra.js cover at most the last 90 days. :id stands for a value that looked like an email address, a UUID or a token.",
            ...Object.fromEntries(utm),
          },
          ai_outcomes: web.outcomes.map((outcome) => ({
            source: outcome.source || "not from an AI assistant",
            sessions: outcome.sessions,
            pages_per_session: outcome.pagesPerSession,
            engaged_rate: outcome.engagedRate,
          })),
          ...(empty
            ? {
                note: "No outbound clicks, vitals or errors in this range. They need the notra.js script, and errors need notra.plus.js.",
              }
            : {}),
        };
      } catch (error) {
        logError("Web analytics reports tool failed", error, {
          organizationId,
          projectId: input.projectId,
        });
        return WEB_ANALYTICS_QUERY_FAILED_MESSAGE;
      }
    },
  });
}
