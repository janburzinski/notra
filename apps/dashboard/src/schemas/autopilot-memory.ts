import { z } from "zod";

export const autopilotMemoryMetadataSchema = z.object({
  source: z.literal("autopilot"),
  category: z.enum(["rule", "feedback"]),
  text: z.string(),
  origin: z.enum(["github", "dashboard"]),
  sourceUrl: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
});

export const autopilotDocumentSchema = z.object({
  id: z.string(),
  metadata: autopilotMemoryMetadataSchema,
});

export const autopilotDocumentListSchema = z.object({
  documents: z.array(autopilotDocumentSchema),
  pagination: z.object({ currentPage: z.number(), totalPages: z.number() }),
});

export const autopilotDeleteMemorySchema = z.object({
  count: z.number(),
  errors: z.array(z.unknown()),
});

export const autopilotDeleteNamespaceSchema = z.object({
  status: z.literal("deleted"),
  namespace: z.string(),
});

export const autopilotMemoryWriteSchema = z.object({
  id: z.string(),
  status: z.enum([
    "unknown",
    "queued",
    "extracting",
    "chunking",
    "embedding",
    "indexing",
    "done",
  ]),
});

export const autopilotMemorySearchSchema = z.object({
  results: z.array(
    z.object({
      included: z
        .object({ document: z.object({ id: z.string() }).nullish() })
        .optional(),
    })
  ),
});
