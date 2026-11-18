import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import * as z from "zod";

import { AUTOPILOT_RULE_MAX_CHARS } from "@/constants/autopilot";
import { AUTOPILOT_ONBOARDING_GOAL_IDS } from "@/constants/autopilot-onboarding";

export const blogFileSchema = z.object({
  slug: z.string().describe("kebab-case file slug without extension"),
  extension: z.enum(["md", "mdx"]),
  title: z.string(),
  content: z
    .string()
    .describe(
      "The complete file including frontmatter in the repository's existing format"
    ),
  pullRequestBody: z
    .string()
    .describe(
      "Concise Markdown PR description: one sentence on the reader benefit, then at most three short bullets about what the post covers. Omit word counts, frontmatter details, lists of internal URLs, headings, and attribution; Notra adds its own branded footer."
    ),
});

export const readinessAgentOutputSchema = z.object({
  framework: z
    .string()
    .describe(
      "Detected site framework, e.g. Next.js App Router, Astro, static HTML"
    ),
  pullRequestTitle: z.string(),
  pullRequestBody: z.string().describe("Markdown body explaining each change"),
});

const auditLinesSchema = z
  .array(z.string())
  .describe("One short line per section, e.g. 'Pricing table: 2024 prices'");

const pageEditSchema = z.object({
  action: z.enum(["update", "add", "cut"]),
  section: z.string().describe("The heading of the section the edit is in"),
  find: z
    .string()
    .min(1)
    .describe(
      "An exact passage of the current file, copied character for character, that appears in it once"
    ),
  replace: z.string().describe("The new text for that passage"),
});

export const refreshOutputSchema = z.object({
  audit: z.object({
    keep: auditLinesSchema,
    update: auditLinesSchema,
    add: auditLinesSchema,
    cut: auditLinesSchema,
  }),
  edits: z.array(pageEditSchema),
  pullRequestTitle: z
    .string()
    .describe(
      "Short, e.g. 'Refresh GPU autoscaling guide: cold starts, 2026 prices'"
    ),
  summary: z
    .string()
    .describe("One sentence on what the refresh gives readers"),
});

export const refreshRepairSchema = z.object({
  edits: z.array(pageEditSchema),
});

const passageEditSchema = z.object({
  find: z
    .string()
    .min(1)
    .describe("An exact passage of the page that appears once"),
  replace: z.string(),
});

export const dashRewriteSchema = z.object({
  edits: z.array(passageEditSchema),
});

export const claimRemovalSchema = z.object({
  edits: z.array(
    passageEditSchema.extend({
      claim: z.string().describe("The claim this edit removes, as given"),
    })
  ),
});

export const factCheckSchema = z.object({
  claims: z.array(
    z.object({
      claim: z.string(),
      about: z.enum(["competitor", "brand", "other"]),
      supported: z.boolean(),
      source: z
        .string()
        .describe("The label of the source that states it, or empty"),
      quote: z
        .string()
        .describe(
          "A short quote copied word for word from that source, or empty"
        ),
      fix: passageEditSchema
        .nullable()
        .describe(
          "Removes or corrects the claim; used only if it turns out unsupported"
        ),
    })
  ),
});

export const landingAgentOutputSchema = z.object({
  pullRequestTitle: z.string(),
  summary: z
    .string()
    .describe(
      "What the new copy answers that the old copy didn't, in one sentence"
    ),
  notes: z
    .string()
    .describe(
      "Markdown bullets: why each change helps the prompts or searches"
    ),
});

export const renderingAgentOutputSchema = z.object({
  framework: z
    .string()
    .describe("Detected site framework, e.g. Next.js App Router, Astro"),
  cause: z
    .string()
    .describe("Why crawlers missed the content, in one sentence"),
  pullRequestTitle: z.string(),
  pullRequestBody: z.string().describe("Markdown body explaining each change"),
});

export const ruleSchema = z.object({
  rule: z
    .string()
    .max(AUTOPILOT_RULE_MAX_CHARS)
    .nullable()
    .describe(
      "One short imperative rule starting with 'Never', or null when the message only declines this one item"
    ),
});

export const autopilotFeedbackSchema = z.object({
  reply: z.string().max(700),
  learning: z.string().max(1000).nullable(),
  rule: z.string().max(AUTOPILOT_RULE_MAX_CHARS).nullable(),
  removeRuleId: z.string().nullable(),
});

export const autopilotRuleComplianceSchema = z.object({ allowed: z.boolean() });

export const linksReviewSchema = z.object({
  decisions: z.array(
    z.object({
      id: z.string().describe("The candidate's id, as given"),
      keep: z.boolean(),
      reason: z.string().describe("A few words on why"),
    })
  ),
});

const approvalModeSchema = z.enum(["ask", "auto"]).nullable();

/** What Ollie makes of an answer in the team's own words. */
export const autopilotOnboardingTurnSchema = z.object({
  understood: z
    .boolean()
    .describe(
      "False when the answer decides nothing for this question: unsure, off topic or a question back. The question is then asked again"
    ),
  goals: z
    .array(z.enum(AUTOPILOT_ONBOARDING_GOAL_IDS))
    .describe("Goal question only: every goal the answer asks for"),
  automations: z
    .array(
      z.object({
        kind: z.enum(AUTOPILOT_AUTOMATION_KINDS),
        on: z.boolean(),
      })
    )
    .describe(
      "Every automation the answer asks for, focuses on or rules out, e.g. winning comparison questions turns comparisons on"
    ),
  approvals: z
    .object({
      posts: approvalModeSchema,
      updates: approvalModeSchema,
      fixes: approvalModeSchema,
    })
    .describe(
      "Approvals per kind the answer decides; null for every kind it doesn't decide"
    ),
  slackChannel: z
    .string()
    .nullable()
    .describe(
      "Slack question only: the listed channel the answer picks, exactly as listed; null for none"
    ),
  skipSlack: z
    .boolean()
    .describe("Slack question only: the answer wants no brief in Slack"),
  rules: z
    .array(z.string())
    .describe(
      "Every always or never instruction in the answer, as a short imperative such as 'Never write about pricing'"
    ),
  note: z
    .string()
    .nullable()
    .describe(
      "One sentence of context for every run (audience, priorities, focus), without the rules; null when there is none"
    ),
  reply: z
    .string()
    .describe(
      "Written last: Ollie's reply, one or two short warm sentences that say back exactly what the fields above do, and nothing they don't"
    ),
});

/** Ollie's opening and the "about you" choices, from what he read up on. */
export const autopilotOnboardingIntroSchema = z.object({
  hello: z
    .string()
    .describe(
      "Ollie's first message: greets the person by first name and names one or two concrete facts from the data; at most two short sentences. It doesn't say what Autopilot does or that he has questions: the chat says both right after it"
    ),
  audienceOptions: z
    .array(z.string())
    .describe(
      "Three distinct readers this brand most likely writes for, 2 to 5 words each, from the brand data"
    ),
  voiceOptions: z
    .array(z.string())
    .describe(
      "Three distinct ways the posts could sound that fit this brand, 2 to 5 words each, e.g. 'Straight to the point'"
    ),
});
