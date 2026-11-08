import type { internalSiteApiRequestSchema } from "@notra/schemas/api/sites";
import type { z } from "zod";

export type SiteApiRequest = z.infer<typeof internalSiteApiRequestSchema>;
