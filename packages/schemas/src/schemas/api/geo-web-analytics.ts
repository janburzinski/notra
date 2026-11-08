import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  ANALYTICS_IMPORT_KINDS,
  ANALYTICS_IMPORT_PROVIDERS,
  ANALYTICS_IMPORT_STATUSES,
} from "@notra/db/constants/analytics-imports";
import {
  GEO_SHORT_FIELD_MAX_LENGTH,
  GEO_TRAFFIC_SITES_MODES,
} from "@notra/geo-core/constants/geo";
import { WEB_VITAL_METRICS } from "@notra/geo-core/constants/web-analytics";

import {
  ANALYTICS_API_MAX_RANGE_DAYS,
  ANALYTICS_API_PATH_MAX_LENGTH,
} from "../../constants/geo-analytics-api";
import { organizationResponseSchema } from "./content";
import { geoWindowQuerySchema } from "./geo-visibility";

const DAY_MS = 86_400_000;

function utcDay(value: string): number | null {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
    ? null
    : time;
}

/**
 * Rejects impossible days, a `from` after `to` and spans over
 * {@link ANALYTICS_API_MAX_RANGE_DAYS}. An open `to` runs to today, so an old
 * `from` alone cannot ask for years of data either. Apply it last: zod
 * objects with refinements cannot be extended.
 */
function withAnalyticsRangeCap<
  T extends z.ZodType<{ from?: string; to?: string }>,
>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const from = value.from === undefined ? null : utcDay(value.from);
    const to = value.to === undefined ? null : utcDay(value.to);
    if (value.from !== undefined && from === null) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: "Not a real day",
      });
    }
    if (value.to !== undefined && to === null) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "Not a real day" });
    }
    if (from === null) {
      return;
    }
    const end = to ?? Date.now();
    if (end < from) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: "from must be on or before to",
      });
      return;
    }
    if (Math.floor((end - from) / DAY_MS) + 1 > ANALYTICS_API_MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: `A range can cover at most ${ANALYTICS_API_MAX_RANGE_DAYS} days`,
      });
    }
  });
}

const hostParam = z
  .string()
  .trim()
  .max(GEO_SHORT_FIELD_MAX_LENGTH)
  .optional()
  .openapi({
    param: { name: "host", in: "query" },
    description:
      "Hostname to filter on, such as www.example.com. Subdomains are included. Omit for every host.",
  });

const pathParam = z
  .string()
  .trim()
  .max(ANALYTICS_API_PATH_MAX_LENGTH)
  .startsWith("/")
  .optional()
  .openapi({
    param: { name: "path", in: "query" },
    description: "Only count this exact page path, such as /pricing.",
  });

const sitesParam = z
  .enum(GEO_TRAFFIC_SITES_MODES)
  .optional()
  .openapi({
    param: { name: "sites", in: "query" },
    description: "`exclude` leaves out traffic to sites hosted on Notra Sites.",
  });

/** Window plus the host, page and Notra Sites filters the dashboard offers. */
export const analyticsFilterQuerySchema = withAnalyticsRangeCap(
  geoWindowQuerySchema.extend({
    host: hostParam,
    path: pathParam,
    sites: sitesParam,
  })
);

export const analyticsWindowQuerySchema =
  withAnalyticsRangeCap(geoWindowQuerySchema);

const configuredField = z.boolean().openapi({
  description:
    "False when the analytics backend is not configured for this deployment; the payload is then empty rather than an error.",
});

const importedSchema = z
  .object({
    provider: z.enum(ANALYTICS_IMPORT_PROVIDERS),
    until: z.string().openapi({ description: "Last imported day." }),
    nativeStart: z.string().nullable().openapi({
      description: "First day Notra tracked natively, when known.",
    }),
  })
  .nullable()
  .optional()
  .openapi({
    description:
      "Latest completed history import. Days up to `until` come from it; native tracking starts the day after.",
  });

const breakdownSchema = z.object({
  value: z.string(),
  visitors: z.number().int(),
  previousVisitors: z.number().int().nullable().optional(),
});

export const webAnalyticsResponseSchema = z
  .object({
    configured: configuredField,
    imported: importedSchema,
    hosts: z.array(
      z.object({
        host: z.string(),
        siteId: z.string().openapi({
          description: "Notra Sites site id, empty for your own domains.",
        }),
        views: z.number().int(),
      })
    ),
    totals: z.object({
      views: z.number().int(),
      previousViews: z.number().int(),
      visitors: z.number().int(),
      previousVisitors: z.number().int(),
      sessions: z.number().int(),
      previousSessions: z.number().int(),
      engagedSessions: z.number().int(),
      aiVisitors: z.number().int().openapi({
        description: "Visitors who arrived from an AI assistant.",
      }),
      previousAiVisitors: z.number().int(),
    }),
    points: z.array(
      z.object({
        day: z.string(),
        views: z.number().int(),
        visitors: z.number().int(),
      })
    ),
    organization: organizationResponseSchema,
  })
  .openapi("GeoWebAnalyticsResponse");

export const webAnalyticsBreakdownsResponseSchema = z
  .object({
    configured: configuredField,
    imported: importedSchema,
    pages: z.array(
      z.object({
        host: z.string(),
        path: z.string(),
        views: z.number().int(),
        previousViews: z.number().int(),
        visitors: z.number().int(),
        landings: z.number().int(),
        aiVisitors: z.number().int(),
      })
    ),
    sources: z.array(
      z.object({
        group: z.string().openapi({
          description:
            "Referrer group: ai, direct, internal, search, social or other.",
        }),
        source: z.string(),
        aiProduct: z.string(),
        sessions: z.number().int(),
        previousSessions: z.number().int(),
        visitors: z.number().int(),
      })
    ),
    countries: z.array(breakdownSchema).openapi({
      description: "ISO 3166-1 alpha-2 country codes.",
    }),
    devices: z.array(breakdownSchema),
    outcomes: z
      .array(
        z.object({
          source: z.string().openapi({
            description:
              "AI assistant the session came from; empty for every other session.",
          }),
          sessions: z.number().int(),
          pagesPerSession: z.number(),
          engagedRate: z.number(),
        })
      )
      .openapi({
        description:
          "How sessions from AI assistants behave compared to others.",
      }),
    outboundLinks: z
      .array(
        z.object({
          url: z.string().openapi({
            description: "Destination host and path, without the query.",
          }),
          clicks: z.number().int(),
          previousClicks: z.number().int(),
          visitors: z.number().int(),
        })
      )
      .openapi({ description: "Clicks on links to other sites." }),
    vitals: z
      .array(
        z.object({
          metric: z.enum(WEB_VITAL_METRICS),
          p75: z.number().openapi({
            description:
              "75th percentile in milliseconds, or the layout shift score x1000 for cls.",
          }),
          samples: z.number().int(),
        })
      )
      .openapi({ description: "Core Web Vitals from real visits." }),
    errors: z
      .array(
        z.object({
          message: z.string().openapi({
            description:
              "Scrubbed before storage: no query strings, emails or long ids.",
          }),
          source: z.string(),
          events: z.number().int(),
          views: z.number().int(),
        })
      )
      .openapi({
        description: "JavaScript errors reported by notra.plus.js.",
      }),
    languages: z.array(breakdownSchema),
    organization: organizationResponseSchema,
  })
  .openapi("GeoWebAnalyticsBreakdownsResponse");

const journeyDailySchema = z.array(
  z.object({ day: z.string(), journeys: z.number().int() })
);

export const journeyStatsResponseSchema = z
  .object({
    configured: configuredField,
    sources: z.array(
      z.object({
        source: z.string(),
        visitorType: z.enum(["crawler", "ai_referral", "human", "unknown"]),
        journeys: z.number().int(),
        previousJourneys: z.number().int(),
        pages: z.number().int(),
        singleFetch: z.number().int(),
        deepCrawls: z.number().int(),
        lastSeenAt: z.string().nullable(),
        daily: journeyDailySchema,
      })
    ),
    pages: z.array(
      z.object({
        path: z.string(),
        journeys: z.number().int(),
        previousJourneys: z.number().int(),
        entries: z.number().int().openapi({
          description: "Journeys whose first fetch was this page.",
        }),
        lastSeenAt: z.string().nullable(),
        daily: journeyDailySchema,
      })
    ),
    totalPages: z.number().int(),
    previousTotalPages: z.number().int(),
    organization: organizationResponseSchema,
  })
  .openapi("GeoJourneyStatsResponse");

export const analyticsImportsResponseSchema = z
  .object({
    imports: z.array(
      z.object({
        id: z.string(),
        projectId: z.string(),
        provider: z.enum(ANALYTICS_IMPORT_PROVIDERS),
        kind: z.enum(ANALYTICS_IMPORT_KINDS).openapi({
          description: "web: page views; geo: AI crawler requests.",
        }),
        sourceLabel: z.string(),
        host: z.string(),
        status: z.enum(ANALYTICS_IMPORT_STATUSES),
        startDay: z.string().nullable(),
        endDay: z.string().nullable(),
        cutoffDay: z.string().nullable().openapi({
          description: "First day of native tracking; imports stop before it.",
        }),
        chunksTotal: z.number().int(),
        chunksDone: z.number().int(),
        pageviewsImported: z.number().int(),
        rowsWritten: z.number().int(),
        capabilities: z.object({
          visitors: z.boolean(),
          visits: z.boolean(),
          bounces: z.boolean(),
          utm: z.boolean(),
          entryPages: z.boolean(),
          sampled: z.boolean(),
        }),
        lastError: z.string().nullable(),
        retryAt: z.string().nullable(),
        createdAt: z.string(),
        completedAt: z.string().nullable(),
      })
    ),
    organization: organizationResponseSchema,
  })
  .openapi("GeoAnalyticsImportsResponse");
