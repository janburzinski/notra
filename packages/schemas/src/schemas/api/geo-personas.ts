import "zod/compile";
import { z } from "@hono/zod-openapi";
import { GEO_PERSONA_MEMORY_KINDS } from "@notra/db/constants/geo-personas";
import {
  GEO_PERSONA_ACTIVITY_DAYS,
  GEO_PERSONA_BRIEF_MAX_LENGTH,
  GEO_PERSONA_FIELD_MAX_LENGTH,
  GEO_PERSONA_MAX_COUNT,
  GEO_PERSONA_PROFILE_LIST_MAX,
  GEO_PERSONA_SUMMARY_MAX_LENGTH,
} from "@notra/geo-core/constants/geo-personas";

import { organizationResponseSchema } from "./content";
import { createGeoWindowQuerySchema } from "./geo-visibility";

const profileSchema = z
  .object({
    goals: z.array(z.string()).openapi({
      description: "What the persona wants to achieve.",
    }),
    painPoints: z.array(z.string()).openapi({
      description: "Problems the persona is trying to solve.",
    }),
    currentStack: z.array(z.string()).openapi({
      description: "Tools and vendors the persona uses today.",
    }),
    buyingTriggers: z.array(z.string()).openapi({
      description: "Events that push the persona to look for a new solution.",
    }),
    objections: z.array(z.string()).openapi({
      description: "Concerns that make the persona hesitate to buy.",
    }),
  })
  .openapi({ description: "Structured buyer profile of the persona." });

const personaSchema = z
  .object({
    id: z.string().openapi({
      description: "Persona id for the persona endpoints.",
    }),
    name: z.string().openapi({
      description: "Buyer archetype label, such as Budgeter.",
    }),
    role: z.string().openapi({
      description: "Short job title, at most two words.",
    }),
    company: z.string().openapi({
      description:
        "Kind of company the persona works at, with size and industry.",
    }),
    summary: z.string().openapi({
      description: "Buying priorities and situation, one point per line.",
    }),
    searchStyle: z.string().openapi({
      description: "How the persona writes to AI chats, one point per line.",
    }),
    profile: profileSchema,
    conversationPrompts: z.array(z.string()).openapi({
      description:
        "Opening prompts the persona plays against each engine. Cleared when its details change; regenerate them with `promptsOnly` before the next run.",
    }),
    enabled: z.boolean().openapi({
      description: "Whether scheduled scans play this persona.",
    }),
    archivedAt: z.string().nullable().openapi({
      description: "When the persona was archived, or `null` when active.",
    }),
    createdAt: z.string().openapi({
      description: "When the persona was created, as an ISO 8601 timestamp.",
    }),
    updatedAt: z.string().openapi({
      description: "When the persona last changed, as an ISO 8601 timestamp.",
    }),
    memories: z
      .array(
        z.object({
          id: z.string().openapi({ description: "Memory id." }),
          kind: z.enum(GEO_PERSONA_MEMORY_KINDS).openapi({
            description:
              "`background` for career and company facts, `experience` for past events with tools or vendors, `preference` for how they like to work and buy, `constraint` for budget, compliance or team limits.",
          }),
          content: z.string().openapi({
            description: "The fact, written in the first person.",
          }),
        })
      )
      .openapi({
        description:
          "First-person facts included in the persona's context when it is played.",
      }),
  })
  .openapi("GeoPersona")
  .openapi({
    description:
      "A simulated buyer persona that plays conversations against AI engines.",
  });

export const listPersonasResponseSchema = z
  .object({
    configured: z.boolean().openapi({
      description: "Always `true` for a project-scoped request.",
    }),
    personas: z.array(personaSchema).openapi({
      description: `Active personas first in creation order, then archived ones. A project keeps at most ${GEO_PERSONA_MAX_COUNT} active personas.`,
    }),
    organization: organizationResponseSchema,
  })
  .openapi("ListGeoPersonasResponse")
  .openapi({
    description: "The project's personas and the workspace they belong to.",
  });

export const personaResponseSchema = z
  .object({
    persona: personaSchema,
    organization: organizationResponseSchema,
  })
  .openapi("GeoPersonaResponse")
  .openapi({
    description:
      "The updated or restored persona and the workspace it belongs to.",
  });

export const archivePersonaResponseSchema = z
  .object({
    id: z.string().openapi({ description: "Id of the archived persona." }),
    organization: organizationResponseSchema,
  })
  .openapi("ArchiveGeoPersonaResponse")
  .openapi({
    description:
      "Confirmation of the archived persona and the workspace it belongs to.",
  });

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
  title: z.string().openapi({
    description:
      "Title of the cited page, or its URL when no title was recorded.",
  }),
  url: z.string().openapi({ description: "URL of the cited page." }),
  domain: z.string().openapi({
    description: "Domain of the cited page, or empty for older answers.",
  }),
});

export const personaResultsResponseSchema = z
  .object({
    results: z
      .array(
        z.object({
          scanId: z.string().openapi({
            description: "Scan that captured this answer.",
          }),
          turn: z.number().int().openapi({
            description: "Conversation turn, starting at 1.",
          }),
          engine: z.string().openapi({
            description: "Engine id that answered, such as `openai/chatgpt`.",
          }),
          prompt: z.string().openapi({
            description: "Message the persona sent on this turn.",
          }),
          answer: z.string().openapi({
            description: "Full answer text the engine returned.",
          }),
          mentioned: z.boolean().openapi({
            description:
              "Whether the answer named the tracked brand or one of its aliases.",
          }),
          position: z.number().nullable().openapi({
            description:
              "1-based rank of the brand in a list of recommended brands, or `null` when it is not mentioned or not in a list.",
          }),
          sentiment: z.string().nullable().openapi({
            description:
              "`positive`, `neutral` or `negative` toward the brand, or `null` when it is not mentioned or was not classified.",
          }),
          excerpt: z.string().openapi({
            description:
              "Part of the answer around the mention, or its opening when the brand is not mentioned.",
          }),
          searchQueries: z.array(z.string()).openapi({
            description: "Web searches the engine ran while answering.",
          }),
          sources: z.array(personaSourceSchema).openapi({
            description:
              "Sources the answer cited. `domain` is empty for answers stored before domains were recorded.",
          }),
          snapshotVersion: z.string().nullable().openapi({
            description:
              "Hash of the persona context this answer was played with. Changes when the persona is edited.",
          }),
          lastCheckedAt: z.string().openapi({
            description: "When this answer was captured.",
          }),
        })
      )
      .openapi({
        description:
          "Latest answer per turn and engine within the selected scan.",
      }),
    scans: z
      .array(
        z.object({
          id: z.string().openapi({ description: "Scan id." }),
          capturedAt: z.string().openapi({
            description: "When the last answer of that scan was captured.",
          }),
        })
      )
      .openapi({
        description:
          "Up to 50 scans that played this persona, newest first. Pass an id as `scanId` to read that scan.",
      }),
    selectedScanId: z.string().nullable().openapi({
      description:
        "Scan the results come from, or `null` when the persona has not been played yet. An unknown `scanId` falls back to the latest scan.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoPersonaResultsResponse")
  .openapi({
    description:
      "A persona's conversation answers from one scan, the scans available to pick from and the workspace.",
  });

export const personaActivityQuerySchema = createGeoWindowQuerySchema(
  GEO_PERSONA_ACTIVITY_DAYS,
  "requiresFrom"
);

export const personaActivityResponseSchema = z
  .object({
    from: z.string().openapi({
      description: "First UTC day covered (YYYY-MM-DD).",
    }),
    to: z.string().openapi({
      description:
        "UTC day after the last day covered (YYYY-MM-DD). Exclusive end of the range.",
    }),
    points: z
      .array(
        z.object({
          personaId: z.string().openapi({
            description: "Persona the answers belong to.",
          }),
          snapshotVersion: z.string().openapi({
            description:
              "Hash of the persona context the answers were played with. Changes when the persona is edited.",
          }),
          day: z.string().openapi({ description: "UTC day (YYYY-MM-DD)." }),
          lastCheckedAt: z.string().openapi({
            description: "Latest answer captured that day.",
          }),
          checks: z.number().int().openapi({
            description:
              "Persona answers captured that day across all turns and engines.",
          }),
          mentions: z.number().int().openapi({
            description: "Of those, answers that mentioned the tracked brand.",
          }),
        })
      )
      .openapi({
        description:
          "One point per persona, persona version and day that had answers. Days without answers are omitted.",
      }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoPersonaActivityResponse")
  .openapi({
    description:
      "Daily persona answer and mention counts over the requested window.",
  });

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
    id: z.string().openapi({ description: "Generation job id." }),
    status: z.enum(["queued", "running", "completed", "failed"]).openapi({
      description:
        "State of the job, which you poll until it is `completed` or `failed`.",
    }),
    personaId: z.string().nullable().openapi({
      description:
        "Persona being regenerated, or `null` when the job creates new personas.",
    }),
    startedAt: z.string().openapi({ description: "When the job was queued." }),
    error: z.string().nullable().openapi({
      description:
        "Failure message when `status` is `failed`, otherwise `null`.",
    }),
  })
  .openapi("GeoPersonaGenerationJob")
  .openapi({ description: "A background job that generates personas." });

export const personaGenerationResponseSchema = z
  .object({
    job: personaGenerationJobSchema.nullable().openapi({
      description:
        "The project's current or most recent generation job. Starting a generation while one is queued or running returns that job instead of a new one. `null` when no job was recorded in the last 7 days.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoPersonaGenerationResponse")
  .openapi({
    description:
      "The project's persona generation job and the workspace it belongs to.",
  });

export const runPersonaResponseSchema = z
  .object({
    checks: z.number().int().openapi({
      description:
        "Answers recorded during this request by the API-based engines that responded.",
    }),
    mentions: z.number().int().openapi({
      description: "How many of those answers mentioned the tracked brand.",
    }),
    engines: z.array(z.string()).openapi({
      description:
        "API-based engines the persona was played against during this request. Empty when only consumer apps run or none of the API engines answered.",
    }),
    queuedScanId: z.string().nullable().default(null).openapi({
      description:
        "Scan that plays the persona in the tracked consumer apps in the background, or `null`. Poll `GET /v1/projects/{projectId}/geo/scans/{scanId}`.",
    }),
    queuedEngines: z.array(z.string()).default([]).openapi({
      description:
        "Consumer-app engines covered by `queuedScanId`. Empty when nothing was queued.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("RunGeoPersonaResponse")
  .openapi({
    description:
      "Outcome of playing the persona once against the project's engines, plus any scan queued for consumer apps.",
  });
