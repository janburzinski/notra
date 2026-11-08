import {
  CAPLESS_KEY,
  C15T_ACTION_DIRECTIONS,
  C15T_BAR_POSITIONS,
  C15T_COLOR_TOKENS,
  C15T_FLOATING_POSITIONS,
  C15T_LOCALES,
  C15T_RADII,
  C15T_SCRIPT_CATEGORIES,
  C15T_SCRIPT_PATH,
  C15T_STORAGE_MAX_EXPIRY_DAYS,
  C15T_UI_PROFILES,
  C15T_WIDGET_POSITIONS,
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
  ONEDOLLARSTATS_HOSTNAME_MESSAGE,
  ONEDOLLARSTATS_PROP_NAME,
  ONEDOLLARSTATS_PROP_VALUE,
  POSTHOG_API_KEY,
  RYBBIT_CSS_CLASS,
  RYBBIT_MAX_DELAY_MS,
  RYBBIT_MAX_PATTERNS,
  RYBBIT_MAX_REPLAY_BATCH_SIZE,
  RYBBIT_MAX_SELECTOR_LENGTH,
  RYBBIT_MAX_TAG_LENGTH,
  RYBBIT_MIN_REPLAY_BATCH_INTERVAL_MS,
  RYBBIT_NAMESPACE,
  RYBBIT_PATH_PATTERN,
  RYBBIT_SCRIPT_URL_PATTERN,
  RYBBIT_SITE_ID,
  RYBBIT_SITE_ID_MESSAGE,
  TRAILING_SLASHES,
} from "@notra/sites-core/constants/integrations";
import { SITE_CSP_MAX_ALLOWED_ORIGINS } from "@notra/sites-core/constants/security";
import {
  SITE_HEX_COLOR,
  SITE_LINK_HREF,
} from "@notra/sites-core/constants/site-config";
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

const caplessSchema = z.strictObject({
  key: z
    .string({
      error: "Copy the public key (cs_…) from your Capless tracking code",
    })
    .trim()
    .regex(
      CAPLESS_KEY,
      "Copy the public key (cs_…) from your Capless tracking code"
    )
    .describe(
      "Public Capless ingest key (cs_…) from your tracking code (data-key). It can only write events, so it is safe in HTML."
    ),
});

const rybbitPathPatternsSchema = z
  .array(
    z
      .string()
      .trim()
      .regex(
        RYBBIT_PATH_PATTERN,
        "Use a path glob starting with /, e.g. /drafts/**, or a regex starting with re:"
      )
  )
  .max(RYBBIT_MAX_PATTERNS)
  .optional();

const rybbitCssClassSchema = z
  .string()
  .trim()
  .regex(RYBBIT_CSS_CLASS, "Use a single CSS class name without the dot")
  .optional();

const rybbitSelectorSchema = z
  .string()
  .trim()
  .min(1)
  .max(RYBBIT_MAX_SELECTOR_LENGTH)
  .optional();

const rybbitMaskInputOptionsSchema = z
  .strictObject({
    color: optionalBooleanSchema,
    date: optionalBooleanSchema,
    "datetime-local": optionalBooleanSchema,
    email: optionalBooleanSchema,
    month: optionalBooleanSchema,
    number: optionalBooleanSchema,
    password: optionalBooleanSchema,
    range: optionalBooleanSchema,
    search: optionalBooleanSchema,
    select: optionalBooleanSchema,
    tel: optionalBooleanSchema,
    text: optionalBooleanSchema,
    textarea: optionalBooleanSchema,
    time: optionalBooleanSchema,
    url: optionalBooleanSchema,
    week: optionalBooleanSchema,
  })
  .optional()
  .describe(
    'Input types to mask when maskAllInputs is false, e.g. {"password": true, "email": true, "tel": true}. Replaces Rybbit\'s default of {"password": true, "email": true}.'
  );

const rybbitMouseInteractionsSchema = z.strictObject({
  MouseUp: optionalBooleanSchema,
  MouseDown: optionalBooleanSchema,
  Click: optionalBooleanSchema,
  ContextMenu: optionalBooleanSchema,
  DblClick: optionalBooleanSchema,
  Focus: optionalBooleanSchema,
  Blur: optionalBooleanSchema,
  TouchStart: optionalBooleanSchema,
  TouchMove_Departed: optionalBooleanSchema,
  TouchEnd: optionalBooleanSchema,
  TouchCancel: optionalBooleanSchema,
});

const rybbitReplaySamplingSchema = z
  .strictObject({
    mousemove: z
      .union([z.boolean(), z.number().int().min(0).max(RYBBIT_MAX_DELAY_MS)])
      .optional()
      .describe(
        "Record mouse movement: false, true or the milliseconds between samples (default: false)."
      ),
    mouseInteraction: z
      .union([z.boolean(), rybbitMouseInteractionsSchema])
      .optional()
      .describe(
        "Record mouse and touch interactions: true, false or one switch per interaction (default: Click, DblClick, Focus and Blur only)."
      ),
    scroll: z
      .number()
      .int()
      .min(0)
      .max(RYBBIT_MAX_DELAY_MS)
      .optional()
      .describe("Milliseconds between scroll samples (default: 500)."),
    media: z
      .number()
      .int()
      .min(0)
      .max(RYBBIT_MAX_DELAY_MS)
      .optional()
      .describe("Milliseconds between media playback samples (default: 800)."),
    input: z
      .enum(["all", "last"])
      .optional()
      .describe(
        'Record every input change ("all") or only the final value ("last", default).'
      ),
  })
  .optional()
  .describe(
    "How often the recorder samples visitor activity. Replaces Rybbit's defaults as a whole, so set every key you care about."
  );

const rybbitSlimDomOptionsSchema = z
  .strictObject({
    script: optionalBooleanSchema,
    comment: optionalBooleanSchema,
    headFavicon: optionalBooleanSchema,
    headWhitespace: optionalBooleanSchema,
    headMetaDescKeywords: optionalBooleanSchema,
    headMetaSocial: optionalBooleanSchema,
    headMetaRobots: optionalBooleanSchema,
    headMetaHttpEquiv: optionalBooleanSchema,
    headMetaAuthorship: optionalBooleanSchema,
    headMetaVerification: optionalBooleanSchema,
    headTitleMutations: optionalBooleanSchema,
  })
  .optional()
  .describe(
    "Parts of the page left out of recordings to keep them small. Replaces Rybbit's defaults (everything but script and headTitleMutations) as a whole."
  );

const rybbitReplaySchema = z
  .strictObject({
    sampleRate: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe(
        "Percentage of sessions to record, from 0 to 100 (default: 100)."
      ),
    batchSize: z
      .number()
      .int()
      .min(1)
      .max(RYBBIT_MAX_REPLAY_BATCH_SIZE)
      .optional()
      .describe("Recording events per upload (default: 250)."),
    batchInterval: z
      .number()
      .int()
      .min(RYBBIT_MIN_REPLAY_BATCH_INTERVAL_MS)
      .max(RYBBIT_MAX_DELAY_MS)
      .optional()
      .describe("Milliseconds between uploads, at least 1000 (default: 5000)."),
    maskAllInputs: optionalBooleanSchema.describe(
      "Mask every form input in recordings (default: true)."
    ),
    maskInputOptions: rybbitMaskInputOptionsSchema,
    maskTextSelectors: z
      .array(z.string().trim().min(1).max(RYBBIT_MAX_SELECTOR_LENGTH))
      .max(RYBBIT_MAX_PATTERNS)
      .optional()
      .describe(
        'CSS selectors whose text is masked in recordings, e.g. [".author-email"].'
      ),
    maskTextClass: rybbitCssClassSchema.describe(
      'Class that masks an element\'s text in recordings (default: "rr-mask").'
    ),
    blockClass: rybbitCssClassSchema.describe(
      'Class that replaces an element with a placeholder in recordings (default: "rr-block").'
    ),
    blockSelector: rybbitSelectorSchema.describe(
      "CSS selector for elements replaced with a placeholder in recordings."
    ),
    ignoreClass: rybbitCssClassSchema.describe(
      'Class whose inputs are not recorded (default: "rr-ignore").'
    ),
    ignoreSelector: rybbitSelectorSchema.describe(
      "CSS selector for inputs that are not recorded."
    ),
    collectFonts: optionalBooleanSchema.describe(
      "Record web fonts so replays look like the live page (default: true)."
    ),
    sampling: rybbitReplaySamplingSchema,
    slimDomOptions: rybbitSlimDomOptionsSchema,
  })
  .optional()
  .describe(
    "Session replay recorder options. Turn session replay on in your Rybbit site settings; these options only tune it."
  );

const rybbitSchema = z.strictObject({
  siteId: z
    .string({ error: RYBBIT_SITE_ID_MESSAGE })
    .trim()
    .regex(RYBBIT_SITE_ID, RYBBIT_SITE_ID_MESSAGE)
    .describe(
      "Public Rybbit Site ID from your tracking code (the siteId in the script URL). No API key is needed."
    ),
  scriptUrl: z
    .string()
    .trim()
    .regex(
      RYBBIT_SCRIPT_URL_PATTERN,
      "Use the URL of your Rybbit instance's script.js, e.g. https://stats.acme.com/api/script.js"
    )
    .optional()
    .describe(
      "Tracker script URL ending in /script.js. Defaults to https://app.rybbit.io/api/script.js; set it for a self-hosted or proxied Rybbit. Events and replays go to the same host."
    ),
  skipPatterns: rybbitPathPatternsSchema.describe(
    'Up to 50 path globs (* and **) or re: regexes that are never tracked, e.g. ["/drafts/**"]. Session replay ignores them.'
  ),
  maskPatterns: rybbitPathPatternsSchema.describe(
    'Up to 50 path globs or re: regexes whose matching paths are replaced by the pattern before sending, e.g. ["/authors/*"].'
  ),
  debounce: z
    .number()
    .int()
    .min(0)
    .max(RYBBIT_MAX_DELAY_MS)
    .optional()
    .describe(
      "Milliseconds to wait after a client-side navigation before counting the page view; 0 turns debouncing off (default: 500)."
    ),
  tag: z
    .string()
    .trim()
    .min(1)
    .max(RYBBIT_MAX_TAG_LENGTH)
    .optional()
    .describe(
      "Label added to every event, up to 256 characters, e.g. a site section or release."
    ),
  namespace: z
    .string()
    .trim()
    .regex(RYBBIT_NAMESPACE, "Use a JavaScript identifier, e.g. analytics")
    .optional()
    .describe(
      'Global name of the tracker API (window.<namespace>) and of its opt-out key disable-<namespace> (default: "rybbit").'
    ),
  replay: rybbitReplaySchema,
});

const oneDollarStatsSchema = z.strictObject({
  hostname: z
    .string({ error: ONEDOLLARSTATS_HOSTNAME_MESSAGE })
    .trim()
    .toLowerCase()
    .regex(HOSTNAME, ONEDOLLARSTATS_HOSTNAME_MESSAGE)
    .describe(
      "Domain as added in OneDollarStats, without https:// (data-hostname). Every page view is reported under this domain, so visits on your custom domain and your Notra subdomain land in the same OneDollarStats site."
    ),
  scriptUrl: httpsScriptUrlSchema.describe(
    "Tracker script URL. Defaults to https://assets.onedollarstats.com/stonks.js; set it when you proxy the script through your own domain."
  ),
  collectorUrl: httpsBaseUrlSchema.describe(
    "Endpoint the script sends events to (data-url). Defaults to https://collector.onedollarstats.com/events; set it when you proxy events through your own domain."
  ),
  autocollect: optionalBooleanSchema.describe(
    "Report a page view on every page load and client-side navigation (default: true). Set false to send only the events you trigger with window.stonks."
  ),
  hashRouting: optionalBooleanSchema.describe(
    "Treat the URL hash as the page path, e.g. /#/pricing is reported as /pricing (default: false)."
  ),
  props: z
    .record(
      z
        .string()
        .regex(
          ONEDOLLARSTATS_PROP_NAME,
          "Use a property name without spaces, ; or ="
        ),
      z
        .string()
        .trim()
        .regex(ONEDOLLARSTATS_PROP_VALUE, "Use a value without ; or =")
    )
    .optional()
    .describe(
      'Custom properties added to every page view (data-props), e.g. {"section": "blog"}. Names have no spaces, and neither names nor values may contain ; or =.'
    ),
});

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

const c15tSurfaceSchema = {
  direction: z
    .enum(C15T_ACTION_DIRECTIONS)
    .optional()
    .describe("Lay the buttons out in a row (default) or a column."),
  uiProfile: z
    .enum(C15T_UI_PROFILES)
    .optional()
    .describe(
      "compact (default) sizes buttons to their labels; balanced and strict stretch every button to full width."
    ),
};

const c15tPromptSchema = z
  .discriminatedUnion("variant", [
    z.strictObject({
      variant: z.literal("floating"),
      position: z.enum(C15T_FLOATING_POSITIONS).optional(),
      blocking: z.boolean().optional(),
      ...c15tSurfaceSchema,
    }),
    z.strictObject({
      variant: z.literal("bar"),
      position: z.enum(C15T_BAR_POSITIONS).optional(),
      blocking: z.boolean().optional(),
      ...c15tSurfaceSchema,
    }),
    z.strictObject({
      variant: z.literal("widget"),
      position: z.enum(C15T_WIDGET_POSITIONS).optional(),
      blocking: z.boolean().optional(),
      ...c15tSurfaceSchema,
    }),
    z.strictObject({ variant: z.literal("wall"), ...c15tSurfaceSchema }),
  ])
  .describe(
    "Shape and position of the consent banner. floating is a card, bar spans the viewport edge, widget is a compact corner card, wall blocks the page until the visitor chooses."
  );

const c15tLegalLinkSchema = z.strictObject({
  href: z
    .string()
    .trim()
    .regex(SITE_LINK_HREF, "Use an absolute https:// URL or a path"),
  label: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .optional()
    .describe("Link text. Defaults to the translated name of the link."),
});

const c15tColorsSchema = z.partialRecord(
  z.enum(C15T_COLOR_TOKENS),
  z.string().regex(SITE_HEX_COLOR, "Use a hex color like #8B5CF6")
);

export const c15tSchema = z
  .strictObject({
    backendURL: z
      .string({
        error:
          "Use your Inth project URL or self-hosted c15t backend, e.g. https://acme.inth.app",
      })
      .trim()
      .regex(HTTPS_BASE_URL, "Use an https:// URL without query or hash")
      .overwrite((value) => value.replace(/\/+$/, ""))
      .describe(
        "Your Inth project URL (https://your-project.inth.app) or the URL of your self-hosted c15t backend, including any path prefix. Visitors save consent there."
      ),
    scripts: z
      .record(
        z
          .string()
          .regex(
            C15T_SCRIPT_PATH,
            "Use the script's path in your repository, like scripts/hotjar.js"
          ),
        z.enum(C15T_SCRIPT_CATEGORIES)
      )
      .optional()
      .describe(
        'Custom scripts that load only after the visitor allows a category, keyed by their path, like { "scripts/hotjar.js": "measurement" }. Scripts you leave out load on every page.'
      ),
    prompt: c15tPromptSchema.optional(),
    preferences: z
      .strictObject({
        blocking: z
          .boolean()
          .optional()
          .describe("Dim the page and trap focus while open (default: true)."),
        ...c15tSurfaceSchema,
      })
      .optional()
      .describe("Layout of the privacy settings dialog."),
    legalLinks: z
      .strictObject({
        privacyPolicy: c15tLegalLinkSchema.optional(),
        cookiePolicy: c15tLegalLinkSchema.optional(),
        termsOfService: c15tLegalLinkSchema.optional(),
      })
      .optional()
      .describe("Legal pages linked from the banner and the dialog."),
    locale: z
      .enum(C15T_LOCALES)
      .optional()
      .describe(
        "Force the banner language. Omit to follow the visitor's browser language."
      ),
    crossSubdomain: z
      .boolean()
      .optional()
      .describe(
        "Share the consent cookie with every subdomain of the site's domain (default: false)."
      ),
    expiryDays: z
      .number()
      .int()
      .min(1)
      .max(C15T_STORAGE_MAX_EXPIRY_DAYS)
      .optional()
      .describe("Days until the stored choice expires (default: 365)."),
    disableAnimation: z
      .boolean()
      .optional()
      .describe("Show the banner and dialog without animations."),
    theme: z
      .strictObject({
        colors: c15tColorsSchema
          .optional()
          .describe(
            "Light mode colors as hex values. Unset colors follow your site's theme."
          ),
        dark: c15tColorsSchema
          .optional()
          .describe(
            "Dark mode colors as hex values. Unset colors follow your site's dark theme."
          ),
        radius: z
          .enum(C15T_RADII)
          .optional()
          .describe(
            "Corner rounding of the banner, dialog and buttons (default: medium)."
          ),
      })
      .optional()
      .describe(
        "Banner and dialog styling. By default they use your site's colors, fonts and dark mode."
      ),
    hideBranding: z
      .boolean()
      .optional()
      .describe(
        "Hide the 'Secured by c15t' badge on the banner. Check that your Inth plan allows it."
      ),
    devTools: z
      .boolean()
      .default(true)
      .describe(
        "Show the c15t DevTools panel during local development with notra-sites dev (default: true). Never included in previews or the live site."
      ),
  })
  .describe(
    "c15t cookie banner and privacy settings, backed by Inth or your self-hosted c15t backend. Live deployments only; previews and local development show the banner without saving consent."
  );
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
  replay: z
    .union([
      z.boolean(),
      z.strictObject({
        maskText: optionalBooleanSchema.describe(
          "Mask page text in recordings (default: true). Set false only on pages that show no personal data; typed input stays masked."
        ),
        recordIframes: optionalBooleanSchema.describe(
          "Record your own embedded pages into the parent page's recording. Set it on the framed page too (default: false)."
        ),
        scriptUrl: httpsScriptUrlSchema.describe(
          "Recorder script URL. Defaults to https://cdn.databuddy.cc/replay.js; set it for a self-hosted or proxied script."
        ),
      }),
    ])
    .optional()
    .describe(
      "Record session replays with Databuddy's recorder (default: false). Turn session replay on for the website in Databuddy too."
    ),
} satisfies DatabuddySchemaShape);

export const siteIntegrationSchemas = {
  capless: caplessSchema,
  databuddy: databuddySchema,
  ga4: ga4Schema,
  onedollarstats: oneDollarStatsSchema,
  plausible: plausibleSchema,
  posthog: posthogSchema,
  rybbit: rybbitSchema,
  umami: umamiSchema,
};

export const siteIntegrationUpdateSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("capless"),
    settings: caplessSchema.nullable(),
  }),
  z.object({
    provider: z.literal("databuddy"),
    settings: databuddySchema.nullable(),
  }),
  z.object({ provider: z.literal("ga4"), settings: ga4Schema.nullable() }),
  z.object({
    provider: z.literal("onedollarstats"),
    settings: oneDollarStatsSchema.nullable(),
  }),
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
  z.object({
    provider: z.literal("rybbit"),
    settings: rybbitSchema.nullable(),
  }),
]);

export const siteIntegrationsSchema = z
  .strictObject({
    capless: caplessSchema.optional(),
    databuddy: databuddySchema.optional(),
    ga4: ga4Schema.optional(),
    onedollarstats: oneDollarStatsSchema.optional(),
    plausible: plausibleSchema.optional(),
    posthog: posthogSchema.optional(),
    rybbit: rybbitSchema.optional(),
    umami: umamiSchema.optional(),
    c15t: c15tSchema.optional(),
    indexnow: z
      .boolean()
      .optional()
      .describe(
        "Submit new and changed pages to IndexNow search engines such as Bing after each production deployment. It is on by default, and false turns it off."
      ),
  })
  .default({})
  .describe(
    "Analytics providers and the c15t consent banner for the live site. Notra installs their scripts automatically. Preview deployments and local development do not send provider events."
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
