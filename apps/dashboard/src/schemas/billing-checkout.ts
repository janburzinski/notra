import { z } from "zod";

export const autumnAttachBodySchema = z.looseObject({
  metadata: z.record(z.string(), z.string()).optional(),
  checkoutSessionParams: z
    .looseObject({
      metadata: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});
