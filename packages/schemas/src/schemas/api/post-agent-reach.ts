import "zod/compile";
import { z } from "@hono/zod-openapi";

import { organizationResponseSchema } from "./content";
import {
  trafficConfiguredField,
  trafficPointSchema,
  trafficSourceSchema,
} from "./geo-traffic";
import { geoWindowQuerySchema } from "./geo-visibility";

export const postAgentReachQuerySchema = geoWindowQuerySchema.extend({});

const postAgentReachSchema = z
  .object({
    postId: z.string(),
    siteId: z.string(),
    path: z.string().openapi({
      description:
        "Path the post is served at on its Site. Visits to its Markdown copy (`<path>.md`) and index files are counted too.",
      example: "/blog/launch",
    }),
    url: z.string().openapi({ example: "https://example.com/blog/launch" }),
    configured: trafficConfiguredField,
    totals: z.object({
      crawled: z.number().int().openapi({
        description: "Training and search-index crawler visits.",
      }),
      cited: z.number().int().openapi({
        description:
          "Visits from assistants reading the page while answering someone.",
      }),
      referred: z.number().int().openapi({
        description: "People who clicked through from an AI answer.",
      }),
      total: z.number().int(),
    }),
    sources: z.array(trafficSourceSchema),
    points: z.array(trafficPointSchema),
  })
  .openapi("PostAgentReach");

export const postAgentReachResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    agentReach: postAgentReachSchema.nullable().openapi({
      description:
        "Null when the post isn't live on a Notra Site: never published to one, published to another branch, or the Site has no production deployment.",
    }),
  })
  .openapi("PostAgentReachResponse");
