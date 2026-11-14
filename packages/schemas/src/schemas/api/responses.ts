import "zod/compile";
import { z } from "@hono/zod-openapi";

export const rateLimitResponseSchema = z
  .object({
    error: z.string(),
    limit: z.number().int().min(1).openapi({
      description: "Requests allowed per window.",
    }),
    remaining: z.number().int().min(0).openapi({
      description: "Requests left in the current window.",
    }),
    reset: z.number().int().openapi({
      description:
        "When the window resets, as a Unix timestamp in milliseconds. Retry-After gives the wait in seconds.",
    }),
  })
  .openapi("RateLimitErrorResponse");
