import { z } from "zod";

import {
  GEO_MAX_ENGINES,
  GEO_PROMPT_MAX_LENGTH,
  GEO_SHORT_FIELD_MAX_LENGTH,
} from "../constants/geo";

export const geoPromptScanEnginesSchema = z
  .array(z.string().trim().min(1).max(GEO_SHORT_FIELD_MAX_LENGTH))
  .min(1)
  .max(GEO_MAX_ENGINES);

/** What Notra's agent sends the dashboard to scan one tracked prompt. */
export const geoPromptScanRequestSchema = z.object({
  organizationId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).optional(),
  prompt: z.string().trim().min(1).max(GEO_PROMPT_MAX_LENGTH),
  engines: geoPromptScanEnginesSchema.optional(),
});

/** What Notra's agent sends to find tracked prompts before scanning one. */
export const geoPromptFindRequestSchema = z.object({
  organizationId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).optional(),
  query: z.string().trim().max(GEO_PROMPT_MAX_LENGTH).optional(),
});

const promptChoiceSchema = z.object({ id: z.string(), prompt: z.string() });

export const geoPromptFindResponseSchema = z.object({
  prompts: z.array(promptChoiceSchema),
  total: z.number().int().min(0),
});

/**
 * started: the scan is running. choose: the prompt text matched several
 * tracked prompts. not_found: it matched none. Both list prompts to pick from.
 */
export const geoPromptScanResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("started"),
    scanId: z.string(),
    promptId: z.string(),
    prompt: z.string(),
  }),
  z.object({
    status: z.enum(["choose", "not_found"]),
    prompts: z.array(promptChoiceSchema),
  }),
]);

export const geoPromptScanErrorSchema = z.object({ error: z.string() });
