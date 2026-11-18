import "zod/compile";
import * as z from "zod";

import { INPUT_INTEGRATION_TYPES } from "./integrations";

export const webhookParamsWithRepoSchema = z.object({
  provider: z.enum(INPUT_INTEGRATION_TYPES),
  organizationId: z.string().min(1),
  integrationId: z.string().min(1),
  repositoryId: z.string().min(1),
});
