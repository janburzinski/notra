import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  AI_TRAFFIC_DEFAULT_DAYS,
  AI_TRAFFIC_DEFAULT_JOURNEYS_LIMIT,
  AI_TRAFFIC_DEFAULT_LOG_LIMIT,
  AI_TRAFFIC_DEFAULT_PAGES_LIMIT,
  GEO_SHORT_FIELD_MAX_LENGTH,
  MCP_ANALYTICS_DEFAULT_DAYS,
  MCP_EVENT_STATUSES,
} from "@notra/geo-core/constants/geo";

import { organizationResponseSchema } from "./content";
import { createGeoShortTextSchema } from "./geo-fields";
import { projectParamsSchema } from "./geo-params";
import { createGeoWindowQuerySchema } from "./geo-visibility";
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

const trafficLimitParam = (name: string, max: number, defaultLimit: number) =>
  z.coerce
    .number()
    .int()
    .min(1)
    .max(max)
    .optional()
    .openapi({
      param: { name, in: "query" },
      description: `Maximum rows to return. Defaults to ${defaultLimit}.`,
    });

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

export const trafficOverviewQuerySchema = createGeoWindowQuerySchema(
  AI_TRAFFIC_DEFAULT_DAYS
);

export const mcpAnalyticsQuerySchema = createGeoWindowQuerySchema(
  MCP_ANALYTICS_DEFAULT_DAYS
);

export const trafficLogQuerySchema = z.object({
  limit: trafficLimitParam(
    "limit",
    AI_TRAFFIC_MAX_LOG_LIMIT,
    AI_TRAFFIC_DEFAULT_LOG_LIMIT
  ),
  visitorTypes: commaSeparated("visitorTypes", ["crawler", "ai_referral"]),
  categories: commaSeparated("categories", [
    "training-crawler",
    "search-index",
    "assistant-browse",
  ]),
  host: trafficHostParam(),
});

export const trafficJourneysQuerySchema = trafficOverviewQuerySchema.extend({
  limit: trafficLimitParam(
    "limit",
    AI_TRAFFIC_MAX_JOURNEYS_LIMIT,
    AI_TRAFFIC_DEFAULT_JOURNEYS_LIMIT
  ),
});

export const trafficPagesQuerySchema = trafficOverviewQuerySchema.extend({
  limit: trafficLimitParam(
    "limit",
    AI_TRAFFIC_MAX_PAGES_LIMIT,
    AI_TRAFFIC_DEFAULT_PAGES_LIMIT
  ),
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
    .openapi({
      param: { name: "journeyId", in: "path" },
      description: "Journey id from the traffic log or journeys list.",
    }),
});

const visitorTypeField = visitorTypeSchema.openapi({
  description:
    "crawler: an AI bot fetched the page. ai_referral: a person arrived from an AI assistant's link.",
});

const sourceField = z.string().openapi({
  description:
    "Crawler name for crawlers, or the AI assistant a referral came from.",
});

const agentField = z.string().openapi({
  description: "Crawler that made the request. Empty for referrals.",
});

const categoryField = z.string().openapi({
  description:
    "Request purpose, such as training-crawler, search-index or assistant-browse (an assistant reading the page live to answer). assistant-referral for referrals.",
});

const confidenceField = z.string().openapi({
  description:
    "How the visitor was identified. verified: a crawler user agent whose operator publishes a way to verify it, such as IP ranges; Notra matches the user agent and does not check the IP. reported: a user agent the operator documents without verification, a known request fingerprint, a fetch of a machine-readable file, or, for AI referrals, the referrer. Sources detected only by heuristics are left out of these endpoints.",
});

const previousWindowNote =
  "in the previous window of the same length, right before this one";

const utcTimestampField = (subject: string, note = "") =>
  z.string().openapi({
    description: `UTC time of ${subject}, formatted \`YYYY-MM-DD HH:MM:SS\` with no time zone suffix.${note}`,
  });

const importedDayNote = " Midnight of the day for imported history.";

export const trafficSourceSchema = z.object({
  source: sourceField,
  visitorType: visitorTypeField,
  agent: agentField,
  category: categoryField,
  confidence: confidenceField,
  visits: z.number().int().openapi({
    description: "Requests in the window, including imported history.",
  }),
  previousVisits: z
    .number()
    .int()
    .optional()
    .openapi({
      description: `Requests ${previousWindowNote}.`,
    }),
  markdownVisits: z.number().int().openapi({
    description:
      "Requests that asked for Markdown or a machine-readable file. 0 when filtering by host or path, and for imported history.",
  }),
  previousMarkdownVisits: z
    .number()
    .int()
    .optional()
    .openapi({
      description: `Markdown requests ${previousWindowNote}.`,
    }),
  paths: z.number().int().openapi({
    description: "Distinct page paths requested in the window.",
  }),
  previousPaths: z
    .number()
    .int()
    .optional()
    .openapi({
      description: `Distinct paths ${previousWindowNote}.`,
    }),
  lastSeenAt: utcTimestampField(
    "the newest request in the window",
    `${importedDayNote} \`1970-01-01 00:00:00\` when the source only had requests in the previous window.`
  ),
});

export const trafficPointSchema = z.object({
  day: z.string().openapi({ description: "UTC day (YYYY-MM-DD)." }),
  visitorType: visitorTypeField,
  source: sourceField,
  visits: z.number().int().openapi({
    description: "Requests from this source on this day.",
  }),
});

export const trafficConfiguredField = z.boolean().openapi({
  description:
    "False when the traffic backend is not configured for this deployment; the payload is then empty rather than an error.",
});

export const trafficOverviewResponseSchema = z
  .object({
    configured: trafficConfiguredField,
    totals: z
      .object({
        crawler: z.number().int().openapi({
          description: "Requests from AI crawlers in the window.",
        }),
        cited: z.number().int().openapi({
          description:
            "Crawler requests with category assistant-browse: assistants reading pages live while answering. Included in crawler.",
        }),
        aiReferral: z.number().int().openapi({
          description:
            "Visits from people following a link in an AI assistant.",
        }),
        conversions: z.number().int().nullable().openapi({
          description:
            "AI referral visits that reached a configured conversion path. Null when no conversion paths are set.",
        }),
      })
      .openapi({ description: "Totals for the whole window." }),
    previousConversions: z.number().int().nullable().openapi({
      description:
        "Conversions in the previous window of the same length. Null when no conversion paths are set or no comparison data exists.",
    }),
    sources: z.array(trafficSourceSchema).openapi({
      description:
        "One row per source and visitor type, crawlers and AI referrals only, most requests first.",
    }),
    points: z.array(trafficPointSchema).openapi({
      description: "Daily requests per source and visitor type.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoTrafficOverviewResponse", {
    description:
      "AI crawler and AI referral traffic totals, sources and daily counts for the window.",
  });

const trafficLogEntrySchema = z.object({
  capturedAt: utcTimestampField("the request"),
  visitorType: visitorTypeField,
  source: sourceField,
  agent: agentField,
  category: categoryField,
  confidence: confidenceField,
  path: z.string().openapi({ description: "Requested URL path." }),
  host: z
    .string()
    .openapi({ description: "Hostname the request was sent to." }),
  country: z.string().openapi({
    description: "Country from the request's geo data. Empty when unknown.",
  }),
  ua: z.string().openapi({
    description:
      "First 180 characters of the user agent. Empty for AI referrals, whose user agent is not stored.",
  }),
  journeyId: z.string().openapi({
    description:
      "Groups requests from one agent session; pass it to getGeoTrafficJourney. Empty when no journey could be derived.",
  }),
  wantsMarkdown: z.boolean().openapi({
    description:
      "Whether the request asked for Markdown or fetched a machine-readable file.",
  }),
});

export const trafficLogResponseSchema = z
  .object({
    configured: trafficConfiguredField,
    log: z.array(trafficLogEntrySchema).openapi({
      description: "Newest requests first, from the last 90 days.",
    }),
    total: z.number().int().openapi({
      description: "Number of entries in log, not the overall request count.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoTrafficLogResponse", {
    description: "Recent individual AI crawler and AI referral requests.",
  });

const journeySchema = z.object({
  journeyId: z.string().openapi({
    description: "Pass it to getGeoTrafficJourney for every request.",
  }),
  source: sourceField,
  visitorType: visitorTypeField,
  pages: z.number().int().openapi({
    description: "Requests in this journey within the window.",
  }),
  distinctPaths: z.number().int().openapi({
    description: "Distinct paths requested in this journey.",
  }),
  firstSeenAt: utcTimestampField("the journey's first request in the window"),
  lastSeenAt: utcTimestampField("the journey's latest request in the window"),
  entryPath: z.string().openapi({
    description: "Path of the journey's first request.",
  }),
  samplePaths: z.array(z.string()).openapi({
    description:
      "Distinct paths the journey requested, in no particular order.",
  }),
});

export const trafficJourneysResponseSchema = z
  .object({
    configured: trafficConfiguredField,
    journeys: z.array(journeySchema).openapi({
      description:
        "Crawler and AI referral journeys, most recent activity first.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoTrafficJourneysResponse", {
    description:
      "AI crawler and AI referral journeys, each a group of requests from one agent session.",
  });

const journeyEventSchema = z.object({
  capturedAt: utcTimestampField("the request"),
  path: z.string().openapi({ description: "Requested URL path." }),
  host: z
    .string()
    .openapi({ description: "Hostname the request was sent to." }),
  method: z.string().openapi({ description: "HTTP method, uppercase." }),
  referer: z.string().openapi({
    description:
      "Referrer origin and path without the query string. Empty when absent.",
  }),
  country: z.string().openapi({
    description: "Country from the request's geo data. Empty when unknown.",
  }),
  agent: agentField,
  category: categoryField,
});

export const journeyDetailResponseSchema = z
  .object({
    configured: trafficConfiguredField,
    events: z.array(journeyEventSchema).openapi({
      description:
        "The journey's requests within the window, oldest first, up to 200.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoJourneyDetailResponse", {
    description: "The individual requests that make up one traffic journey.",
  });

const trafficPageSchema = z.object({
  path: z.string().openapi({ description: "Requested URL path." }),
  host: z
    .string()
    .openapi({ description: "Hostname the request was sent to." }),
  source: sourceField,
  visitorType: visitorTypeField,
  visits: z.number().int().openapi({
    description:
      "Requests to this page from this source in the window, including imported history.",
  }),
  previousVisits: z
    .number()
    .int()
    .optional()
    .openapi({
      description: `Requests ${previousWindowNote}.`,
    }),
  lastSeenAt: utcTimestampField(
    "the newest request in the window",
    importedDayNote
  ),
});

export const trafficPagesResponseSchema = z
  .object({
    configured: trafficConfiguredField,
    pages: z.array(trafficPageSchema).openapi({
      description:
        "One row per host, path, source and visitor type, most requests first.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoTrafficPagesResponse", {
    description:
      "AI crawler and AI referral requests per page, source and visitor type.",
  });

export const mcpToolParamsSchema = projectParamsSchema.extend({
  toolName: createGeoShortTextSchema().openapi({
    param: { name: "toolName", in: "path" },
    description: "Tool name as your MCP server registers it.",
  }),
});

const mcpStatusSchema = z.enum(MCP_EVENT_STATUSES);

const mcpErrorsField = z.number().int().openapi({
  description: "Requests whose status was tool_error or rpc_error.",
});

const mcpIntentSchema = z.object({
  intent: z.string().openapi({
    description: "Intent the agent stated when calling the tool.",
  }),
  tool: z.string().openapi({ description: "Tool the call went to." }),
  calls: z.number().int().openapi({
    description: "Requests that stated this intent.",
  }),
  errors: mcpErrorsField,
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
        name: z.string().openapi({
          description: "Server name, or empty when not reported.",
        }),
        version: z.string().openapi({
          description: "Server version, or empty when not reported.",
        }),
        protocolVersion: z.string().openapi({
          description: "MCP protocol version, or empty when not reported.",
        }),
      })
      .nullable()
      .openapi({
        description: "Server info from the newest event. Null before any.",
      }),
    totals: z
      .object({
        requests: z.number().int().openapi({
          description: "All MCP requests in the window, of every method.",
        }),
        previousRequests: z.number().int().openapi({
          description: "All requests in the previous window.",
        }),
        toolCalls: z.number().int().openapi({
          description: "tools/call requests.",
        }),
        previousToolCalls: z.number().int().openapi({
          description: "tools/call requests in the previous window.",
        }),
        errors: mcpErrorsField,
        previousErrors: z.number().int().openapi({
          description: "Failed requests in the previous window.",
        }),
        sessions: z.number().int().openapi({
          description: "Distinct MCP sessions.",
        }),
        previousSessions: z.number().int().openapi({
          description: "Distinct sessions in the previous window.",
        }),
        users: z.number().int().openapi({
          description: "Distinct end-user IDs your server reported.",
        }),
        previousUsers: z.number().int().openapi({
          description: "Distinct end-user IDs in the previous window.",
        }),
        p95Ms: z.number().int().openapi({
          description: "95th percentile request duration in milliseconds.",
        }),
        previousP95Ms: z.number().int().openapi({
          description:
            "95th percentile request duration in milliseconds in the previous window.",
        }),
      })
      .openapi({
        description:
          "Each previous* value covers the window of the same length right before this one.",
      }),
    daily: z
      .array(
        z.object({
          day: z.string().openapi({ description: "UTC day (YYYY-MM-DD)." }),
          toolsCall: z
            .number()
            .int()
            .openapi({ description: "tools/call requests that day." }),
          resourcesRead: z
            .number()
            .int()
            .openapi({ description: "resources/read requests that day." }),
          promptsGet: z
            .number()
            .int()
            .openapi({ description: "prompts/get requests that day." }),
          other: z.number().int().openapi({
            description: "Requests of every other method.",
          }),
          errors: mcpErrorsField,
        })
      )
      .openapi({ description: "Requests per day, split by method." }),
    tools: z
      .array(
        z.object({
          name: z.string().openapi({ description: "Tool name." }),
          description: z.string().openapi({
            description:
              "Description from the latest tools/list. Empty when not listed.",
          }),
          calls: z
            .number()
            .int()
            .openapi({ description: "tools/call requests for this tool." }),
          errors: mcpErrorsField,
          users: z.number().int().openapi({
            description: "Distinct end-user IDs that called the tool.",
          }),
          avgResponseBytes: z.number().int().openapi({
            description: "Average response size in bytes.",
          }),
          p50Ms: z.number().int().openapi({
            description: "Median call duration in milliseconds.",
          }),
          p95Ms: z.number().int().openapi({
            description: "95th percentile call duration in milliseconds.",
          }),
          uiResource: z.string().openapi({
            description:
              "MCP Apps ui:// resource the tool advertises. Empty when none.",
          }),
        })
      )
      .openapi({ description: "Up to 50 tools, most called first." }),
    clients: z
      .array(
        z.object({
          name: z.string().openapi({
            description:
              "Name of the client, or empty when the client did not report one.",
          }),
          sessions: z
            .number()
            .int()
            .openapi({ description: "Distinct sessions from this client." }),
          requests: z
            .number()
            .int()
            .openapi({ description: "Requests from this client." }),
          errors: mcpErrorsField,
          lastSeenAt: z.string().openapi({
            description: "ISO timestamp of the client's newest request.",
          }),
        })
      )
      .openapi({ description: "Up to 50 MCP clients, most sessions first." }),
    errorRequests: z
      .array(
        z.object({
          capturedAt: z.string().openapi({ description: "ISO timestamp." }),
          clientName: z.string().openapi({
            description: "Client name, or empty when not reported.",
          }),
          clientVersion: z.string().openapi({
            description: "Client version, or empty when not reported.",
          }),
          method: z.string().openapi({
            description: "JSON-RPC method, such as tools/call.",
          }),
          target: z.string().openapi({
            description:
              "Tool name, resource URI or prompt name the request targeted.",
          }),
          status: mcpStatusSchema.openapi({
            description:
              "Kind of failure, where tool_error means the tool returned an error result and rpc_error means the JSON-RPC request failed.",
          }),
          errorCode: z.number().int().openapi({
            description: "Error code your server reported; 0 when none.",
          }),
          errorMessage: z.string().openapi({
            description: "Error message, or empty when not reported.",
          }),
          durationMs: z
            .number()
            .int()
            .openapi({ description: "Request duration in milliseconds." }),
          model: z.string().openapi({
            description:
              "Model the agent reported via the optional _model parameter. Empty when not reported.",
          }),
        })
      )
      .openapi({
        description: "Up to 100 most recent failed requests, newest first.",
      }),
    models: z
      .array(
        z.object({
          name: z.string().openapi({ description: "Model name." }),
          sessions: z.number().int().openapi({
            description: "Distinct sessions that reported this model.",
          }),
          calls: z
            .number()
            .int()
            .openapi({ description: "Requests that reported this model." }),
          errors: mcpErrorsField,
        })
      )
      .openapi({
        description:
          "Up to 50 models agents reported via the optional _model parameter, most calls first.",
      }),
    intents: z.array(mcpIntentSchema).openapi({
      description: "Up to 50 most frequent intent and tool pairs.",
    }),
    elicitations: z
      .array(
        z.object({
          method: z.string().openapi({
            description:
              "Server-to-client request method, such as elicitation or sampling.",
          }),
          tool: z.string().openapi({
            description: "Tool that triggered the request.",
          }),
          requests: z
            .number()
            .int()
            .openapi({ description: "Requests sent to clients." }),
          accepted: z
            .number()
            .int()
            .openapi({ description: "Requests the user accepted." }),
          declined: z
            .number()
            .int()
            .openapi({ description: "Requests the user declined." }),
          cancelled: z.number().int().openapi({
            description: "Requests the user dismissed without answering.",
          }),
          errors: mcpErrorsField,
        })
      )
      .openapi({
        description:
          "Requests your server sent to clients, with how users answered.",
      }),
    uiRenders: z
      .array(
        z.object({
          resource: z.string().openapi({ description: "ui:// resource URI." }),
          tools: z.array(z.string()).openapi({
            description: "Tools that advertise this resource.",
          }),
          renders: z.number().int().openapi({
            description: "Successful reads of the resource.",
          }),
          sessions: z.number().int().openapi({
            description: "Distinct sessions with a successful read.",
          }),
          errors: mcpErrorsField,
        })
      )
      .openapi({
        description: "MCP Apps interfaces hosts loaded, most renders first.",
      }),
    catalog: z
      .object({
        listedAt: z.string().openapi({
          description: "ISO timestamp of the latest tools/list response.",
        }),
        unusedTools: z
          .array(
            z.object({
              name: z.string().openapi({ description: "Tool name." }),
              description: z.string().openapi({
                description:
                  "Description from the latest tools/list response, or empty when there is none.",
              }),
            })
          )
          .openapi({
            description: "Listed tools with no calls in the window.",
          }),
      })
      .nullable()
      .openapi({
        description:
          "Tools from the latest tools/list that were never called in the window. Null before a listing is seen.",
      }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoMcpAnalyticsResponse", {
    description:
      "Usage, errors, clients and tools of your MCP server for the window.",
  });

const mcpToolNeighborSchema = z.object({
  tool: z.string().openapi({ description: "Neighboring tool name." }),
  calls: z.number().int().openapi({
    description: "Times this neighbor was adjacent to the tool.",
  }),
  afterFailure: z.number().int().openapi({
    description: "Of those, how often the earlier call of the pair had failed.",
  }),
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
          message: z.string().openapi({
            description: "First 300 characters of the error message.",
          }),
          clientName: z.string().openapi({
            description: "Client name, or empty when not reported.",
          }),
          status: mcpStatusSchema.openapi({
            description:
              "Kind of failure, where tool_error means the tool returned an error result and rpc_error means the JSON-RPC request failed.",
          }),
          errorCode: z.number().int().openapi({
            description: "Error code your server reported; 0 when none.",
          }),
          calls: z
            .number()
            .int()
            .openapi({ description: "Failed calls with this message." }),
          lastSeenAt: z.string().openapi({
            description: "ISO timestamp of the newest failure.",
          }),
        })
      )
      .openapi({ description: "Failures grouped by error message." }),
    intents: z.array(mcpIntentSchema).openapi({
      description: "Up to 20 most frequent intents for this tool.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoMcpToolDetailResponse", {
    description:
      "Call sequences, failures and intents for one MCP server tool.",
  });

export const ingestTokenQuerySchema = z.object({
  projectId: resourceIdSchema("projectId")
    .optional()
    .openapi({
      param: { name: "projectId", in: "query" },
      description:
        "Bind the token to one project. Omit to track the whole organization.",
    }),
});

export const ingestSetupQuerySchema = z.object({
  projectId: resourceIdSchema("projectId")
    .optional()
    .openapi({
      param: { name: "projectId", in: "query" },
      description:
        "Return the web key for one project. Omit for the oldest project's web key.",
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
  snippets: z
    .object({
      next: z.string().openapi({ description: "Next.js proxy snippet." }),
      nuxt: z
        .string()
        .openapi({ description: "Nuxt server middleware snippet." }),
      netlify: z
        .string()
        .openapi({ description: "Netlify Edge Function snippet." }),
      tanstack: z
        .string()
        .openapi({ description: "TanStack Start middleware snippet." }),
      astro: z.string().openapi({ description: "Astro middleware snippet." }),
      sveltekit: z
        .string()
        .openapi({ description: "SvelteKit hooks snippet." }),
      reactRouter: z
        .string()
        .openapi({ description: "React Router middleware snippet." }),
    })
    .openapi({
      description:
        "Install snippets per framework, each of which reads the token from an environment variable instead of embedding it.",
    }),
  drainUrls: z
    .object({
      vercel: z.string().openapi({ description: "Vercel log drain endpoint." }),
      cloudflare: z
        .string()
        .openapi({ description: "Cloudflare Logpush endpoint." }),
    })
    .openapi({
      description:
        "Endpoints a Vercel log drain or Cloudflare Logpush job posts request logs to, authenticated with the tracking token.",
    }),
  organization: organizationResponseSchema,
});

const webScriptSchema = z.object({
  url: z.string().openapi({
    description: "Always serves the latest build.",
  }),
  pinnedUrl: z.string().openapi({
    description: "Serves exactly this build forever; it never updates.",
  }),
  integrity: z.string().openapi({
    description:
      'Subresource Integrity value for pinnedUrl (sha384). Use it with crossorigin="anonymous".',
  }),
  collectUrl: z.string().optional().openapi({
    description:
      "Where page views go when the script loads from Notra's script host; set it as the tag's data-api.",
  }),
});

/**
 * The notra.js install. The web key is public by design (it ships in page
 * HTML and only records page views on tracked domains), so read access gets it.
 * Only workspaces with web analytics get these fields.
 */
const webSetupFields = {
  webKey: z.string().optional().openapi({
    description:
      "Public key for the notra.js browser script, bound to one project. Safe to put in page HTML; it only records human page views on that project's tracked domains and survives token rotation. Only present when web analytics is enabled for the workspace and it has a project.",
  }),
  webSnippet: z.string().optional().openapi({
    description:
      'Script tag that installs notra.js with the public key, pinned to the current build with its Subresource Integrity hash and crossorigin="anonymous". Build an auto-updating tag from webScript.url instead if you want new builds without copying the tag again. Only present when web analytics is enabled for the workspace.',
  }),
  webScript: webScriptSchema.optional().openapi({
    description:
      "notra.js: the auto-updating URL and the current build pinned with Subresource Integrity. Only present when web analytics is enabled for the workspace.",
  }),
  webPlusScript: webScriptSchema.optional().openapi({
    description:
      "notra.plus.js (notra.js with JavaScript error reporting), auto-updating and pinned. Only present when web analytics is enabled for the workspace.",
  }),
};

export const ingestSetupResponseSchema = ingestSetupFieldsSchema
  .extend(webSetupFields)
  .openapi("GeoIngestSetupResponse", {
    description: "Tracking install instructions without the secret token.",
  });

export const ingestTokenResponseSchema = ingestSetupFieldsSchema
  .extend({
    token: z.string().openapi({
      description:
        "Tracking token. Shown once per request; rotating invalidates every previously issued token.",
    }),
    ...webSetupFields,
  })
  .openapi("GeoIngestTokenResponse", {
    description: "A newly issued tracking token with its install instructions.",
  });
