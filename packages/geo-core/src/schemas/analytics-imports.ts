import { z } from "zod";

const cell = z.union([z.string(), z.number(), z.null()]);

export const plausibleQueryResponseSchema = z.object({
  results: z.array(
    z.object({ dimensions: z.array(cell), metrics: z.array(cell) })
  ),
  meta: z
    .object({ total_rows: z.number().optional() })
    .passthrough()
    .optional(),
});

export const plausibleSitesResponseSchema = z.object({
  sites: z.array(z.object({ domain: z.string() }).passthrough()),
  meta: z
    .object({ after: z.string().nullable().optional() })
    .passthrough()
    .optional(),
});

export function cloudflareListResponseSchema<TItem extends z.ZodType>(
  item: TItem
) {
  return z.object({
    success: z.boolean(),
    result: z.array(item).nullable(),
    result_info: z
      .object({ page: z.number(), total_pages: z.number() })
      .partial()
      .optional(),
  });
}

export const cloudflareZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  account: z.object({ id: z.string().nullish() }).nullish(),
});

/** Sites have no host of their own: it is on the measuring rule, or the zone. */
export const cloudflareRumSiteSchema = z.object({
  site_tag: z.string(),
  rules: z.array(z.object({ host: z.string().nullish() })).nullish(),
  ruleset: z.object({ zone_name: z.string().nullish() }).nullish(),
});

export const cloudflareGraphqlResponseSchema = z.object({
  data: z.unknown().nullable().optional(),
  errors: z
    .array(
      z
        .object({
          message: z.string(),
          extensions: z
            .object({ code: z.string().optional() })
            .passthrough()
            .optional(),
        })
        .passthrough()
    )
    .nullable()
    .optional(),
});

export const cloudflareDatasetSettingsSchema = z.object({
  enabled: z.boolean(),
  notOlderThan: z.number().positive(),
  maxDuration: z.number().positive(),
});

export const cloudflareCrawlerGroupSchema = z.object({
  count: z.number(),
  avg: z
    .object({ sampleInterval: z.number().nullable() })
    .nullable()
    .optional(),
  dimensions: z.object({
    date: z.string(),
    clientRequestHTTPHost: z.string(),
    clientRequestPath: z.string(),
    userAgent: z.string(),
    verifiedBotCategory: z.string().nullable().optional(),
    edgeResponseStatus: z.number(),
  }),
});

export const cloudflareRumGroupSchema = z.object({
  count: z.number(),
  sum: z.object({ visits: z.number() }).nullable().optional(),
  dimensions: z.record(z.string(), z.union([z.string(), z.number()])),
});

export const vercelAggregateResponseSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
});

export const vercelProjectsResponseSchema = z.object({
  projects: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        targets: z
          .object({
            production: z
              .object({ alias: z.array(z.string()).optional() })
              .passthrough()
              .nullable()
              .optional(),
          })
          .passthrough()
          .nullable()
          .optional(),
      })
      .passthrough()
  ),
  pagination: z
    .object({ next: z.number().nullable().optional() })
    .passthrough()
    .optional(),
});

const rybbitCount = z.number();
/** Rybbit's rates are null for a group without sessions. */
const rybbitRate = z
  .number()
  .nullish()
  .transform((value) => value ?? 0);

export const rybbitOrganizationsResponseSchema = z.array(
  z
    .object({
      id: z.string(),
      name: z.string().nullish(),
      sites: z
        .array(
          z
            .object({
              id: z.union([z.string(), z.number()]).optional(),
              siteId: z.union([z.string(), z.number()]).optional(),
              name: z.string().nullish(),
              domain: z.string().nullish(),
            })
            .passthrough()
        )
        .default([]),
    })
    .passthrough()
);

export const rybbitTimeSeriesResponseSchema = z.object({
  data: z.array(
    z
      .object({
        time: z.string(),
        sessions: rybbitCount,
        pageviews: rybbitCount,
        users: rybbitCount,
        bounce_rate: rybbitRate,
        session_duration: rybbitRate,
      })
      .passthrough()
  ),
});

export const rybbitMetricResponseSchema = z.object({
  data: z.object({
    data: z.array(
      z
        .object({
          value: z.union([z.string(), z.number()]).nullish(),
          count: rybbitCount,
          pageviews: rybbitCount,
          bounce_rate: rybbitRate,
        })
        .passthrough()
    ),
  }),
});

export const databuddyWebsitesResponseSchema = z.object({
  websites: z.array(
    z
      .object({
        id: z.string(),
        name: z.string().nullish(),
        domain: z.string().nullish(),
        organizationName: z.string().nullish(),
      })
      .passthrough()
  ),
});

/** Rates and medians are null on a day without sessions. */
const databuddyRate = z
  .number()
  .nullish()
  .transform((value) => value ?? 0);

export const databuddyDaySchema = z
  .object({
    date: z.string(),
    pageviews: z.number(),
    visitors: z.number(),
    sessions: z.number(),
    bounce_rate: databuddyRate,
    median_session_duration: databuddyRate,
  })
  .passthrough();

export const databuddyBreakdownRowSchema = z
  .object({
    name: z.union([z.string(), z.number()]).nullish(),
    pageviews: z.number(),
    visitors: z.number(),
    domain: z.string().nullish(),
    country_code: z.string().nullish(),
  })
  .passthrough();

/**
 * One result per query id. A query that failed on Databuddy's side comes
 * back with `success: false` inside an HTTP 200, sorted last.
 */
export const databuddyQueryResponseSchema = z.object({
  data: z.array(
    z
      .object({
        parameter: z.string(),
        success: z.boolean(),
        error: z.string().nullish(),
        data: z.array(z.unknown()).default([]),
      })
      .passthrough()
  ),
});

export const posthogOrganizationsResponseSchema = z.object({
  results: z.array(
    z
      .object({
        id: z.string(),
        name: z.string().nullish(),
        teams: z
          .array(
            z
              .object({
                id: z.number().int(),
                name: z.string().nullish(),
                is_demo: z.boolean().nullish(),
              })
              .passthrough()
          )
          .default([]),
      })
      .passthrough()
  ),
});

/** A HogQL query's rows, positional in the order the SELECT names them. */
export const posthogQueryResponseSchema = z.object({
  results: z.array(z.array(z.unknown())),
});

export const plausibleCredentialsSchema = z.object({
  apiKey: z.string().trim().min(10).max(500),
});

export const cloudflareCredentialsSchema = z.object({
  apiToken: z.string().trim().min(20).max(500),
});

export const vercelCredentialsSchema = z.object({
  token: z.string().trim().min(10).max(500),
  teamId: z
    .string()
    .trim()
    .regex(/^team_[A-Za-z0-9]+$/)
    .optional(),
});

export const databuddyCredentialsSchema = z.object({
  apiKey: z.string().trim().min(10).max(200),
});

export const posthogCredentialsSchema = z.object({
  apiKey: z.string().trim().min(10).max(500),
  region: z.enum(["us", "eu"]).optional(),
});

export const rybbitCredentialsSchema = z.object({
  apiKey: z.string().trim().min(10).max(500),
});

/**
 * An error body as analytics providers send it: Vercel's
 * `{ error: { message, invalidToken, missingToken, scope } }`, or a plain
 * `{ error }` / `{ message }` string.
 */
export const authErrorBodySchema = z.object({
  error: z
    .union([
      z.string(),
      z.object({
        message: z.string().optional(),
        invalidToken: z.boolean().optional(),
        missingToken: z.boolean().optional(),
        scope: z.string().optional(),
      }),
    ])
    .optional(),
  message: z.string().optional(),
});
