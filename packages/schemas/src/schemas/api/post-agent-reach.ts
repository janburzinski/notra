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
    postId: z.string().openapi({ description: "ID of the post." }),
    siteId: z.string().openapi({
      description:
        "Notra Site the post is live on. Use it with the /v1/sites endpoints.",
    }),
    path: z.string().openapi({
      description:
        "Path the post is served at on its Site. Visits to its Markdown copy (`<path>.md`) and index files are counted too.",
      example: "/blog/launch",
    }),
    url: z.string().openapi({
      description: "Public URL of the post on the Site's production origin.",
      example: "https://example.com/blog/launch",
    }),
    configured: trafficConfiguredField,
    totals: z
      .object({
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
        total: z.number().int().openapi({
          description: "Sum of crawled, cited and referred.",
        }),
      })
      .openapi({
        description: "AI visits to the post in the window, by visitor type.",
      }),
    sources: z.array(trafficSourceSchema).openapi({
      description:
        "Visits per AI crawler and AI referral source in the window.",
    }),
    points: z.array(trafficPointSchema).openapi({
      description: "Daily visits per source and visitor type.",
    }),
  })
  .openapi("PostAgentReach")
  .openapi({
    description:
      "How AI crawlers, assistants and AI referrals reached the post.",
  });

export const postAgentReachResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    agentReach: postAgentReachSchema.nullable().openapi({
      description:
        "Null when the post isn't live on a Notra Site: never published to one, published to another branch, or the Site has no production deployment.",
    }),
  })
  .openapi("PostAgentReachResponse")
  .openapi({
    description: "AI traffic to a post published on a Notra Site.",
  });
