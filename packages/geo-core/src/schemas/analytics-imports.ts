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
