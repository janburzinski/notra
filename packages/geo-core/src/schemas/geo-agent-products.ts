import { z } from "zod";

import {
  GEO_AGENT_PROMPTS_MOVE_MAX,
  GEO_PRODUCT_NAME_MAX_LENGTH,
  GEO_PRODUCT_NICHE_MAX_LENGTH,
  GEO_PROMPT_MAX_LENGTH,
} from "../constants/geo";

const scopeShape = {
  organizationId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).optional(),
};

/** What Notra's agent sends the dashboard to add a product to a project. */
export const geoProductCreateRequestSchema = z.object({
  ...scopeShape,
  name: z.string().trim().min(1).max(GEO_PRODUCT_NAME_MAX_LENGTH),
  niche: z.string().trim().max(GEO_PRODUCT_NICHE_MAX_LENGTH).optional(),
});

/** What Notra's agent sends to move tracked prompts into a product. */
export const geoPromptsMoveRequestSchema = z.object({
  ...scopeShape,
  prompts: z
    .array(z.string().trim().min(1).max(GEO_PROMPT_MAX_LENGTH))
    .min(1)
    .max(GEO_AGENT_PROMPTS_MOVE_MAX),
  product: z.string().trim().min(1).max(GEO_PRODUCT_NAME_MAX_LENGTH).nullable(),
});

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  niche: z.string().nullable(),
});

const errorSchema = z.object({
  status: z.literal("error"),
  error: z.string(),
  products: z.array(z.string()).optional(),
});

export const geoProductCreateResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("created"),
    product: productSchema,
    sortedPrompts: z.number().int().min(0),
  }),
  z.object({ status: z.literal("exists"), product: productSchema }),
  errorSchema,
]);

const promptChoiceSchema = z.object({ id: z.string(), prompt: z.string() });

export const geoPromptsMoveResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("moved"),
    product: z.string().nullable(),
    moved: z.array(promptChoiceSchema),
    unmatched: z.array(
      z.object({
        prompt: z.string(),
        reason: z.string(),
        choices: z.array(promptChoiceSchema).optional(),
      })
    ),
  }),
  errorSchema,
]);

/** What Notra's agent sends to rename a product or change its niche. */
export const geoProductUpdateRequestSchema = z.object({
  ...scopeShape,
  product: z.string().trim().min(1).max(GEO_PRODUCT_NAME_MAX_LENGTH),
  name: z.string().trim().min(1).max(GEO_PRODUCT_NAME_MAX_LENGTH).optional(),
  niche: z
    .string()
    .trim()
    .max(GEO_PRODUCT_NICHE_MAX_LENGTH)
    .nullable()
    .optional(),
});

/** What Notra's agent sends to delete a product. */
export const geoProductDeleteRequestSchema = z.object({
  ...scopeShape,
  product: z.string().trim().min(1).max(GEO_PRODUCT_NAME_MAX_LENGTH),
});

export const geoProductUpdateResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("updated"), product: productSchema }),
  errorSchema,
]);

export const geoProductDeleteResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("deleted"),
    product: z.string(),
    unfiledPrompts: z.number().int().min(0),
    refiledPrompts: z.number().int().min(0),
  }),
  errorSchema,
]);
