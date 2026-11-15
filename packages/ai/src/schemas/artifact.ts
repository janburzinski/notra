import {
  ARTIFACT_CALLOUT_TONES,
  ARTIFACT_LIMITS as LIMITS,
  ARTIFACT_METRIC_TRENDS,
} from "@notra/ai/constants/artifacts";
import { chartArtifactSchema } from "@notra/ai/schemas/chart-artifact";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalTitle = text(LIMITS.blockTitle)
  .optional()
  .describe("Short heading shown above the block");

export const artifactTextBlockSchema = z
  .object({
    type: z.literal("text"),
    markdown: text(LIMITS.markdown).describe(
      "GitHub-flavored Markdown: paragraphs, ## headings, lists, bold, links"
    ),
  })
  .describe("Prose: the explanation, findings and recommendations");

export const artifactMetricsBlockSchema = z
  .object({
    type: z.literal("metrics"),
    title: optionalTitle,
    items: z
      .array(
        z.object({
          label: text(LIMITS.metricLabel),
          value: text(LIMITS.metricValue).describe(
            "Formatted value with unit, like 12.4k, 18% or $1,200"
          ),
          change: text(LIMITS.metricValue)
            .optional()
            .describe("Change against the previous period, like +18%"),
          trend: z
            .enum(ARTIFACT_METRIC_TRENDS)
            .optional()
            .describe("Whether the change is good (up), bad (down) or flat"),
          note: text(LIMITS.metricNote)
            .optional()
            .describe("Period or source, like Last 7 days"),
        })
      )
      .min(1)
      .max(LIMITS.metricItems),
  })
  .describe("A row of headline numbers");

export const artifactChartBlockSchema = z
  .object({
    type: z.literal("chart"),
    chart: chartArtifactSchema.describe(
      "area for trends over time, bar for ranking categories, pie for shares of a whole. A chart returned by another tool can be passed as is."
    ),
  })
  .describe("A chart");

const tableCellSchema = z.union([
  z.string().max(LIMITS.tableCell),
  z.number(),
  z.null(),
]);

export const artifactTableBlockSchema = z
  .object({
    type: z.literal("table"),
    title: optionalTitle,
    columns: z.array(text(LIMITS.metricLabel)).min(1).max(LIMITS.tableColumns),
    rows: z
      .array(z.array(tableCellSchema).max(LIMITS.tableColumns))
      .max(LIMITS.tableRows)
      .describe(
        "One array per row, cells in column order. Write changes as signed text, like +18% or -3%: rises show green and falls red."
      ),
    lowerIsBetter: z
      .array(text(LIMITS.metricLabel))
      .max(LIMITS.tableColumns)
      .optional()
      .describe(
        "Columns where a fall is good news, like a bounce rate or a rank; their changes are colored the other way round"
      ),
  })
  .describe("A table of rows");

export const artifactCalloutBlockSchema = z
  .object({
    type: z.literal("callout"),
    tone: z.enum(ARTIFACT_CALLOUT_TONES),
    title: optionalTitle,
    text: text(LIMITS.calloutText),
  })
  .describe("A highlighted note: the takeaway, a warning or a next step");

export const artifactAutopilotBlockSchema = z
  .object({
    type: z.literal("autopilot"),
    title: optionalTitle,
    findingIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(LIMITS.findingIds)
      .describe("Autopilot finding ids from the Autopilot status"),
  })
  .describe(
    "Autopilot pull requests and ideas, shown live with their Merge, Write and Close buttons"
  );

export const artifactSourcesBlockSchema = z
  .object({
    type: z.literal("sources"),
    items: z
      .array(
        z.object({
          title: text(LIMITS.sourceTitle),
          url: z.url({ protocol: /^https?$/u }),
        })
      )
      .min(1)
      .max(LIMITS.sources),
  })
  .describe("Links the numbers and claims came from");

export const artifactBlockSchema = z.discriminatedUnion("type", [
  artifactTextBlockSchema,
  artifactMetricsBlockSchema,
  artifactChartBlockSchema,
  artifactTableBlockSchema,
  artifactCalloutBlockSchema,
  artifactAutopilotBlockSchema,
  artifactSourcesBlockSchema,
]);

export const artifactContentSchema = z.object({
  title: text(LIMITS.title).describe("Specific title, like Weekly AI traffic"),
  summary: text(LIMITS.summary)
    .optional()
    .describe("One or two sentences with the main takeaway"),
  blocks: z.array(artifactBlockSchema).min(1).max(LIMITS.blocks),
});

const artifactFileSchema = z
  .string()
  .min(1)
  .describe("The complete artifact file: frontmatter, then the blocks");

export const createArtifactInputSchema = z.object({
  content: artifactFileSchema,
});

export const updateArtifactInputSchema = z.object({
  artifactId: z.string().trim().min(1),
  version: z
    .number()
    .int()
    .positive()
    .describe("The version you read; a newer one in between rejects the save"),
  content: artifactFileSchema.describe(
    "The complete new file, with every block you keep copied exactly"
  ),
});

export const getArtifactInputSchema = z.object({
  artifactId: z.string().trim().min(1),
});

export const listArtifactsInputSchema = z.object({
  query: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe("Words from the title; leave out for the most recent"),
});

/** What the chat recognises as an artifact, whichever agent made it. */
export const toolOutputArtifactSchema = z.looseObject({
  artifact: z.object({
    id: z.string().min(1),
    title: z.string(),
    summary: z.string().nullish(),
    version: z.number().int().positive(),
  }),
  url: z.string().optional(),
});
