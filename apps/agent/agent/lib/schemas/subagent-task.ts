import { z } from "zod";

export const subagentTaskInputSchema = z.object({
  message: z
    .string()
    .min(1)
    .describe(
      "Everything the subagent needs; it never sees this conversation."
    ),
});
