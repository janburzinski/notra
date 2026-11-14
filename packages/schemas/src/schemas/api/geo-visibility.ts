import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  GEO_COMPETITOR_DETAIL_DAYS,
  GEO_DEFAULT_QUERY_DAYS,
  GEO_SHORT_FIELD_MAX_LENGTH,
} from "@notra/geo-core/constants/geo";

import type { GeoWindowToMode } from "../../types/api/geo-window";
import { organizationResponseSchema } from "./content";
import { projectParamsSchema } from "./geo-params";

const GEO_WINDOW_MAX_DAYS = 365;
const GEO_DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dayString = (name: string, description: string) =>
  z
    .string()
    .regex(GEO_DAY_REGEX, "Expected a YYYY-MM-DD date")
    .optional()
    .openapi({
      param: { name, in: "query" },
      example: "2026-01-31",
      description,
    });

const GEO_WINDOW_FROM_DESCRIPTIONS: Record<GeoWindowToMode, string> = {
  clipsRollingWindow:
    "First UTC day to include (YYYY-MM-DD). Replaces `days`. Without `to`, the window runs through today.",
  requiresFrom:
    "First UTC day to include (YYYY-MM-DD). Replaces `days`. Without `to`, the window runs through today.",
  endsWindow:
    "First UTC day to include (YYYY-MM-DD). Replaces `days`. The window from `from` through `to` must span 1 to 366 days.",
};

const GEO_WINDOW_TO_DESCRIPTIONS: Record<GeoWindowToMode, string> = {
  clipsRollingWindow:
    "Last UTC day to include (YYYY-MM-DD). Also applies without `from`: it cuts off the `days` window, which still counts back from today. Omit to include today.",
  requiresFrom:
    "Last UTC day to include (YYYY-MM-DD). Only used together with `from`; ignored when `from` is not set.",
  endsWindow:
    "Last UTC day to include (YYYY-MM-DD). Defaults to today. Without `from`, the window is the `days` days ending on this day.",
};

const geoWindowDaysDescription = (
  defaultDays: number | null,
  toMode: GeoWindowToMode
) => {
  if (toMode === "endsWindow") {
    return `Window size in days, counted back from \`to\` (or today), that day included. Ignored when \`from\` is set. Defaults to ${defaultDays ?? GEO_DEFAULT_QUERY_DAYS} days.`;
  }
  if (defaultDays === null) {
    return "Rolling window size in days. Ignored when `from` is set. Without `days` or `from`, all stored history is included.";
  }
  return `Rolling window size in days. Ignored when \`from\` is set. Defaults to ${defaultDays} days.`;
};

export const createGeoWindowQuerySchema = (
  defaultDays: number | null,
  toMode: GeoWindowToMode = "clipsRollingWindow"
) =>
  z.object({
    days: z.coerce
      .number()
      .int()
      .min(1)
      .max(GEO_WINDOW_MAX_DAYS)
      .optional()
      .openapi({
        param: { name: "days", in: "query" },
        description: geoWindowDaysDescription(defaultDays, toMode),
      }),
    from: dayString("from", GEO_WINDOW_FROM_DESCRIPTIONS[toMode]),
    to: dayString("to", GEO_WINDOW_TO_DESCRIPTIONS[toMode]),
  });

export const geoWindowQuerySchema = createGeoWindowQuerySchema(
  GEO_DEFAULT_QUERY_DAYS
);

export const geoSentimentWindowQuerySchema = createGeoWindowQuerySchema(
  GEO_DEFAULT_QUERY_DAYS,
  "endsWindow"
);

export const geoVisibilityWindowQuerySchema = createGeoWindowQuerySchema(
  null,
  "requiresFrom"
);

export const competitorDetailQuerySchema = createGeoWindowQuerySchema(
  GEO_COMPETITOR_DETAIL_DAYS,
  "requiresFrom"
);

const sparklinePointSchema = z.object({
  day: z.string().openapi({ description: "UTC day (YYYY-MM-DD)." }),
  value: z.number(),
});

const configuredField = z.boolean().openapi({
  description:
    "Always true for visibility data, which is read from Notra's own database.",
});

const engineField = z.string().openapi({
  description: "Answer engine id, as listed by listGeoEngines.",
});

const dayField = z.string().openapi({ description: "UTC day (YYYY-MM-DD)." });

const checksField = z.number().int().openapi({
  description:
    "Checks run: one per prompt, engine, language and scan. A multi-turn conversation counts once.",
});

const mentionsField = z.number().int().openapi({
  description: "Checks whose answer named your brand or one of its aliases.",
});

const citationsField = z.number().int().openapi({
  description:
    "Checks whose answer cited a page on your website or tracked domains.",
});

const visibilityField = z.number().int().openapi({
  description: "Checks that mentioned your brand or cited your site.",
});

const mentionRateField = z.number().openapi({
  description:
    "mentions / checks as a fraction from 0 to 1, rounded to 3 decimals.",
});

const visibilityRateField = z.number().openapi({
  description:
    "visibility / checks as a fraction from 0 to 1, rounded to 3 decimals.",
});

const avgPositionField = z.number().nullable().openapi({
  description:
    "Average 1-based rank of your brand in answers that listed brands, rounded to 1 decimal. Null when no mentioned answer had a rank.",
});

const overviewEngineSchema = z.object({
  engine: engineField,
  checks: checksField,
  mentions: mentionsField,
  mentionRate: mentionRateField,
  citations: citationsField,
  visibility: visibilityField,
  visibilityRate: visibilityRateField,
  avgPosition: avgPositionField,
  lastCheckedAt: z.string().openapi({
    description:
      "ISO timestamp of the newest check for this engine in the window.",
  }),
});

export const visibilityOverviewResponseSchema = z
  .object({
    configured: configuredField,
    engines: z.array(overviewEngineSchema).openapi({
      description:
        "One row per engine, highest visibility rate first. Counts every answer in the window, including sequences, personas and all tracked languages.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoVisibilityOverviewResponse");

const timeseriesPointSchema = z.object({
  day: dayField,
  engine: engineField,
  checks: checksField,
  mentions: mentionsField,
  citations: citationsField,
  visibility: visibilityField,
  avgPosition: avgPositionField.optional(),
});

export const visibilityTimeseriesResponseSchema = z
  .object({
    configured: configuredField,
    points: z.array(timeseriesPointSchema).openapi({
      description:
        "One point per day and engine that had checks, oldest first. Days without checks are omitted.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoVisibilityTimeseriesResponse");

const answerSourceSchema = z.object({
  title: z.string().openapi({
    description: "Source title, falling back to its domain or URL.",
  }),
  url: z.string(),
  domain: z.string().openapi({
    description: "Source domain; empty when it cannot be derived from the URL.",
  }),
});

const promptResultSchema = z.object({
  promptId: z.string().openapi({
    description: "Prompt id; use it with getGeoPromptHistory.",
  }),
  engine: engineField,
  prompt: z
    .string()
    .openapi({ description: "Prompt text sent to the engine." }),
  answer: z
    .string()
    .openapi({ description: "Full answer text from the engine." }),
  mentioned: z.boolean().openapi({
    description: "Whether the answer named your brand or one of its aliases.",
  }),
  ownedSourceCited: z.boolean().openapi({
    description:
      "Whether the answer cited a page on your website or tracked domains.",
  }),
  position: z.number().int().nullable().openapi({
    description:
      "1-based rank of your brand when the answer lists brands. Null when not mentioned or not in a list.",
  }),
  sentiment: z.string().nullable().openapi({
    description:
      "Tone toward your brand: positive, neutral or negative. Null when not mentioned.",
  }),
  competitors: z.array(z.string()).openapi({
    description:
      "Alternative brands the answer offered instead of yours, in order of first appearance.",
  }),
  excerpt: z.string().openapi({
    description:
      "Up to 300 characters around the mention, or the start of the answer when not mentioned.",
  }),
  searchQueries: z.array(z.string()).openapi({
    description: "Web searches the engine ran while answering, when reported.",
  }),
  sources: z.array(answerSourceSchema).openapi({
    description: "Grounding sources the answer cited, deduplicated by URL.",
  }),
  lastCheckedAt: z.string().openapi({
    description: "ISO timestamp when this answer was captured.",
  }),
});

const promptResultSummarySchema = promptResultSchema
  .pick({
    promptId: true,
    engine: true,
    prompt: true,
    mentioned: true,
    ownedSourceCited: true,
    position: true,
    sentiment: true,
    competitors: true,
    lastCheckedAt: true,
  })
  .extend({
    checkId: z.string().openapi({
      description: "Id of this answer; pass it to getGeoPromptResultDetail.",
    }),
  });

export const promptResultSummaryQuerySchema =
  geoVisibilityWindowQuerySchema.extend({
    cursor: z.coerce.number().int().min(0).max(100_000).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    engine: z.string().trim().min(1).max(GEO_SHORT_FIELD_MAX_LENGTH).optional(),
    mentioned: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    query: z.string().trim().min(1).max(300).optional(),
  });

export const visibilityPromptResultSummariesResponseSchema = z
  .object({
    configured: configuredField,
    results: z.array(promptResultSummarySchema).openapi({
      description:
        "Latest answer per tracked prompt and engine, newest first. Only tracked prompts in the project's prompt language; sequences and personas are left out.",
    }),
    nextCursor: z.string().nullable().openapi({
      description: "Pass as `cursor` for the next page. Null on the last page.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoVisibilityPromptResultSummariesResponse");

export const promptResultDetailParamsSchema = projectParamsSchema.extend({
  checkId: z.string().min(1).max(GEO_SHORT_FIELD_MAX_LENGTH),
});

export const visibilityPromptResultDetailResponseSchema = z
  .object({
    result: promptResultSchema.extend({
      finishReason: z.string().nullable().openapi({
        description:
          "Why the engine stopped generating, as reported by its API. Null when not reported.",
      }),
      promptTokens: z.number().int().nullable().openapi({
        description:
          "Input tokens the engine reported. Null when not reported.",
      }),
      outputTokens: z.number().int().nullable().openapi({
        description:
          "Output tokens the engine reported. Null when not reported.",
      }),
      reasoningTokens: z.number().int().nullable().openapi({
        description:
          "Reasoning tokens the engine reported. Null when not reported.",
      }),
      truncated: z.boolean().nullable().openapi({
        description:
          "True when the answer hit the output length limit (finishReason is length). Null when finishReason is unknown.",
      }),
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoVisibilityPromptResultDetailResponse");

export const visibilityPromptResultsResponseSchema = z
  .object({
    configured: configuredField,
    results: z.array(promptResultSchema).openapi({
      description:
        "Latest answer per tracked prompt and engine, newest first. Only tracked prompts in the project's prompt language; sequences and personas are left out.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoVisibilityPromptResultsResponse");

const brandField = z.string().openapi({
  description:
    "Brand name as answers named it; your own brand appears under its company name. Use it as `brand` in getGeoVisibilityCompetitorDetail.",
});

const competitorSharePointSchema = z.object({
  brand: brandField,
  mentions: z.number().int().openapi({
    description: "Checks in the window whose answer named this brand.",
  }),
  trend: z.array(sparklinePointSchema).optional().openapi({
    description:
      "Daily share of this brand among the mentions of the listed brands, as a fraction from 0 to 1.",
  }),
});

const competitorShareTimeseriesPointSchema = z.object({
  brand: brandField,
  day: dayField,
  mentions: z.number().int().openapi({
    description: "Checks that day whose answer named this brand.",
  }),
});

export const visibilityCompetitorShareResponseSchema = z
  .object({
    configured: configuredField,
    points: z.array(competitorSharePointSchema).openapi({
      description:
        "Up to 50 brands, most mentioned first. Includes your own brand when answers mentioned it.",
    }),
    timeseries: z.array(competitorShareTimeseriesPointSchema).openapi({
      description:
        "Daily mentions per brand, oldest first, for every brand named in the window.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoVisibilityCompetitorShareResponse");

export const competitorDetailParamsSchema = projectParamsSchema.extend({
  brand: z
    .string()
    .trim()
    .min(1)
    .max(GEO_SHORT_FIELD_MAX_LENGTH)
    .openapi({
      param: { name: "brand", in: "path" },
      description: "Competitor brand name as reported by competitor-share.",
    }),
});

const competitorTimeseriesPointSchema = z.object({
  day: dayField,
  mentions: z.number().int().openapi({
    description: "Checks that day whose answer named this brand.",
  }),
  checks: z.number().int().openapi({
    description: "All checks run that day, for computing a mention rate.",
  }),
});

const competitorPromptRowSchema = z.object({
  promptId: z.string(),
  prompt: z.string(),
  engine: engineField,
  capturedAt: z.string().openapi({
    description:
      "ISO timestamp of the latest answer for this prompt and engine.",
  }),
  mentioned: z.boolean().openapi({
    description: "Whether that answer also named your own brand.",
  }),
  position: z.number().int().nullable().openapi({
    description:
      "Your brand's 1-based rank in that answer. Null when not mentioned or not in a list.",
  }),
});

export const visibilityCompetitorDetailResponseSchema = z
  .object({
    configured: configuredField,
    points: z.array(competitorTimeseriesPointSchema).openapi({
      description: "One point per day with checks, oldest first.",
    }),
    prompts: z.array(competitorPromptRowSchema).openapi({
      description:
        "Latest answer per prompt and engine that named this brand, newest first. Persona conversations are left out.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoVisibilityCompetitorDetailResponse");

const languageSharePointSchema = z.object({
  language: z.string().openapi({
    description: "Language name, such as English.",
  }),
  checks: checksField,
  mentions: mentionsField,
  mentionRate: mentionRateField,
  citations: citationsField,
  visibility: visibilityField,
  visibilityRate: visibilityRateField,
  avgPosition: avgPositionField,
  trend: z.array(sparklinePointSchema).optional().openapi({
    description: "Daily visibility rate for this language, from 0 to 1.",
  }),
});

export const visibilityLanguageShareResponseSchema = z
  .object({
    configured: configuredField,
    points: z.array(languageSharePointSchema).openapi({
      description: "One row per language, highest visibility rate first.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoVisibilityLanguageShareResponse");
