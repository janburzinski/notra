import "zod/compile";
import * as z from "zod";

export const clearCompletedGenerationSchema = z.object({
  runId: z.string().min(1),
});
