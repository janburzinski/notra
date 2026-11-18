import "zod/compile";
import { organizationIdSchema } from "@notra/schemas/dashboard/auth/organization";
import * as z from "zod";

export const webhookLogDetailInputSchema = z.object({
  organizationId: organizationIdSchema,
  logId: z.string().min(1),
});
