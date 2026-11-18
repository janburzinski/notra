import "zod/compile";
import { z } from "@hono/zod-openapi";

import { geoShelfSourceSchema } from "../dashboard/geo-shelf";
import { organizationResponseSchema } from "./content";

export const geoShelfListQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const geoShelfListResponseSchema = z
  .object({
    sources: z.array(geoShelfSourceSchema).openapi({
      description:
        "The project's shelf sources, most recently updated first. Homepage URLs found by scans are left out.",
    }),
    nextOffset: z.number().int().nonnegative().nullable().openapi({
      description:
        "Pass as `offset` to fetch the next page, or `null` when this is the last page.",
    }),
    organization: organizationResponseSchema,
  })
  .openapi("GeoShelfListResponse", {
    description:
      "A page of the project's shelf sources, which are the pages AI answers cite, with their brand placements and listing tickets.",
  });
