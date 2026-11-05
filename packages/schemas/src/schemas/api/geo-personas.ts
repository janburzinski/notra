import "zod/compile";
import { z } from "@hono/zod-openapi";
import { GEO_PERSONA_MEMORY_KINDS } from "@notra/db/constants/geo-personas";
import {
  GEO_PERSONA_BRIEF_MAX_LENGTH,
  GEO_PERSONA_FIELD_MAX_LENGTH,
  GEO_PERSONA_MAX_COUNT,
  GEO_PERSONA_PROFILE_LIST_MAX,
  GEO_PERSONA_SUMMARY_MAX_LENGTH,
} from "@notra/geo-core/constants/geo-personas";

import { organizationResponseSchema } from "./content";
import { geoWindowQuerySchema } from "./geo-visibility";

const profileSchema = z.object({
  goals: z.array(z.string()),
  painPoints: z.array(z.string()),
  currentStack: z.array(z.string()),
  buyingTriggers: z.array(z.string()),
  objections: z.array(z.string()),
});

const personaSchema = z
  .object({
    id: z.string(),
    name: z.string().openapi({
      description: "Buyer archetype label, such as Budgeter.",
    }),
    role: z.string(),
    company: z.string(),
    summary: z.string(),
    searchStyle: z.string(),
    profile: profileSchema,
    conversationPrompts: z.array(z.string()).openapi({
      description:
        "Opening prompts the persona plays against each engine. Cleared when its details change; regenerate them with `promptsOnly` before the next run.",
    }),
    enabled: z.boolean().openapi({
      description: "Whether scheduled scans play this persona.",
    }),
    archivedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    memories: z.array(
      z.object({
        id: z.string(),
        kind: z.enum(GEO_PERSONA_MEMORY_KINDS),
        content: z.string(),
      })
    ),
  })
  .openapi("GeoPersona");

export const listPersonasResponseSchema = z
  .object({
    configured: z.boolean(),
    personas: z.array(personaSchema).openapi({
      description: `Active personas first in creation order, then archived ones. A project keeps at most ${GEO_PERSONA_MAX_COUNT} active personas.`,
    }),
    organization: organizationResponseSchema,
  })
  .openapi("ListGeoPersonasResponse");

export const personaResponseSchema = z
  .object({
    persona: personaSchema,
    organization: organizationResponseSchema,
  })
  .openapi("GeoPersonaResponse");

export const archivePersonaResponseSchema = z
  .object({
    id: z.string(),
    organization: organizationResponseSchema,
  })
  .openapi("ArchiveGeoPersonaResponse");

const editableText = (max: number) => z.string().trim().min(1).max(max);
const editableList = z
  .array(editableText(GEO_PERSONA_FIELD_MAX_LENGTH))
  .max(GEO_PERSONA_PROFILE_LIST_MAX);

export const patchPersonaRequestSchema = z
  .object({
    enabled: z.boolean().optional(),
    name: editableText(GEO_PERSONA_FIELD_MAX_LENGTH).optional(),
    role: editableText(GEO_PERSONA_FIELD_MAX_LENGTH)
      .regex(/^\S+(?:\s+\S+)?$/, "Use at most two words")
      .optional(),
    company: editableText(GEO_PERSONA_FIELD_MAX_LENGTH).optional(),
    summary: editableText(GEO_PERSONA_SUMMARY_MAX_LENGTH).optional(),
    searchStyle: editableText(GEO_PERSONA_SUMMARY_MAX_LENGTH).optional(),
    profile: z
      .object({
        goals: editableList.optional(),
        painPoints: editableList.optional(),
        currentStack: editableList.optional(),
        buyingTriggers: editableList.optional(),
        objections: editableList.optional(),
      })
      .optional()
      .openapi({
        description: "Lists to replace. Omitted lists keep their value.",
      }),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "Provide at least one field to update",
  })
  .openapi("PatchGeoPersonaRequest");

export const personaResultsQuerySchema = z.object({
  scanId: z
    .string()
    .min(1)
    .optional()
    .openapi({
      param: { name: "scanId", in: "query" },
      description:
        "Scan to read. Defaults to the latest scan that played this persona; ids are listed in `scans`.",
    }),
});

const personaSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  domain: z.string(),
});

export const personaResultsResponseSchema = z
  .object({
    results: z.array(
      z.object({
        scanId: z.string(),
        turn: z.number().int().openapi({
          description: "Conversation turn, starting at 1.",
        }),
        engine: z.string(),
        prompt: z.string(),
        answer: z.string(),
        mentioned: z.boolean(),
        position: z.number().nullable(),
        sentiment: z.string().nullable(),
        excerpt: z.string(),
        searchQueries: z.array(z.string()),
        sources: z.array(personaSourceSchema),
        snapshotVersion: z.string().nullable().openapi({
          description:
            "Hash of the persona context this answer was played with. Changes when the persona is edited.",
        }),
        lastCheckedAt: z.string(),
      })
    ),
    scans: z.array(z.object({ id: z.string(), capturedAt: z.string() })),
    selectedScanId: z.string().nullable(),
    organization: organizationResponseSchema,
  })
  .openapi("GeoPersonaResultsResponse");

export const personaActivityQuerySchema = geoWindowQuerySchema;

export const personaActivityResponseSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    points: z.array(
      z.object({
        personaId: z.string(),
        snapshotVersion: z.string(),
        day: z.string(),
        lastCheckedAt: z.string(),
        checks: z.number().int(),
        mentions: z.number().int(),
      })
    ),
    organization: organizationResponseSchema,
  })
  .openapi("GeoPersonaActivityResponse");

export const generatePersonasRequestSchema = z
  .object({
    personaId: z.string().min(1).optional().openapi({
      description:
        "Regenerate this persona in place instead of creating a new set.",
    }),
    brief: z
      .string()
      .trim()
      .min(1)
      .max(GEO_PERSONA_BRIEF_MAX_LENGTH)
      .optional()
      .openapi({
        description:
          "Describe one persona to add, such as 'a CFO at a 200-person logistics company'.",
      }),
    promptsOnly: z.literal(true).optional().openapi({
      description:
        "With personaId, only rewrite its conversation prompts and keep its details.",
    }),
  })
  .refine((input) => !(input.personaId && input.brief), {
    message: "Choose a persona or a brief, not both",
  })
  .refine((input) => !input.promptsOnly || Boolean(input.personaId), {
    message: "A persona is required when generating prompts only",
    path: ["personaId"],
  })
  .openapi("GenerateGeoPersonasRequest");

const personaGenerationJobSchema = z
  .object({
    id: z.string(),
    status: z.enum(["queued", "running", "completed", "failed"]),
    personaId: z.string().nullable(),
    startedAt: z.string(),
    error: z.string().nullable(),
  })
  .openapi("GeoPersonaGenerationJob");

export const personaGenerationResponseSchema = z
  .object({
    job: personaGenerationJobSchema.nullable().openapi({
      description:
        "The project's latest generation job, or `null` when none ran recently.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoPersonaGenerationResponse");

export const runPersonaResponseSchema = z
  .object({
    checks: z.number().int().openapi({
      description:
        "Answers recorded during this request by the API-based engines that responded.",
    }),
    mentions: z.number().int(),
    engines: z.array(z.string()),
    queuedScanId: z.string().nullable().default(null).openapi({
      description:
        "Scan that plays the persona in the tracked consumer apps in the background, or `null`. Poll `GET /v1/projects/{projectId}/geo/scans/{scanId}`.",
    }),
    queuedEngines: z.array(z.string()).default([]),
    organization: organizationResponseSchema,
  })
  .openapi("RunGeoPersonaResponse");
