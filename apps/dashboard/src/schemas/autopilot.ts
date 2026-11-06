import * as z from "zod";

import { AUTOPILOT_RULE_MAX_CHARS } from "@/constants/autopilot";

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
