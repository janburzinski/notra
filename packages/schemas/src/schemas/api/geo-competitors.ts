import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  GEO_COMPETITOR_MAX_SYNONYMS,
  GEO_MAX_COMPETITORS,
  GEO_SHORT_FIELD_MAX_LENGTH,
} from "@notra/geo-core/constants/geo";
import { GEO_CSV_IMPORT_MAX_BYTES } from "@notra/geo-core/constants/geo-import";
import { geoCompetitorDomainSchema } from "@notra/geo-core/schemas/geo-import";

import { organizationResponseSchema } from "./content";
import { createGeoShortTextSchema } from "./geo-fields";
import { geoImportIssueSchema } from "./geo-import";

const competitorSchema = z
  .object({
    id: z.string().openapi({
      description:
        "Competitor id. Competitors carried over from older settings use `legacy:` plus the lowercased name. Endpoints address competitors by `name`, not id.",
    }),
    name: z.string().openapi({
      description:
        "Competitor name. Unique per project, compared case-insensitively.",
    }),
    domain: z.string().nullable().openapi({
      description:
        "Competitor website domain, used to recognize citations of its site. `null` when unknown.",
    }),
    synonyms: z.array(z.string()).openapi({
      description: "Alternate names counted as this competitor in answers.",
    }),
    kind: z.enum(["direct", "indirect"]).openapi({
      description:
        "Your own label for the competitor: direct or indirect. Only shown as a label; mentions, share of voice and gaps count both kinds the same way.",
    }),
    color: z.string().nullable().openapi({
      description: "Custom chart color, or `null` to use the default palette.",
    }),
  })
  .openapi("GeoCompetitor")
  .openapi({ description: "A competitor tracked in AI answers." });

export const listCompetitorsResponseSchema = z
  .object({
    competitors: z.array(competitorSchema).openapi({
      description: "Tracked competitors, oldest first.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("ListGeoCompetitorsResponse")
  .openapi({
    description:
      "The project's tracked competitors and the workspace they belong to.",
  });

export const competitorSuggestionsQuerySchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1)
    .max(GEO_SHORT_FIELD_MAX_LENGTH)
    .openapi({
      param: { name: "domain", in: "query" },
      description: "Website domain, for example `example.com`.",
      example: "example.com",
    }),
});

export const competitorSuggestionsResponseSchema = z
  .object({
    domain: z.string().openapi({
      description: "Website domain the suggestions are for.",
    }),
    field: z.string().nullable().openapi({
      description:
        "Market or category the lookup placed the website in, or `null` when it reported none.",
    }),
    competitors: z
      .array(
        z.object({
          name: z.string().openapi({
            description: "Name of the suggested competitor.",
          }),
          domain: z.string().nullable().openapi({
            description:
              "Website domain of the suggested competitor, or `null` when the lookup found none.",
          }),
          description: z.string().nullable().openapi({
            description:
              "Short description of the suggested competitor, or `null`.",
          }),
          confidence: z.enum(["high", "medium"]).nullable().openapi({
            description:
              "How sure the lookup is that this is a competitor, or `null` when not reported.",
          }),
        })
      )
      .openapi({
        description:
          "Suggested competitors, deduplicated by domain or name. Nothing is saved; track one with `PUT /v1/projects/{projectId}/geo/competitors`.",
      }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoCompetitorSuggestionsResponse")
  .openapi({
    description:
      "Competitors suggested for a website domain, which Notra does not save.",
  });

export const putCompetitorRequestSchema = z
  .object({
    name: createGeoShortTextSchema(),
    previousName: createGeoShortTextSchema().optional().openapi({
      description: "Set to rename an existing competitor.",
    }),
    domain: geoCompetitorDomainSchema.nullable(),
    synonyms: z
      .array(createGeoShortTextSchema())
      .max(GEO_COMPETITOR_MAX_SYNONYMS)
      .optional(),
    kind: z.enum(["direct", "indirect"]).optional().openapi({
      description:
        "Label only; it does not change how mentions are counted. Omit to keep the current kind, or direct for a new competitor.",
    }),
    color: z
      .string()
      .trim()
      .max(GEO_SHORT_FIELD_MAX_LENGTH)
      .nullable()
      .optional(),
  })
  .openapi("PutGeoCompetitorRequest");

const competitorImportRowSchema = z.object({
  name: createGeoShortTextSchema(),
  domain: geoCompetitorDomainSchema.nullable().optional(),
  kind: z.enum(["direct", "indirect"]).optional().openapi({
    description:
      "Label only. Omit to keep an existing competitor's kind, or direct for a new one.",
  }),
  synonyms: z
    .array(createGeoShortTextSchema())
    .max(GEO_COMPETITOR_MAX_SYNONYMS)
    .optional(),
});

export const importCompetitorsRequestSchema = z
  .object({
    rows: z
      .array(competitorImportRowSchema)
      .min(1)
      .max(GEO_MAX_COMPETITORS)
      .optional(),
    // See `importPromptsRequestSchema`: a code-unit cap, not a byte count.
    csv: z.string().min(1).max(GEO_CSV_IMPORT_MAX_BYTES).optional().openapi({
      description:
        "Raw CSV text with a `name` column (optionally `domain`, `kind`, `synonyms`). Used when `rows` is omitted.",
    }),
  })
  .refine((value) => value.rows !== undefined || value.csv !== undefined, {
    message: "Provide either rows or csv",
  })
  .openapi("ImportGeoCompetitorsRequest");

export const importCompetitorsResponseSchema = z
  .object({
    imported: z.number().int().openapi({
      description: "Rows added as new competitors.",
    }),
    updated: z.number().int().openapi({
      description:
        "Rows that matched an existing competitor by name and replaced the domain, kind or synonyms they provided.",
    }),
    skipped: z.number().int().openapi({
      description: "Rows repeating a name already seen earlier in the import.",
    }),
    issues: z.array(geoImportIssueSchema).openapi({
      description: "Rows rejected while parsing CSV. Always empty for `rows`.",
    }),
    competitors: z.array(competitorSchema).openapi({
      description: "All tracked competitors after the import.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("ImportGeoCompetitorsResponse")
  .openapi({
    description:
      "Counts of imported, updated, skipped and rejected competitor rows, plus the resulting competitor list.",
  });
