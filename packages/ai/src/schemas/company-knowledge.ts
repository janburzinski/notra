import * as z from "zod";

export const searchCompanyKnowledgeInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(10).default(5),
});
