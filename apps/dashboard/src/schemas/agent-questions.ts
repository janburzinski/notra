import * as z from "zod";

const agentQuestionSchema = z.object({
  question: z.string().min(1).max(300).describe("Complete question"),
  header: z.string().max(30).describe("Very short label (max 30 chars)"),
  options: z
    .array(
      z.object({
        label: z
          .string()
          .min(1)
          .max(80)
          .describe("Display text (1-5 words, concise)"),
        description: z
          .string()
          .max(200)
          .optional()
          .describe("Explanation of choice"),
      })
    )
    .min(1)
    .max(6)
    .refine(
      (options) =>
        new Set(options.map((option) => option.label)).size === options.length,
      "Give each option a different label"
    )
    .describe("Available choices"),
  multiple: z.boolean().optional().describe("Allow selecting multiple choices"),
});

export const agentQuestionInputSchema = z.object({
  questions: z
    .array(agentQuestionSchema)
    .min(1)
    .max(4)
    .refine(
      (questions) =>
        new Set(questions.map((item) => item.question)).size ===
        questions.length,
      "Ask each question once"
    )
    .describe("Questions to ask"),
});

export const agentQuestionOutputSchema = z.object({
  answers: z
    .array(z.array(z.string()))
    .describe("For each question, the options picked or the user's own words"),
});
