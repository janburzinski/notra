import { z } from "zod";

export const linearTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive().optional(),
});

export const linearTokenErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});
