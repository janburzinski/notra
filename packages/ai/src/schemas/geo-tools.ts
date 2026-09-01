import { z } from "zod";

import {
  GEO_PROMPT_RESULTS_DEFAULT_LIMIT,
  GEO_PROMPT_RESULTS_MAX_LIMIT,
  GEO_SOURCES_DEFAULT_LIMIT,
  GEO_SOURCES_MAX_LIMIT,
} from "../constants/geo-tools";

const geoWindowSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30)
    .describe("Number of trailing days to include."),
});

export const getGeoOverviewInputSchema = geoWindowSchema;

export const getGeoVisibilityTimeseriesInputSchema = geoWindowSchema;

export const getGeoPromptResultsInputSchema = geoWindowSchema.extend({
  limit: z
    .number()
    .int()
    .min(1)
    .max(GEO_PROMPT_RESULTS_MAX_LIMIT)
    .default(GEO_PROMPT_RESULTS_DEFAULT_LIMIT)
    .describe("Maximum number of newest prompt and engine results to return."),
  includeAnswers: z
    .boolean()
    .default(false)
    .describe("Include bounded full answers in addition to excerpts."),
});

export const getGeoSourcesInputSchema = geoWindowSchema.extend({
  limit: z
    .number()
    .int()
    .min(1)
    .max(GEO_SOURCES_MAX_LIMIT)
    .default(GEO_SOURCES_DEFAULT_LIMIT)
    .describe("Maximum number of unique source occurrences to return."),
  promptId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Only return sources for this tracked GEO prompt id."),
  engine: z.string().trim().min(1).optional().describe("Only return sources from this AI engine."),
});
