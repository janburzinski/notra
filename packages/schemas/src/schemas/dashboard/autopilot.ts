import "zod/compile";
import { AUTOPILOT_JOB_KINDS } from "@notra/db/constants/autopilot";
import { organizationIdSchema } from "@notra/schemas/dashboard/auth/organization";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

const GITHUB_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

export const autopilotOrganizationInputSchema = z.object({
  organizationId: organizationIdSchema,
});

export const autopilotMetricsDaysSchema = z.union([
  z.literal(7),
  z.literal(30),
  z.literal(90),
]);
export const autopilotMetricsInputSchema =
  autopilotOrganizationInputSchema.extend({
    days: autopilotMetricsDaysSchema.default(30),
  });

export const autopilotFindingInputSchema =
  autopilotOrganizationInputSchema.extend({
    findingId: z.string().trim().min(1).max(64),
  });

export const autopilotRunInputSchema = autopilotOrganizationInputSchema.extend({
  runId: z.string().trim().min(1).max(64),
});

/** GitHub's three ways to merge a pull request. */
export const autopilotMergeMethodSchema = z.enum(["squash", "merge", "rebase"]);

export const autopilotMergeInputSchema = autopilotFindingInputSchema.extend({
  /** Omitted: the first method the repository allows, squash first. */
  method: autopilotMergeMethodSchema.optional(),
});

export const autopilotDismissInputSchema = autopilotFindingInputSchema.extend({
  /** Optional "why"; when it states a preference it becomes an Autopilot rule. */
  reason: z.string().trim().max(300).optional(),
});

export const autopilotRuleInputSchema = autopilotOrganizationInputSchema.extend(
  { text: z.string().trim().min(3).max(300) }
);

export const autopilotRuleIdInputSchema =
  autopilotOrganizationInputSchema.extend({
    ruleId: z.string().trim().min(1).max(64),
  });

export const autopilotJobsSchema = z.object({
  readiness: z.boolean(),
  keywords: z.boolean(),
  commits: z.boolean(),
  prompts: z.boolean().default(true),
  competitors: z.boolean(),
});

export const autopilotSaveInputSchema = autopilotOrganizationInputSchema.extend(
  {
    enabled: z.boolean(),
    /** GEO project Autopilot works for. Omit to keep the saved project. */
    projectId: z.string().trim().min(1).max(64).optional(),
    repository: z
      .object({
        owner: z.string().trim().min(1).max(100).regex(GITHUB_NAME_PATTERN),
        name: z.string().trim().min(1).max(100).regex(GITHUB_NAME_PATTERN),
        branch: z.string().trim().min(1).max(255),
      })
      .nullable(),
    contentPath: z.string().trim().max(200).nullable(),
    slack: z
      .object({
        integrationId: z.string().trim().min(1),
        channelId: z.string().trim().min(1).max(64),
        channelName: z.string().trim().max(200).nullable(),
      })
      .nullable(),
    briefHour: z.number().int().min(0).max(23),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine(isValidTimezone, "Unknown timezone"),
    /** Omit to keep the saved jobs; the settings page turns them on and off one at a time. */
    jobs: autopilotJobsSchema.optional(),
    maxOpenPullRequests: z.number().int().min(1).max(10),
    /** Days before an untouched draft is closed; null never closes. Omit to keep. */
    stalePullRequestDays: z
      .union([z.literal(7), z.literal(14), z.literal(30)])
      .nullable()
      .optional(),
  }
);

/** Turns one job on or off without resending the whole settings form. */
export const autopilotSetJobInputSchema =
  autopilotOrganizationInputSchema.extend({
    kind: z.enum(AUTOPILOT_JOB_KINDS),
    enabled: z.boolean(),
  });

/** One job's recent outcomes, for its automation page. */
export const autopilotJobDecisionsInputSchema =
  autopilotOrganizationInputSchema.extend({
    kind: z.enum(AUTOPILOT_JOB_KINDS),
  });

export const autopilotRunNowInputSchema =
  autopilotOrganizationInputSchema.extend({
    trigger: z.enum(["manual", "onboarding"]).default("manual"),
  });
