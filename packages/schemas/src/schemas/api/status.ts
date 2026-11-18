import "zod/compile";
import { z } from "@hono/zod-openapi";

export const publicStatusResponseSchema = z
  .object({
    status: z.literal("ok").openapi({
      description: "Always ok when the API is reachable.",
    }),
    service: z.literal("Notra API").openapi({ description: "Service name." }),
    version: z.string().openapi({ description: "API version." }),
    public: z.literal(true).openapi({
      description: "This endpoint needs no authentication.",
    }),
    authentication: z
      .object({
        type: z.literal("bearer").openapi({
          description:
            "Send an API key or OAuth access token as a bearer token in the Authorization header.",
        }),
        resource_metadata: z.string().url().openapi({
          description:
            "OAuth protected resource metadata URL, for discovering the authorization server.",
        }),
        guide: z.string().url().openapi({
          description: "URL of the authentication guide for agents.",
        }),
      })
      .openapi({ description: "How to authenticate against the API." }),
  })
  .openapi("PublicStatusResponse")
  .openapi({
    description: "Reachability check and authentication discovery metadata.",
  });
