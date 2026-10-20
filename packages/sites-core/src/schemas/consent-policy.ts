import { z } from "zod";

export const c15tInitPolicySchema = z.object({
  policy: z.object({ model: z.string() }),
});
