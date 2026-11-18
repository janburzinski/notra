import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  GEO_CSV_IMPORT_MAX_BYTES,
  GEO_CSV_IMPORT_MAX_ROWS,
} from "@notra/geo-core/constants/geo-import";

import { organizationResponseSchema } from "./content";
import { geoPromptTextSchema } from "./geo-fields";
import { geoImportIssueSchema } from "./geo-import";
import { projectParamsSchema } from "./geo-params";
import { resourceIdSchema } from "./ids";

const promptSchema = z
  .object({
    id: z.string().openapi({
      description:
        "Use as `promptId` in the prompt endpoints, including `GET /v1/projects/{projectId}/geo/prompts/{promptId}/history`. A UUID for custom prompts, a fixed slug such as `best-tools` for auto prompts.",
    }),
    prompt: z.string(),
    enabled: z.boolean().openapi({
      description: "Whether project scans ask this prompt.",
    }),
    source: z.enum(["custom", "auto"]).openapi({
      description:
        "`custom` for prompts added by the user, `auto` for prompts Notra generates from the brand settings.",
    }),
    tags: z.array(z.string()).openapi({
      deprecated: true,
      description:
        "Deprecated: prompt tags were removed. Always empty; a future API version drops the field.",
    }),
    createdAt: z.string().nullable().openapi({
      description: "When the custom prompt was added. `null` for auto prompts.",
    }),
  })
  .openapi("GeoPrompt");

export const listPromptsResponseSchema = z
  .object({
    configured: z.boolean().openapi({
      description:
        "Whether the analytics backend is configured. It does not affect which prompts are returned.",
    }),
    prompts: z.array(promptSchema).openapi({
      description:
        "Custom prompts, newest first, followed by auto prompts. Auto prompts the user removed are left out.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("ListGeoPromptsResponse");

export const promptResponseSchema = z
  .object({
    prompt: promptSchema,
    organization: organizationResponseSchema,
  })
  .openapi("GeoPromptResponse");

// Strict, so clients that still send the removed `tags` field get a
// validation error instead of a success that silently drops it.
export const createPromptRequestSchema = z
  .object({
    prompt: geoPromptTextSchema,
  })
  .strict()
  .openapi("CreateGeoPromptRequest");

export const patchPromptRequestSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict()
  .openapi("PatchGeoPromptRequest");

export const deletePromptResponseSchema = z
  .object({
    id: z.string().openapi({ description: "Id of the deleted prompt." }),
    organization: organizationResponseSchema,
  })
  .openapi("DeleteGeoPromptResponse");

const promptImportRowSchema = z.object({
  prompt: geoPromptTextSchema,
  enabled: z.boolean().optional(),
});

export const importPromptsRequestSchema = z
  .object({
    rows: z
      .array(promptImportRowSchema)
      .min(1)
      .max(GEO_CSV_IMPORT_MAX_ROWS)
      .optional(),
    // `.max` counts UTF-16 code units, not bytes, so this is a cap rather than
    // an exact byte limit — good enough to keep an unbounded body out of the
    // CSV parser, and it matches the dashboard's upload limit.
    csv: z.string().min(1).max(GEO_CSV_IMPORT_MAX_BYTES).optional().openapi({
      description:
        "Raw CSV text with a `prompt` column (optionally `enabled`). Used when `rows` is omitted.",
    }),
  })
  .refine((value) => value.rows !== undefined || value.csv !== undefined, {
    message: "Provide either rows or csv",
  })
  .openapi("ImportGeoPromptsRequest");

export const importPromptsResponseSchema = z
  .object({
    imported: z.number().int().openapi({
      description: "Prompts added as new custom prompts.",
    }),
    updated: z.number().int().openapi({
      description: "Always 0: existing prompts are never changed by an import.",
    }),
    skipped: z.number().int().openapi({
      description:
        "Rows not added because the prompt was blank or already tracked, or repeated in the import. Compared case-insensitively.",
    }),
    issues: z.array(geoImportIssueSchema).openapi({
      description: "Rows rejected while parsing CSV. Always empty for `rows`.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("ImportGeoPromptsResponse");

const promptSuggestionSchema = z
  .object({
    id: z.string().openapi({
      description: "Suggestion id for the accept and dismiss endpoints.",
    }),
    prompt: z.string().openapi({
      description: "Prompt that would be tracked when accepted.",
    }),
    title: z.string().nullable().openapi({
      description:
        "Suggested headline for an article that could win this prompt, or `null`.",
    }),
    source: z.literal("search_console"),
    keywords: z
      .array(
        z.object({
          query: z.string(),
          clicks: z.number().openapi({
            description:
              "Search Console clicks over the 28 days ending 3 days before the suggestion was created (Search Console data lags by about 3 days).",
          }),
          impressions: z.number().openapi({
            description:
              "Search Console impressions over the 28 days ending 3 days before the suggestion was created (Search Console data lags by about 3 days).",
          }),
          position: z.number().openapi({
            description:
              "Average Google search position over the 28 days ending 3 days before the suggestion was created (Search Console data lags by about 3 days).",
          }),
        })
      )
      .openapi({
        description: "Search Console queries the suggestion was derived from.",
      }),
    createdAt: z.string(),
  })
  .openapi("GeoPromptSuggestion");

export const promptSuggestionParamsSchema = projectParamsSchema.extend({
  suggestionId: resourceIdSchema("suggestionId").openapi({
    param: { name: "suggestionId", in: "path" },
  }),
});

export const listPromptSuggestionsResponseSchema = z
  .object({
    suggestions: z.array(promptSuggestionSchema).openapi({
      description: "Pending suggestions, newest first.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("ListGeoPromptSuggestionsResponse");

export const dismissPromptSuggestionResponseSchema = z
  .object({
    id: z.string(),
    dismissed: z.boolean().openapi({
      description:
        "Always `true`. Dismissing an unknown or already handled suggestion returns 404.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("DismissGeoPromptSuggestionResponse");
