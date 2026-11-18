import * as z from "zod";

import {
  AUTOPILOT_ONBOARDING_GOAL_IDS,
  AUTOPILOT_ONBOARDING_STORAGE_VERSION,
} from "@/constants/autopilot-onboarding";

const mode = z.enum(["ask", "auto"]);

/**
 * The answers kept in the session for the GitHub and Slack redirects.
 * Anything that doesn't match, from an older version or a broken write, is
 * dropped and the chat starts over.
 */
export const storedOnboardingSchema = z.object({
  version: z.literal(AUTOPILOT_ONBOARDING_STORAGE_VERSION),
  answers: z.object({
    intro: z
      .object({
        hello: z.string(),
        audienceOptions: z.array(z.string()),
        voiceOptions: z.array(z.string()),
        rivals: z.array(z.string()),
      })
      .optional(),
    goal: z
      .object({
        goals: z.array(z.enum(AUTOPILOT_ONBOARDING_GOAL_IDS)),
        text: z.string(),
      })
      .optional(),
    about: z
      .object({
        audience: z.string().nullable(),
        voice: z.string().nullable(),
        rival: z.string().nullable(),
      })
      .optional(),
    repository: z.string().optional(),
    approvals: z.object({ posts: mode, updates: mode, fixes: mode }).optional(),
    slack: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
    asked: z.record(z.string(), z.array(z.string()).nullable()).optional(),
    replies: z.record(z.string(), z.string()).optional(),
    asides: z
      .record(
        z.string(),
        z.array(z.object({ answer: z.string(), reply: z.string() }))
      )
      .optional(),
    jobs: z.record(z.string(), z.boolean()).optional(),
    rules: z.array(z.string()).optional(),
    notes: z.array(z.string()).optional(),
    known: z.record(z.string(), z.literal(true)).optional(),
  }),
});
