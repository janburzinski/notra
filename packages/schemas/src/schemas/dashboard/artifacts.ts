import { organizationIdSchema } from "@notra/schemas/dashboard/auth/organization";
import * as z from "zod";

const artifactInputSchema = z.object({
  organizationId: organizationIdSchema,
  artifactId: z.string().trim().min(1).max(64),
});

export const getArtifactInputSchema = artifactInputSchema.extend({
  /** A past version; the current one when left out. */
  version: z.number().int().positive().optional(),
});

export const setArtifactSharedInputSchema = artifactInputSchema.extend({
  shared: z.boolean(),
});

export const deleteArtifactInputSchema = artifactInputSchema;

export const restoreArtifactInputSchema = artifactInputSchema.extend({
  version: z.number().int().positive(),
});
