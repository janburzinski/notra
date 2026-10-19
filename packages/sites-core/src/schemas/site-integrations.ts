import {
  CSP_ORIGIN,
  DATABUDDY_CLIENT_ID,
  DATABUDDY_CLIENT_ID_MESSAGE,
  DATABUDDY_MAX_BATCH_SIZE,
  DATABUDDY_MAX_DELAY_MS,
  DATABUDDY_MAX_PATH_PATTERNS,
  DATABUDDY_MAX_RETRIES,
  DATABUDDY_PATH_PATTERN,
  GA4_MEASUREMENT_ID,
  HOSTNAME,
  HOSTNAME_WITH_PORT,
  HTTPS_BASE_URL,
  HTTPS_SCRIPT_URL,
  POSTHOG_API_KEY,
  TRAILING_SLASHES,
} from "@notra/sites-core/constants/integrations";
import { SITE_CSP_MAX_ALLOWED_ORIGINS } from "@notra/sites-core/constants/security";
import type { DatabuddySchemaShape } from "@notra/sites-core/types/site-integrations";
import { z } from "zod";

const httpsScriptUrlSchema = z
  .string()
  .trim()
  .regex(
    HTTPS_SCRIPT_URL,
    "Use the full https:// script URL including its path, without query or hash"
  )
  .optional();

const httpsBaseUrlSchema = z
  .string()
  .trim()
  .regex(HTTPS_BASE_URL, "Use an https:// URL without query or hash")
  .overwrite((value) => value.replace(TRAILING_SLASHES, ""))
  .optional();

const optionalBooleanSchema = z.boolean().optional();

const ga4Schema = z.strictObject({
  measurementId: z
    .string({ error: "Use the measurement ID (G-…)" })
    .trim()
    .regex(GA4_MEASUREMENT_ID, "Use the measurement ID (G-…)")
    .describe(
      "Google Analytics 4 web stream Measurement ID (G-…). Find it in Admin > Data streams > your web stream."
    ),
});

const plausibleSchema = z.strictObject({
  domain: z
    .string({ error: "Use the domain as added in Plausible, e.g. acme.com" })
    .trim()
    .toLowerCase()
    .regex(HOSTNAME, "Use the domain as added in Plausible, e.g. acme.com")
    .describe(
      "Site domain registered in Plausible, without https:// (e.g. docs.acme.com)."
    ),
  server: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      HOSTNAME_WITH_PORT,
      "Use a hostname with an optional port, without https://, e.g. plausible.acme.com:8443"
    )
    .optional()
    .describe(
      "Self-hosted Plausible hostname with an optional port, without https://. Omit to use plausible.io."
    ),
});

const posthogSchema = z.strictObject({
  apiKey: z
    .string({ error: "Use the project API key (phc_…)" })
    .trim()
    .regex(POSTHOG_API_KEY, "Use the project API key (phc_…)")
    .describe(
      "Public PostHog project API key (phc_…), not a personal API key."
    ),
  apiHost: httpsBaseUrlSchema.describe(
    "PostHog ingestion URL. Defaults to https://us.i.posthog.com; use https://eu.i.posthog.com for EU Cloud or your self-hosted HTTPS endpoint."
  ),
  sessionRecording: optionalBooleanSchema.describe(
    "Enable session recording (default: true). Authorize your site domain in PostHog project settings. Set false to keep analytics without recordings."
  ),
});

const umamiSchema = z.strictObject({
  websiteId: z
    .string({ error: "Copy the Website ID from Umami's tracking code" })
    .trim()
    .uuid("Copy the Website ID from Umami's tracking code")
    .describe(
      "Public Umami Website ID (UUID) from your website's Tracking code. No API key is needed."
    ),
  scriptUrl: httpsScriptUrlSchema.describe(
    "Tracker script URL including a non-root path. Defaults to https://cloud.umami.is/script.js; use your self-hosted HTTPS script URL when needed."
  ),
  hostUrl: httpsBaseUrlSchema.describe(
    "Optional collection endpoint base URL (data-host-url). Only needed when events should go to a different endpoint, such as a reverse proxy."
  ),
});

const databuddyPathPatternsSchema = z
  .array(
    z
      .string()
      .trim()
      .regex(
        DATABUDDY_PATH_PATTERN,
        "Use a path glob starting with /, e.g. /changelog/*"
      )
  )
  .max(DATABUDDY_MAX_PATH_PATTERNS);

const databuddyDelaySchema = z
  .number()
  .int()
  .min(0)
  .max(DATABUDDY_MAX_DELAY_MS);

const databuddySchema = z.strictObject({
  clientId: z
    .string({ error: DATABUDDY_CLIENT_ID_MESSAGE })
    .trim()
    .regex(DATABUDDY_CLIENT_ID, DATABUDDY_CLIENT_ID_MESSAGE)
    .describe(
      "Public Databuddy Client ID from your website's tracking code (data-client-id). No API key is needed."
    ),
  scriptUrl: httpsScriptUrlSchema.describe(
    "Tracker script URL. Defaults to https://cdn.databuddy.cc/databuddy.js; set it for a self-hosted or proxied script."
  ),
  apiUrl: httpsBaseUrlSchema.describe(
    "Event ingestion URL. Defaults to https://basket.databuddy.cc; set it for a self-hosted or proxied endpoint."
  ),
  trackWebVitals: optionalBooleanSchema.describe(
    "Send Core Web Vitals (LCP, CLS, INP, FCP, TTFB) for each page (default: false)."
  ),
  trackErrors: optionalBooleanSchema.describe(
    "Send uncaught JavaScript errors (default: false)."
  ),
  trackOutgoingLinks: optionalBooleanSchema.describe(
    "Send an event when visitors click links to other domains (default: false)."
  ),
  trackInteractions: optionalBooleanSchema.describe(
    "Send clicks, rage clicks and dead clicks (default: false)."
  ),
  trackAttributes: optionalBooleanSchema.describe(
    "Send a custom event when visitors click elements with a data-track attribute, using other data-* attributes as properties (default: false)."
  ),
  trackHashChanges: optionalBooleanSchema.describe(
    "Count URL hash changes as page views (default: false)."
  ),
  samplingRate: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Share of events to send, from 0 to 1 (default: 1)."),
  skipPatterns: databuddyPathPatternsSchema
    .optional()
    .describe('Path globs that are never tracked, e.g. ["/drafts/**"].'),
  maskPatterns: databuddyPathPatternsSchema
    .optional()
    .describe(
      'Path globs whose matching segments are masked before sending, e.g. ["/authors/*"].'
    ),
  anonymizeVisitorIds: z
    .union([z.boolean(), z.literal("auto")])
    .optional()
    .describe(
      'Anonymize visitor IDs before storage, or "auto" to let Databuddy decide (default: true).'
    ),
  ignoreBotDetection: optionalBooleanSchema.describe(
    "Also track visits that look like bots (default: false)."
  ),
  usePixel: optionalBooleanSchema.describe(
    "Send events with a 1x1 image request instead of fetch (default: false)."
  ),
  enableBatching: optionalBooleanSchema.describe(
    "Send events in batches (default: true)."
  ),
  batchSize: z
    .number()
    .int()
    .min(1)
    .max(DATABUDDY_MAX_BATCH_SIZE)
    .optional()
    .describe("Events per batch, from 1 to 50 (default: 10)."),
  batchTimeout: databuddyDelaySchema
    .optional()
    .describe("Milliseconds before a partial batch is sent (default: 5000)."),
  enableRetries: optionalBooleanSchema.describe(
    "Retry failed requests (default: true)."
  ),
  maxRetries: z
    .number()
    .int()
    .min(0)
    .max(DATABUDDY_MAX_RETRIES)
    .optional()
    .describe("Retries per failed request (default: 3)."),
  initialRetryDelay: databuddyDelaySchema
    .optional()
    .describe("Milliseconds before the first retry (default: 500)."),
} satisfies DatabuddySchemaShape);

export const siteIntegrationSchemas = {
  databuddy: databuddySchema,
  ga4: ga4Schema,
  plausible: plausibleSchema,
  posthog: posthogSchema,
  umami: umamiSchema,
};

export const siteIntegrationUpdateSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("databuddy"),
    settings: databuddySchema.nullable(),
  }),
  z.object({ provider: z.literal("ga4"), settings: ga4Schema.nullable() }),
  z.object({
    provider: z.literal("umami"),
    settings: umamiSchema.nullable(),
  }),
  z.object({
    provider: z.literal("plausible"),
    settings: plausibleSchema.nullable(),
  }),
  z.object({
    provider: z.literal("posthog"),
    settings: posthogSchema.nullable(),
  }),
]);

export const siteIntegrationsSchema = z
  .strictObject({
    databuddy: databuddySchema.optional(),
    ga4: ga4Schema.optional(),
    plausible: plausibleSchema.optional(),
    posthog: posthogSchema.optional(),
    umami: umamiSchema.optional(),
  })
  .default({})
  .describe(
    "Analytics providers for the live site. Notra installs their scripts automatically. Preview deployments and local development do not send provider events."
  );

export const siteSecuritySchema = z
  .strictObject({
    contentSecurityPolicy: z.boolean().default(true),
    allowedOrigins: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            CSP_ORIGIN,
            "Use an origin like https://cdn.example.com (no path), optionally https://*.example.com"
          )
      )
      .max(SITE_CSP_MAX_ALLOWED_ORIGINS)
      .default([]),
    webAssembly: z
      .boolean()
      .default(false)
      .describe(
        "Let scripts compile WebAssembly, for runtimes like Rive or Lottie. Adds 'wasm-unsafe-eval' to script-src; JavaScript eval stays blocked."
      ),
  })
  .default({
    contentSecurityPolicy: true,
    allowedOrigins: [],
    webAssembly: false,
  });
