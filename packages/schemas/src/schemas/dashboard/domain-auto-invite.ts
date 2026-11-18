import "zod/compile";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import * as z from "zod";

export const updateDomainAutoInviteInputSchema =
  organizationIdInputSchema.extend({ enabled: z.boolean() });
