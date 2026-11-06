import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  GEO_SHORT_FIELD_MAX_LENGTH,
  MCP_EVENT_STATUSES,
} from "@notra/geo-core/constants/geo";

import { organizationResponseSchema } from "./content";
import { createGeoShortTextSchema } from "./geo-fields";
import { projectParamsSchema } from "./geo-params";
import { geoWindowQuerySchema } from "./geo-visibility";
import { resourceIdSchema } from "./ids";

const AI_TRAFFIC_MAX_LOG_LIMIT = 200;
const AI_TRAFFIC_MAX_PAGES_LIMIT = 500;
const AI_TRAFFIC_MAX_JOURNEYS_LIMIT = 100;
const AI_TRAFFIC_MAX_FILTER_VALUES = 3;

const visitorTypeSchema = z.enum([
  "crawler",
  "ai_referral",
  "human",
  "unknown",
]);

const trafficLimitParam = (name: string, max: number) =>
  z.coerce
    .number()
    .int()
    .min(1)
    .max(max)
    .optional()
    .openapi({ param: { name, in: "query" } });

const trafficHostParam = () =>
  z
    .string()
    .trim()
    .max(GEO_SHORT_FIELD_MAX_LENGTH)
    .optional()
    .openapi({
      param: { name: "host", in: "query" },
      description:
        "Hostname to filter on. Subdomains of this host are included. Omit for every host.",
    });

const commaSeparated = <T extends string>(
  name: string,
  values: readonly [T, ...T[]]
) =>
  z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        : undefined
    )
    .pipe(z.array(z.enum(values)).max(AI_TRAFFIC_MAX_FILTER_VALUES).optional())
    .openapi({
      param: { name, in: "query" },
      description: `Comma-separated. One or more of: ${values.join(", ")}.`,
    });

export const trafficOverviewQuerySchema = geoWindowQuerySchema.extend({});

export const trafficLogQuerySchema = z.object({
  limit: trafficLimitParam("limit", AI_TRAFFIC_MAX_LOG_LIMIT),
  visitorTypes: commaSeparated("visitorTypes", ["crawler", "ai_referral"]),
  categories: commaSeparated("categories", [
    "training-crawler",
    "search-index",
    "assistant-browse",
  ]),
  host: trafficHostParam(),
});

export const trafficJourneysQuerySchema = geoWindowQuerySchema.extend({
  limit: trafficLimitParam("limit", AI_TRAFFIC_MAX_JOURNEYS_LIMIT),
});

export const trafficPagesQuerySchema = geoWindowQuerySchema.extend({
  limit: trafficLimitParam("limit", AI_TRAFFIC_MAX_PAGES_LIMIT),
  visitorType: z
    .enum(["crawler", "ai_referral"])
    .optional()
    .openapi({ param: { name: "visitorType", in: "query" } }),
  host: trafficHostParam(),
});

export const journeyParamsSchema = projectParamsSchema.extend({
  journeyId: z
    .string()
    .trim()
    .min(1)
    .max(GEO_SHORT_FIELD_MAX_LENGTH)
    .openapi({ param: { name: "journeyId", in: "path" } }),
});

export const trafficSourceSchema = z.object({
  source: z.string(),
  visitorType: visitorTypeSchema,
  agent: z.string(),
  category: z.string(),
  confidence: z.string(),
  visits: z.number().int(),
  previousVisits: z.number().int().optional(),
  markdownVisits: z.number().int(),
  previousMarkdownVisits: z.number().int().optional(),
  paths: z.number().int(),
  previousPaths: z.number().int().optional(),
  lastSeenAt: z.string(),
});

export const trafficPointSchema = z.object({
  day: z.string(),
  visitorType: visitorTypeSchema,
  source: z.string(),
  visits: z.number().int(),
});

export const trafficConfiguredField = z.boolean().openapi({
  description:
    "False when the traffic backend is not configured for this deployment; the payload is then empty rather than an error.",
});

export const trafficOverviewResponseSchema = z
  .object({
    configured: trafficConfiguredField,
    totals: z.object({
      crawler: z.number().int(),
      cited: z.number().int(),
      aiReferral: z.number().int(),
      conversions: z.number().int().nullable().openapi({
        description:
          "AI referral visits that reached a configured conversion path. Null when no conversion paths are set.",
      }),
    }),
    previousConversions: z.number().int().nullable().openapi({
      description:
        "Conversions in the previous window of the same length. Null when no conversion paths are set or no comparison data exists.",
    }),
    sources: z.array(trafficSourceSchema),
    points: z.array(trafficPointSchema),
    organization: organizationResponseSchema,
  })
  .openapi("GeoTrafficOverviewResponse");

const trafficLogEntrySchema = z.object({
  capturedAt: z.string(),
  visitorType: visitorTypeSchema,
  source: z.string(),
  agent: z.string(),
  category: z.string(),
  confidence: z.string(),
  path: z.string(),
  host: z.string(),
  country: z.string(),
  ua: z.string(),
  journeyId: z.string(),
  wantsMarkdown: z.boolean(),
});

export const trafficLogResponseSchema = z
  .object({
    configured: trafficConfiguredField,
    log: z.array(trafficLogEntrySchema),
    total: z.number().int(),
    organization: organizationResponseSchema,
  })
  .openapi("GeoTrafficLogResponse");

const journeySchema = z.object({
  journeyId: z.string(),
  source: z.string(),
  visitorType: visitorTypeSchema,
  pages: z.number().int(),
  distinctPaths: z.number().int(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  entryPath: z.string(),
  samplePaths: z.array(z.string()),
});

export const trafficJourneysResponseSchema = z
  .object({
    configured: trafficConfiguredField,
    journeys: z.array(journeySchema),
    organization: organizationResponseSchema,
  })
  .openapi("GeoTrafficJourneysResponse");

const journeyEventSchema = z.object({
  capturedAt: z.string(),
  path: z.string(),
  host: z.string(),
  method: z.string(),
  referer: z.string(),
  country: z.string(),
  agent: z.string(),
  category: z.string(),
});

export const journeyDetailResponseSchema = z
  .object({
    configured: trafficConfiguredField,
    events: z.array(journeyEventSchema),
    organization: organizationResponseSchema,
  })
  .openapi("GeoJourneyDetailResponse");

const trafficPageSchema = z.object({
  path: z.string(),
  host: z.string(),
  source: z.string(),
  visitorType: visitorTypeSchema,
  visits: z.number().int(),
  previousVisits: z.number().int().optional(),
  lastSeenAt: z.string(),
});

export const trafficPagesResponseSchema = z
  .object({
    configured: trafficConfiguredField,
    pages: z.array(trafficPageSchema),
    organization: organizationResponseSchema,
  })
  .openapi("GeoTrafficPagesResponse");

export const mcpToolParamsSchema = projectParamsSchema.extend({
  toolName: createGeoShortTextSchema().openapi({
    param: { name: "toolName", in: "path" },
    description: "Tool name as your MCP server registers it.",
  }),
});

const mcpStatusSchema = z.enum(MCP_EVENT_STATUSES);

const mcpIntentSchema = z.object({
  intent: z.string(),
  tool: z.string(),
  calls: z.number().int(),
  errors: z.number().int(),
});

/**
 * Captured arguments, responses, end-user IDs and sessions are left out on
 * purpose: they can hold your users' data and text written by other agents.
 * Routes parse through these schemas, so fields not listed here are dropped.
 */
export const mcpAnalyticsResponseSchema = z
  .object({
    configured: trafficConfiguredField,
    server: z
      .object({
        name: z.string(),
        version: z.string(),
        protocolVersion: z.string(),
      })
      .nullable()
      .openapi({
        description: "Server info from the newest event. Null before any.",
      }),
    totals: z.object({
      requests: z.number().int(),
      previousRequests: z.number().int(),
      toolCalls: z.number().int(),
      previousToolCalls: z.number().int(),
      errors: z.number().int(),
      previousErrors: z.number().int(),
      sessions: z.number().int(),
      previousSessions: z.number().int(),
      users: z.number().int(),
      previousUsers: z.number().int(),
      p95Ms: z.number().int(),
      previousP95Ms: z.number().int(),
    }),
    daily: z.array(
      z.object({
        day: z.string(),
        toolsCall: z.number().int(),
        resourcesRead: z.number().int(),
        promptsGet: z.number().int(),
        other: z.number().int(),
        errors: z.number().int(),
      })
    ),
    tools: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        calls: z.number().int(),
        errors: z.number().int(),
        users: z.number().int(),
        avgResponseBytes: z.number().int(),
        p50Ms: z.number().int(),
        p95Ms: z.number().int(),
        uiResource: z.string(),
      })
    ),
    clients: z.array(
      z.object({
        name: z.string(),
        sessions: z.number().int(),
        requests: z.number().int(),
        errors: z.number().int(),
        lastSeenAt: z.string(),
      })
    ),
    errorRequests: z
      .array(
        z.object({
          capturedAt: z.string(),
          clientName: z.string(),
          clientVersion: z.string(),
          method: z.string(),
          target: z.string(),
          status: mcpStatusSchema,
          errorCode: z.number().int(),
          errorMessage: z.string(),
          durationMs: z.number().int(),
          model: z.string(),
        })
      )
      .openapi({ description: "Most recent failed requests, newest first." }),
    models: z.array(
      z.object({
        name: z.string(),
        sessions: z.number().int(),
        calls: z.number().int(),
        errors: z.number().int(),
      })
    ),
    intents: z.array(mcpIntentSchema),
    elicitations: z.array(
      z.object({
        method: z.string(),
        tool: z.string(),
        requests: z.number().int(),
        accepted: z.number().int(),
        declined: z.number().int(),
        cancelled: z.number().int(),
        errors: z.number().int(),
      })
    ),
    uiRenders: z.array(
      z.object({
        resource: z.string(),
        tools: z.array(z.string()),
        renders: z.number().int(),
        sessions: z.number().int(),
        errors: z.number().int(),
      })
    ),
    catalog: z
      .object({
        listedAt: z.string(),
        unusedTools: z.array(
          z.object({ name: z.string(), description: z.string() })
        ),
      })
      .nullable()
      .openapi({
        description:
          "Tools from the latest tools/list that were never called in the window. Null before a listing is seen.",
      }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoMcpAnalyticsResponse");

const mcpToolNeighborSchema = z.object({
  tool: z.string(),
  calls: z.number().int(),
  afterFailure: z.number().int(),
});

export const mcpToolDetailResponseSchema = z
  .object({
    before: z.array(mcpToolNeighborSchema).openapi({
      description: "Tools called right before this one in the same session.",
    }),
    after: z.array(mcpToolNeighborSchema).openapi({
      description: "Tools called right after this one in the same session.",
    }),
    failures: z
      .array(
        z.object({
          message: z.string(),
          clientName: z.string(),
          status: mcpStatusSchema,
          errorCode: z.number().int(),
          calls: z.number().int(),
          lastSeenAt: z.string(),
        })
      )
      .openapi({ description: "Failures grouped by error message." }),
    intents: z.array(mcpIntentSchema),
    organization: organizationResponseSchema,
  })
  .openapi("GeoMcpToolDetailResponse");

export const ingestTokenQuerySchema = z.object({
  projectId: resourceIdSchema("projectId")
    .optional()
    .openapi({
      param: { name: "projectId", in: "query" },
      description:
        "Bind the token to one project. Omit to track the whole organization.",
    }),
});

/**
 * Install instructions without the token. The snippets reference the token's
 * environment variable, not its value, so this carries no credential and is
 * what the read-scoped setup endpoint returns.
 */
const ingestSetupFieldsSchema = z.object({
  ingestUrl: z.string().openapi({
    description: "Endpoint the tracking snippet posts events to.",
  }),
  snippet: z.string().openapi({
    description: "Install snippet for the default framework (Next.js).",
  }),
  snippets: z.object({
    next: z.string(),
    nuxt: z.string(),
    netlify: z.string(),
    tanstack: z.string(),
    astro: z.string(),
    sveltekit: z.string(),
    reactRouter: z.string(),
  }),
  drainUrls: z
    .object({
      vercel: z.string(),
      cloudflare: z.string(),
    })
    .openapi({
      description:
        "Endpoints a Vercel log drain or Cloudflare Logpush job posts request logs to, authenticated with the tracking token.",
    }),
  organization: organizationResponseSchema,
});

export const ingestSetupResponseSchema = ingestSetupFieldsSchema.openapi(
  "GeoIngestSetupResponse"
);

export const ingestTokenResponseSchema = ingestSetupFieldsSchema
  .extend({
    token: z.string().openapi({
      description:
        "Tracking token. Shown once per request; rotating invalidates every previously issued token.",
    }),
  })
  .openapi("GeoIngestTokenResponse");
