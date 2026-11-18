import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  GEO_CONVERSION_PATH_MAX_LENGTH,
  GEO_MAX_ALIASES,
  GEO_MAX_CONVERSION_PATHS,
  GEO_MAX_DOMAINS,
  GEO_MAX_ENGINES,
  GEO_MAX_LANGUAGES,
  GEO_MAX_PROMPTS,
  GEO_SCAN_HOURS_PER_DAY,
  GEO_SCAN_INTERVAL_HOURS,
  GEO_SCAN_MAX_INTERVAL_HOURS,
  GEO_SCAN_MIN_INTERVAL_HOURS,
  GEO_SHORT_FIELD_MAX_LENGTH,
} from "@notra/geo-core/constants/geo";
import { normalizeProjectDomain } from "@notra/geo-core/utils/geo-project-domains";

import { organizationResponseSchema } from "./content";
import { createGeoShortTextSchema } from "./geo-fields";

const settingsSchema = z
  .object({
    id: z.string().openapi({ description: "Settings record id." }),
    organizationId: z.string().openapi({
      description: "Organization that owns the project.",
    }),
    projectId: z.string().openapi({
      description: "Project these settings apply to.",
    }),
    companyName: z.string().openapi({
      description: "Brand name that scans look for in AI answers.",
    }),
    aliases: z.array(z.string()).openapi({
      description: "Other names that also count as a brand mention.",
    }),
    conversionPaths: z.array(z.string()).openapi({
      description:
        "Paths that count as a conversion when an AI referral reaches them. Prefix match.",
    }),
    domains: z.array(z.string()).openapi({
      description:
        "Additional hostnames that send AI traffic to this project, besides the brand website. Subdomains are included.",
    }),
    competitors: z.array(z.string()).openapi({
      description:
        "Names of the project's competitors, kept in sync with the competitors endpoints.",
    }),
    languages: z.array(z.string()).openapi({
      description:
        "Supported languages scans run in. Unsupported or duplicate stored values are left out.",
    }),
    engines: z.array(z.string()).openapi({
      description:
        "Engine ids scans run on, from GET /v1/projects/{projectId}/geo/engines. Unknown ids are dropped and the default set is used when none remain. With enforceZdr on, engines that can't run under zero data retention are left out.",
    }),
    enforceZdr: z.boolean().openapi({
      description:
        "Only run engines with zero data retention, plus those listed in nonZdrApprovedEngines.",
    }),
    nonZdrApprovedEngines: z.array(z.string()).openapi({
      description:
        "Engines without zero data retention that may still run while enforceZdr is on.",
    }),
    trackWithoutSearch: z.boolean().openapi({
      description: "Also scan search-capable models without web search.",
    }),
    pausedAutoPromptIds: z.array(z.string()).openapi({
      description: "Ids of auto-generated prompts skipped in scans.",
    }),
    removedAutoPromptIds: z.array(z.string()).openapi({
      description: "Ids of auto-generated prompts removed from tracking.",
    }),
    enabled: z.boolean().openapi({
      description: "Whether recurring scans run.",
    }),
    scanIntervalHours: z.number().int().openapi({
      description: "Hours between automatic scans, in whole days.",
    }),
    scanStartedAt: z.string().nullable().openapi({
      description:
        "When the scan in progress started. Usually cleared when it finishes.",
    }),
    lastScanAt: z.string().nullable().openapi({
      description:
        "When the latest scan finished, whether it succeeded or failed. Null before the first scan.",
    }),
    isScanning: z.boolean().openapi({
      description:
        "A scan started after the latest finished one and less than two hours ago.",
    }),
    createdAt: z.string().openapi({
      description:
        "When the settings were first saved, as an ISO 8601 timestamp.",
    }),
    updatedAt: z.string().openapi({
      description: "When the settings last changed, as an ISO 8601 timestamp.",
    }),
  })
  .openapi("GeoSettings")
  .openapi({ description: "The project's GEO tracking settings." });

export const settingsResponseSchema = z
  .object({
    configured: z.boolean().openapi({
      description:
        "Whether the analytics store behind AI traffic and web analytics is set up on this Notra deployment. It does not depend on the project or its settings.",
    }),
    settings: z.union([settingsSchema, z.null()]).openapi({
      description:
        "Null when the project has no saved GEO settings yet. Save them with PATCH /v1/projects/{projectId}/geo/settings.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoSettingsResponse")
  .openapi({
    description: "The project's GEO settings and the workspace they belong to.",
  });

export const patchSettingsRequestSchema = z
  .object({
    companyName: z.string().trim().min(1).max(GEO_SHORT_FIELD_MAX_LENGTH),
    aliases: z.array(createGeoShortTextSchema()).max(GEO_MAX_ALIASES),
    conversionPaths: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(GEO_CONVERSION_PATH_MAX_LENGTH)
          .refine((value) => value.startsWith("/"), {
            message: "Conversion paths must start with /",
          })
      )
      .max(GEO_MAX_CONVERSION_PATHS)
      .optional()
      .openapi({
        description:
          "Paths that count as a conversion when an AI referral reaches them. Prefix match. Omit to keep the stored list.",
      }),
    domains: z
      .array(
        createGeoShortTextSchema().refine(
          (value) => normalizeProjectDomain(value) !== null,
          { message: "Enter a domain like example.com" }
        )
      )
      .max(GEO_MAX_DOMAINS)
      .optional()
      .openapi({
        description:
          "Additional hostnames that send AI traffic to this project, besides the brand website. Subdomains of a listed domain are included. Omit to keep the stored list.",
      }),
    languages: z
      .array(createGeoShortTextSchema())
      .min(1)
      .max(GEO_MAX_LANGUAGES),
    engines: z.array(createGeoShortTextSchema()).min(1).max(GEO_MAX_ENGINES),
    enforceZdr: z.boolean(),
    nonZdrApprovedEngines: z
      .array(createGeoShortTextSchema())
      .max(GEO_MAX_ENGINES),
    trackWithoutSearch: z.boolean().optional().openapi({
      description:
        "Also scan search-capable models without web search. Omit to keep the stored value (default false).",
    }),
    pausedAutoPromptIds: z
      .array(createGeoShortTextSchema())
      .max(GEO_MAX_PROMPTS)
      .optional()
      .openapi({
        description:
          "Ids of auto-generated prompts to skip in scans. Omit to keep the current list.",
      }),
    removedAutoPromptIds: z
      .array(createGeoShortTextSchema())
      .max(GEO_MAX_PROMPTS)
      .optional()
      .openapi({
        description:
          "Ids of auto-generated prompts removed from tracking. Omit to keep the current list.",
      }),
    enabled: z.boolean(),
    scanIntervalHours: z
      .number()
      .int()
      .min(GEO_SCAN_MIN_INTERVAL_HOURS)
      .max(GEO_SCAN_MAX_INTERVAL_HOURS)
      .multipleOf(GEO_SCAN_HOURS_PER_DAY, {
        message: `scanIntervalHours must be a whole number of days (multiple of ${GEO_SCAN_HOURS_PER_DAY})`,
      })
      .openapi({
        description: `Hours between automatic scans, ${GEO_SCAN_MIN_INTERVAL_HOURS}-${GEO_SCAN_MAX_INTERVAL_HOURS}, in whole days (multiple of ${GEO_SCAN_HOURS_PER_DAY}). Presets: ${GEO_SCAN_INTERVAL_HOURS.join(", ")}.`,
      }),
  })
  .openapi("PatchGeoSettingsRequest");

const geoEngineSchema = z
  .object({
    id: z.string().openapi({
      description: "Engine id to pass in the `engines` setting.",
      example: "google/ai-overview",
    }),
    label: z.string().openapi({ description: "Display name." }),
    provider: z.string().openapi({
      description:
        "Vendor the engine is grouped under, such as anthropic, openai, google, perplexity or microsoft. Coding-agent engines use the agent instead, such as cursor, opencode, claude-code or codex.",
      example: "google",
    }),
    zdr: z.enum(["all", "some", "none"]).openapi({
      description:
        "Zero data retention coverage. Engines with `none` need `enforceZdr: false` or an entry in `nonZdrApprovedEngines`.",
    }),
    default: z.boolean().openapi({
      description: "Part of the default engine set for new projects.",
    }),
    supportsGroundedChecks: z.boolean().openapi({
      description: "Currently always false for engines listed by the API.",
    }),
  })
  .openapi("GeoEngine")
  .openapi({ description: "An AI engine that scans can run on." });

export const engineListResponseSchema = z
  .object({
    engines: z.array(geoEngineSchema).openapi({
      description:
        "Engines this organization can select. Legacy engines a project already tracks are not listed.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoEngineListResponse")
  .openapi({
    description:
      "AI engines the organization can track and the workspace they belong to.",
  });
