import { GEO_CHART_KINDS } from "@notra/ai/constants/chart-tools";
import {
  GEO_PRODUCT_TOOL_NAME_MAX_LENGTH,
  GEO_PRODUCT_TOOL_NICHE_MAX_LENGTH,
  GEO_PROMPT_SCAN_ID_MAX_LENGTH,
  GEO_PROMPT_SCAN_INPUT_MAX_LENGTH,
  GEO_PROMPT_SCAN_MAX_ENGINES,
  GEO_PROMPTS_MOVE_MAX,
  GEO_TOOL_DEFAULT_COMPETITOR_LIMIT,
  GEO_TOOL_DEFAULT_DAYS,
  GEO_TOOL_DEFAULT_PROMPT_RESULT_LIMIT,
  GEO_TOOL_MAX_COMPETITOR_LIMIT,
  GEO_TOOL_MAX_DAYS,
  GEO_TOOL_MAX_PROMPT_RESULT_LIMIT,
} from "@notra/ai/constants/geo-tools";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

const projectIdSchema = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Limit results to one GEO project ID returned by the project-listing tool. Omit for all projects."
  );

const daysSchema = z
  .number()
  .int()
  .min(1)
  .max(GEO_TOOL_MAX_DAYS)
  .default(GEO_TOOL_DEFAULT_DAYS)
  .describe("Number of trailing days to include.");

const includeAnswersSchema = z
  .boolean()
  .default(false)
  .describe("Return full AI answers instead of short excerpts.");

export const listGeoProjectsInputSchema = z.object({});

export const getGeoOverviewInputSchema = z.object({
  projectId: projectIdSchema,
  days: daysSchema,
});

export const getGeoTimeseriesInputSchema = getGeoOverviewInputSchema;

export const getGeoPromptResultsInputSchema = z.object({
  projectId: projectIdSchema,
  days: daysSchema,
  includeAnswers: includeAnswersSchema,
  limit: z
    .number()
    .int()
    .min(1)
    .max(GEO_TOOL_MAX_PROMPT_RESULT_LIMIT)
    .default(GEO_TOOL_DEFAULT_PROMPT_RESULT_LIMIT)
    .describe("Maximum number of latest prompt and engine results to return."),
});

export const getGeoCompetitorShareInputSchema = z.object({
  projectId: projectIdSchema,
  days: daysSchema,
  limit: z
    .number()
    .int()
    .min(1)
    .max(GEO_TOOL_MAX_COMPETITOR_LIMIT)
    .default(GEO_TOOL_DEFAULT_COMPETITOR_LIMIT)
    .describe("Maximum number of competing brands to return."),
});

export const showGeoChartInputSchema = z.object({
  chart: z
    .enum(GEO_CHART_KINDS)
    .describe(
      "engines: mention rate per AI engine. trend: mention rate per engine over time. competitors: share of voice, the brands AI answers mention most."
    ),
  projectId: projectIdSchema,
  days: daysSchema,
});

export const getGeoProjectContextInputSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .describe("GEO project ID returned by the project-listing tool."),
  includeAnswers: includeAnswersSchema,
  competitorSearch: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe(
      "Find tracked competitors whose name contains this text. Use when the project tracks more competitors than the ones returned."
    ),
});

export const getGeoWriterContextInputSchema = z.object({
  includeAnswers: includeAnswersSchema,
});

export const scanGeoPromptInputSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "GEO project ID from the project-listing tool. Omit for the default project."
    ),
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(GEO_PROMPT_SCAN_INPUT_MAX_LENGTH)
    .describe(
      "The tracked prompt to ask again: its id, its wording, or a part of the wording only one prompt contains."
    ),
  engines: z
    .array(z.string().trim().min(1).max(GEO_PROMPT_SCAN_ID_MAX_LENGTH))
    .min(1)
    .max(GEO_PROMPT_SCAN_MAX_ENGINES)
    .optional()
    .describe(
      'Engine ids to ask, for example ["openai/chatgpt"] for the ChatGPT app or ["google/ai-overview"] for Google AI Overviews. Omit to ask every engine the project tracks.'
    ),
});

export const getGeoScanInputSchema = z.object({
  scanId: z
    .string()
    .trim()
    .min(1)
    .max(GEO_PROMPT_SCAN_ID_MAX_LENGTH)
    .describe("The scanId the prompt scan tool returned"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Answers to skip; pass next_offset from the previous call."),
});

export const findGeoPromptsInputSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "GEO project ID from the project-listing tool. Omit for the default project."
    ),
  query: z
    .string()
    .trim()
    .max(GEO_PROMPT_SCAN_INPUT_MAX_LENGTH)
    .optional()
    .describe(
      "Words from the prompt the user means, such as 'jira alternative'. Omit to list the tracked prompts."
    ),
});

export const createGeoProductInputSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "GEO project ID from the project-listing tool. Omit for the default project."
    ),
  name: z
    .string()
    .trim()
    .min(1)
    .max(GEO_PRODUCT_TOOL_NAME_MAX_LENGTH)
    .describe(
      "The product's name as the company's site uses it, such as 'Raycast Pro'."
    ),
  niche: z
    .string()
    .trim()
    .max(GEO_PRODUCT_TOOL_NICHE_MAX_LENGTH)
    .optional()
    .describe(
      "Optional: who the product is for and the job it does, in one short sentence. Helps file prompts and suggest new ones."
    ),
});

export const moveGeoPromptsInputSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "GEO project ID from the project-listing tool. Omit for the default project."
    ),
  prompts: z
    .array(z.string().trim().min(1).max(GEO_PROMPT_SCAN_INPUT_MAX_LENGTH))
    .min(1)
    .max(GEO_PROMPTS_MOVE_MAX)
    .describe(
      "The tracked prompts to move: ids from findGeoPrompts, or their exact wording."
    ),
  product: z
    .string()
    .trim()
    .min(1)
    .max(GEO_PRODUCT_TOOL_NAME_MAX_LENGTH)
    .nullable()
    .describe(
      "Name of the product to move them into, or null to take them out of their product."
    ),
});

export const updateGeoProductInputSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "GEO project ID from the project-listing tool. Omit for the default project."
    ),
  product: z
    .string()
    .trim()
    .min(1)
    .max(GEO_PRODUCT_TOOL_NAME_MAX_LENGTH)
    .describe("The product's current name."),
  name: z
    .string()
    .trim()
    .min(1)
    .max(GEO_PRODUCT_TOOL_NAME_MAX_LENGTH)
    .optional()
    .describe("The new name, when renaming."),
  niche: z
    .string()
    .trim()
    .max(GEO_PRODUCT_TOOL_NICHE_MAX_LENGTH)
    .nullable()
    .optional()
    .describe(
      "Who the product is for and the job it does, in one short sentence; null clears it."
    ),
});

export const deleteGeoProductInputSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "GEO project ID from the project-listing tool. Omit for the default project."
    ),
  product: z
    .string()
    .trim()
    .min(1)
    .max(GEO_PRODUCT_TOOL_NAME_MAX_LENGTH)
    .describe("The name of the product to delete."),
});
