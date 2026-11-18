import "zod/compile";
import * as z from "zod";

export const commandPaletteNavigateRequestSchema = z.object({
  query: z.string().min(1).max(500),
  slug: z.string().min(1).max(100),
  projectId: z.string().min(1).max(100).optional(),
});

export const commandPaletteNavigateResultSchema = z.object({
  action: z.enum(["navigate", "chat"]),
  path: z.string().nullish(),
  reason: z.string().max(160).default(""),
});
