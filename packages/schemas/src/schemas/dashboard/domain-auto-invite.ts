import "zod/compile";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

export const updateDomainAutoInviteInputSchema =
  organizationIdInputSchema.extend({ enabled: z.boolean() });
