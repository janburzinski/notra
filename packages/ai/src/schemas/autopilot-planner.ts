import { z } from "zod";

export const autopilotPlannerOutputSchema = z.object({
  assignments: z
    .array(
      z.object({
        observationId: z.string(),
        topicSlug: z
          .string()
          .describe(
            "An existing topic's slug, or a new short kebab-case slug to start a topic"
          ),
        newTopicTitle: z
          .string()
          .nullable()
          .describe("Title when topicSlug starts a new topic, else null"),
      })
    )
    .describe("Exactly one entry per observation"),
  topics: z
    .array(
      z.object({
        slug: z
          .string()
          .describe(
            "An existing topic's slug, or the slug of a topic started this run"
          ),
        status: z.enum(["watching", "researching", "ready", "dismissed"]),
        summary: z.string(),
        openQuestions: z.array(z.string()),
        nextStep: z
          .string()
          .describe(
            "One short sentence on what should happen next, e.g. the evidence still missing; empty when nothing would make it worth acting on"
          ),
      })
    )
    .describe("Updates for every topic this run touched or re-assessed"),
  action: z.object({
    type: z.enum(["none", "write_post", "update_page"]),
    topicSlug: z
      .string()
      .nullable()
      .describe(
        "An existing topic's slug, or the slug of a topic started this run"
      ),
    reason: z.string(),
    brief: z
      .object({
        topic: z
          .string()
          .describe(
            "The question or problem in the words people ask an AI assistant or search for, never a release announcement"
          ),
        angle: z
          .string()
          .describe(
            "How the post answers it better than the pages that win today, with any shipped feature as part of the answer"
          ),
      })
      .nullable()
      .describe("What the writer should cover; null when type is none"),
    exception: z
      .string()
      .nullable()
      .describe(
        "Only when your action overrules a default bar (fewer independent signals than the bar, or no demand): your own reason, from the evidence. Null for a normal action or none"
      ),
  }),
});
