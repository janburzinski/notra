import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  ANALYTICS_IMPORT_KINDS,
  ANALYTICS_IMPORT_PROVIDERS,
  ANALYTICS_IMPORT_STATUSES,
} from "@notra/db/constants/analytics-imports";
import {
  AI_TRAFFIC_DEFAULT_DAYS,
  GEO_SHORT_FIELD_MAX_LENGTH,
  GEO_TRAFFIC_SITES_MODES,
} from "@notra/geo-core/constants/geo";
import {
  WEB_DEFAULT_DAYS,
  WEB_UTM_DIMENSIONS,
  WEB_VITAL_METRICS,
} from "@notra/geo-core/constants/web-analytics";
import { withAnalyticsRangeCap } from "@notra/geo-core/utils/analytics-range-cap";

import { ANALYTICS_API_PATH_MAX_LENGTH } from "../../constants/geo-analytics-api";
import { organizationResponseSchema } from "./content";
import { createGeoWindowQuerySchema } from "./geo-visibility";

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

const analyticsFilterQueryBaseSchema = createGeoWindowQuerySchema(
  WEB_DEFAULT_DAYS
).extend({
  host: hostParam,
  path: pathParam,
  sites: sitesParam,
});

/** Window plus the host, page and Notra Sites filters the dashboard offers. */
export const analyticsFilterQuerySchema = withAnalyticsRangeCap(
  analyticsFilterQueryBaseSchema
);

export const webAnalyticsUtmQuerySchema = withAnalyticsRangeCap(
  analyticsFilterQueryBaseSchema.extend({
    dimension: z.enum(WEB_UTM_DIMENSIONS).openapi({
      param: { name: "dimension", in: "query" },
      description: "UTM parameter to group sessions by.",
    }),
  })
);

export const analyticsWindowQuerySchema = withAnalyticsRangeCap(
  createGeoWindowQuerySchema(AI_TRAFFIC_DEFAULT_DAYS)
);

const configuredField = z.boolean().openapi({
  description:
    "False when the analytics backend is not configured for this deployment; the payload is then empty rather than an error.",
});

const importedSchema = z
  .object({
    provider: z.enum(ANALYTICS_IMPORT_PROVIDERS).openapi({
      description: "Analytics provider the history was imported from.",
    }),
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
  value: z.string().openapi({
    description:
      "Breakdown value, which is a country code, device class or browser language depending on the list.",
  }),
  visitors: z.number().int().openapi({
    description: "Visitors in the window.",
  }),
  previousVisitors: z.number().int().nullable().optional().openapi({
    description:
      "Visitors in the previous window of the same length, immediately before this one. Returned on every row; 0 when there were none. Null when the row is read from visits Notra keeps for 90 days (languages, or any breakdown filtered to a path) and the previous window starts before them.",
  }),
});

export const webAnalyticsResponseSchema = z
  .object({
    configured: configuredField,
    imported: importedSchema,
    hosts: z
      .array(
        z.object({
          host: z.string().openapi({ description: "Hostname." }),
          siteId: z.string().openapi({
            description: "Notra Sites site id, empty for your own domains.",
          }),
          views: z.number().int().openapi({
            description:
              "Human page views in the window; 0 for a Notra Sites site that only has AI traffic.",
          }),
        })
      )
      .openapi({
        description:
          "Hosts with page views in the window, ignoring the host filter, most viewed first.",
      }),
    totals: z
      .object({
        views: z.number().int().openapi({
          description:
            "Human page views in the window, including imported history.",
        }),
        previousViews: z.number().int().openapi({
          description:
            "Page views in the previous window of the same length, immediately before this one.",
        }),
        visitors: z.number().int().openapi({
          description: "Unique human visitors in the window.",
        }),
        previousVisitors: z.number().int().openapi({
          description:
            "Unique visitors in the previous window of the same length.",
        }),
        sessions: z.number().int().openapi({
          description: "Sessions, counted on each session's first page.",
        }),
        previousSessions: z.number().int().openapi({
          description: "Sessions in the previous window of the same length.",
        }),
        engagedSessions: z.number().int().openapi({
          description:
            "Sessions that viewed at least two pages. For imported history, visits minus bounces.",
        }),
        aiVisitors: z.number().int().openapi({
          description: "Visitors who arrived from an AI assistant.",
        }),
        previousAiVisitors: z.number().int().openapi({
          description:
            "AI-referred visitors in the previous window of the same length.",
        }),
      })
      .openapi({ description: "Totals for the whole window." }),
    points: z
      .array(
        z.object({
          day: z.string().openapi({ description: "UTC day (YYYY-MM-DD)." }),
          views: z
            .number()
            .int()
            .openapi({ description: "Human page views that day." }),
          visitors: z
            .number()
            .int()
            .openapi({ description: "Unique visitors that day." }),
        })
      )
      .openapi({
        description:
          "Daily human page views and unique visitors, including imported history.",
      }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoWebAnalyticsResponse", {
    description:
      "Human web analytics totals, daily views and hosts for the window.",
  });

export const webAnalyticsBreakdownsResponseSchema = z
  .object({
    configured: configuredField,
    imported: importedSchema,
    pages: z
      .array(
        z.object({
          host: z.string().openapi({ description: "Hostname of the page." }),
          path: z.string().openapi({ description: "Page path." }),
          views: z
            .number()
            .int()
            .openapi({ description: "Human page views in the window." }),
          previousViews: z.number().int().openapi({
            description:
              "Views in the previous window of the same length, immediately before this one.",
          }),
          visitors: z
            .number()
            .int()
            .openapi({ description: "Unique visitors to this page." }),
          landings: z.number().int().openapi({
            description: "Sessions that started on this page.",
          }),
          aiVisitors: z.number().int().openapi({
            description:
              "Visitors referred by an AI assistant. Imported history does not contribute.",
          }),
        })
      )
      .openapi({ description: "Top 50 pages by human views." }),
    sources: z
      .array(
        z.object({
          group: z.string().openapi({
            description:
              "Referrer group of the session's first page: ai, direct, search, social or other. Internal referrals are left out.",
          }),
          source: z.string().openapi({
            description:
              "Referrer name, such as a search engine, social network, AI assistant or referring host, or empty for direct traffic.",
          }),
          aiProduct: z.string().openapi({
            description:
              "Company behind the AI source, such as openai, anthropic, google or microsoft; the source itself when Notra has no mapping. Empty for non-AI groups.",
          }),
          sessions: z.number().int().openapi({
            description: "Sessions whose first page had this referrer.",
          }),
          previousSessions: z.number().int().nullable().openapi({
            description:
              "Sessions in the previous window of the same length. Null when filtered to a path and the previous window starts before the 90 days of visits Notra keeps.",
          }),
          visitors: z
            .number()
            .int()
            .openapi({ description: "Unique visitors from this source." }),
        })
      )
      .openapi({
        description:
          "Top 25 referrer sources by sessions. With a path, only sessions that landed on it.",
      }),
    countries: z.array(breakdownSchema).openapi({
      description: "Top 8 ISO 3166-1 alpha-2 country codes by visitors.",
    }),
    devices: z.array(breakdownSchema).openapi({
      description: "Top 8 device classes by visitors.",
    }),
    outcomes: z
      .array(
        z.object({
          source: z.string().openapi({
            description:
              "AI source the session landed from. The row with an empty source covers all sessions, AI-referred ones included.",
          }),
          sessions: z
            .number()
            .int()
            .openapi({ description: "Sessions in the window." }),
          pagesPerSession: z.number().openapi({
            description: "Average page views per session.",
          }),
          engagedRate: z.number().openapi({
            description:
              "Share of sessions that viewed two or more pages, from 0 to 1.",
          }),
        })
      )
      .openapi({
        description:
          "How sessions from each AI source behave compared to all sessions. Native tracking only, without imported history.",
      }),
    outboundLinks: z
      .array(
        z.object({
          url: z.string().openapi({
            description: "Destination host and path, without the query.",
          }),
          clicks: z
            .number()
            .int()
            .openapi({ description: "Clicks in the window." }),
          previousClicks: z.number().int().nullable().openapi({
            description:
              "Clicks in the previous window of the same length, immediately before this one. Null when that window starts before the 90 days of clicks Notra keeps.",
          }),
          visitors: z.number().int().openapi({
            description: "Unique visitors who clicked.",
          }),
        })
      )
      .openapi({
        description:
          "Top 25 clicked links to other sites, reported by notra.js.",
      }),
    vitals: z
      .array(
        z.object({
          metric: z.enum(WEB_VITAL_METRICS).openapi({
            description:
              "Web Vital the row measures, which is largest contentful paint, interaction to next paint, cumulative layout shift, first contentful paint or time to first byte.",
          }),
          p75: z.number().openapi({
            description:
              "75th percentile in milliseconds, or the layout shift score x1000 for cls.",
          }),
          samples: z.number().int().openapi({
            description: "Page views that reported this metric.",
          }),
        })
      )
      .openapi({
        description:
          "Core Web Vitals from real visits across all devices. Each page view counts once with its largest reported value.",
      }),
    errors: z
      .array(
        z.object({
          message: z.string().openapi({
            description:
              "Scrubbed before storage: no query strings, emails or long ids.",
          }),
          source: z.string().openapi({
            description:
              "URL of the script that threw, without query or fragment, or empty when unknown.",
          }),
          events: z.number().int().openapi({
            description: "Times this error was reported.",
          }),
          views: z.number().int().openapi({
            description: "Distinct page views that reported this error.",
          }),
        })
      )
      .openapi({
        description:
          "Top 25 JavaScript errors reported by notra.plus.js, by count.",
      }),
    languages: z.array(breakdownSchema).openapi({
      description: "Top 8 browser languages by visitors, reported by notra.js.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoWebAnalyticsBreakdownsResponse", {
    description:
      "Human web analytics broken down by page, referrer, country, device and more.",
  });

export const webAnalyticsUtmResponseSchema = z
  .object({
    dimension: z.enum(WEB_UTM_DIMENSIONS).openapi({
      description: "UTM parameter the rows break down.",
    }),
    rows: z
      .array(
        z.object({
          value: z.string().openapi({
            description:
              "Source and medium are lowercased. Campaign, term and content values that look like an email address, a UUID or a token are reported as `:id`.",
          }),
          sessions: z.number().int().openapi({
            description: "Sessions whose first page carried this UTM value.",
          }),
          previousSessions: z.number().int().nullable().openapi({
            description:
              "Sessions in the previous window of the same length, immediately before this one. Null when read from visits Notra keeps for 90 days (term, content, or any parameter filtered to a path) and the previous window starts before them.",
          }),
          visitors: z
            .number()
            .int()
            .openapi({ description: "Unique visitors with this UTM value." }),
        })
      )
      .openapi({
        description: "One row per UTM value, most sessions first.",
      }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoWebAnalyticsUtmResponse", {
    description: "Sessions and visitors per value of one UTM parameter.",
  });

const journeyDailySchema = z
  .array(
    z.object({
      day: z.string().openapi({ description: "UTC day (YYYY-MM-DD)." }),
      journeys: z
        .number()
        .int()
        .openapi({ description: "Journeys that started that day." }),
    })
  )
  .openapi({
    description:
      "Journeys per UTC day in the window, by the day they started. Days without journeys are omitted.",
  });

export const journeyStatsResponseSchema = z
  .object({
    configured: configuredField,
    sources: z
      .array(
        z.object({
          source: z.string().openapi({
            description:
              "Crawler name for crawlers, or the AI assistant a referral came from.",
          }),
          visitorType: z
            .enum(["crawler", "ai_referral", "human", "unknown"])
            .openapi({
              description:
                "Kind of AI traffic, where crawler means an AI bot fetched pages and ai_referral means a person arrived from an AI assistant's link.",
            }),
          journeys: z.number().int().openapi({
            description: "Journeys that started in the window.",
          }),
          previousJourneys: z.number().int().openapi({
            description:
              "Journeys that started in the previous window of the same length, immediately before this one.",
          }),
          pages: z.number().int().openapi({
            description: "Requests across the window's journeys.",
          }),
          singleFetch: z.number().int().openapi({
            description: "Journeys with a single request.",
          }),
          deepCrawls: z.number().int().openapi({
            description: "Journeys with 10 or more requests.",
          }),
          lastSeenAt: z.string().nullable().openapi({
            description:
              "Latest request of a journey that started in the window. Null when none started in the window.",
          }),
          daily: journeyDailySchema,
        })
      )
      .openapi({
        description:
          "AI crawler and AI referral journeys per source, most journeys first. A journey belongs to the window it started in.",
      }),
    pages: z
      .array(
        z.object({
          path: z.string().openapi({
            description: "Path without query string or trailing slash.",
          }),
          journeys: z.number().int().openapi({
            description:
              "Journeys started in the window that fetched this page.",
          }),
          previousJourneys: z.number().int().openapi({
            description:
              "Journeys started in the previous window of the same length that fetched this page.",
          }),
          entries: z.number().int().openapi({
            description: "Journeys whose first fetch was this page.",
          }),
          lastSeenAt: z.string().nullable().openapi({
            description:
              "Latest request of a journey that started in the window. Null when none started in the window.",
          }),
          daily: journeyDailySchema,
        })
      )
      .openapi({
        description:
          "Up to 500 pages fetched in the window's journeys, most journeys first.",
      }),
    totalPages: z.number().int().openapi({
      description:
        "Distinct pages fetched by journeys in the window, before the 500-page cap.",
    }),
    previousTotalPages: z.number().int().openapi({
      description: "Distinct pages fetched by journeys in the previous window.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoJourneyStatsResponse", {
    description:
      "AI crawler and AI referral journey counts per source and per page.",
  });

export const analyticsImportsResponseSchema = z
  .object({
    imports: z
      .array(
        z.object({
          id: z.string().openapi({ description: "Import id." }),
          projectId: z
            .string()
            .openapi({ description: "Project the history is imported into." }),
          provider: z.enum(ANALYTICS_IMPORT_PROVIDERS).openapi({
            description: "Analytics provider the history comes from.",
          }),
          kind: z.enum(ANALYTICS_IMPORT_KINDS).openapi({
            description: "web: page views; geo: AI crawler requests.",
          }),
          sourceLabel: z.string().openapi({
            description:
              "Name of the site in the source provider, or its reference when it has no name.",
          }),
          host: z.string().openapi({
            description:
              "Hostname the import was set up for. Imported rows without a hostname are counted under it; Plausible and Cloudflare imports also write rows for its subdomains.",
          }),
          status: z.enum(ANALYTICS_IMPORT_STATUSES).openapi({
            description:
              "Progress of the import, where waiting_rate_limit means the provider's rate limit paused it until retryAt and deleting means Notra is removing the imported rows.",
          }),
          startDay: z.string().nullable().openapi({
            description: "First day the import covers.",
          }),
          endDay: z.string().nullable().openapi({
            description: "Last day the import covers.",
          }),
          cutoffDay: z.string().nullable().openapi({
            description:
              "First day of native tracking; imports stop before it.",
          }),
          chunksTotal: z.number().int().openapi({
            description:
              "Date-range chunks the import is split into. 0 until planned.",
          }),
          chunksDone: z.number().int().openapi({
            description: "Chunks imported so far.",
          }),
          pageviewsImported: z.number().int().openapi({
            description: "Page views imported so far across finished chunks.",
          }),
          rowsWritten: z.number().int().openapi({
            description:
              "Analytics rows written so far across finished chunks.",
          }),
          capabilities: z
            .object({
              visitors: z.boolean().openapi({
                description: "Whether it supplies unique visitors.",
              }),
              visits: z.boolean().openapi({
                description:
                  "Whether the provider supplies visits, which it calls sessions.",
              }),
              bounces: z
                .boolean()
                .openapi({ description: "Whether it supplies bounces." }),
              utm: z.boolean().openapi({
                description: "Whether it supplies UTM breakdowns.",
              }),
              entryPages: z
                .boolean()
                .openapi({ description: "Whether it supplies entry pages." }),
              sampled: z.boolean().openapi({
                description:
                  "True when the provider reports estimates extrapolated from sampled data rather than exact counts (both Cloudflare providers).",
              }),
            })
            .openapi({
              description:
                "Metrics the provider can supply; metrics it cannot supply read as 0.",
            }),
          lastError: z.string().nullable().openapi({
            description:
              "Why the import failed or is waiting. Cleared when a chunk succeeds.",
          }),
          retryAt: z.string().nullable().openapi({
            description:
              "When a waiting import resumes (ISO timestamp). Null unless the status is waiting_rate_limit.",
          }),
          createdAt: z.string().openapi({
            description: "ISO timestamp when the import was created.",
          }),
          completedAt: z.string().nullable().openapi({
            description:
              "ISO timestamp when the import finished, or null until completed.",
          }),
        })
      )
      .openapi({
        description: "History imports that are not deleted, newest first.",
      }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoAnalyticsImportsResponse", {
    description:
      "Analytics history imports for the project and their progress.",
  });
