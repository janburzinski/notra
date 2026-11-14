import "zod/compile";
import { z } from "@hono/zod-openapi";

export const geoImportIssueSchema = z.object({
  line: z.number().int().openapi({
    description: "CSV line number of the rejected row.",
  }),
  message: z.string().openapi({
    description: "Why the row was rejected.",
  }),
});
