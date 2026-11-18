import {
  CUSTOM_SCHEDULE_MAX_INTERVAL_DAYS,
  CUSTOM_SCHEDULE_MIN_INTERVAL_DAYS,
} from "@notra/ai/constants/schedule-interval";
import {
  GEO_ALERT_MAX_THRESHOLD,
  GEO_ALERT_SIGNALS,
} from "@notra/schemas/dashboard/automation/geo-alerts";
import {
  CRON_FREQUENCIES,
  LOOKBACK_WINDOWS,
  MAX_SCHEDULE_INSTRUCTIONS_LENGTH,
  MAX_SCHEDULE_NAME_LENGTH,
  SUPPORTED_AUTOMATION_OUTPUT_TYPES,
  WEBHOOK_EVENT_TYPES,
} from "@notra/schemas/dashboard/integrations";
import * as z from "zod";

const automationIdSchema = z
  .string()
  .min(1)
  .describe("The automation's id from listAutomations.");

const nameSchema = z.string().trim().min(1).max(MAX_SCHEDULE_NAME_LENGTH);

const repositoryIdsSchema = z
  .array(z.string().trim().min(1))
  .min(1)
  .describe(
    "GitHub integration IDs. Use integrationId values from getAvailableIntegrations."
  );

const outputTypeSchema = z
  .enum(SUPPORTED_AUTOMATION_OUTPUT_TYPES)
  .describe("Content drafted each run.");

const instructionsSchema = z
  .string()
  .trim()
  .max(MAX_SCHEDULE_INSTRUCTIONS_LENGTH)
  .describe(
    "Extra writing instructions for each run. An empty string clears them."
  );

const brandVoiceIdSchema = z
  .string()
  .nullable()
  .describe(
    "Brand identity id from listBrandIdentities. null uses the default."
  );

const notifySchema = z
  .object({ slack: z.boolean(), email: z.boolean() })
  .describe("Whether a finished draft is announced in Slack and by email.");

const autoPublishSchema = z
  .boolean()
  .describe(
    "Publish changelog and blog drafts right away. Only when the user explicitly asks; other output types always stay drafts."
  );

export const listAutomationsInputSchema = z.object({});

export const updateScheduleInputSchema = z.object({
  scheduleId: automationIdSchema,
  name: nameSchema.optional(),
  frequency: z.enum(CRON_FREQUENCIES).optional(),
  hour: z
    .number()
    .int()
    .min(0)
    .max(23)
    .optional()
    .describe("Hour in UTC. Convert the user's local time first."),
  minute: z.number().int().min(0).max(59).optional(),
  dayOfWeek: z
    .number()
    .int()
    .min(0)
    .max(6)
    .optional()
    .describe("Weekly only: 0 is Sunday."),
  dayOfMonth: z
    .number()
    .int()
    .min(1)
    .max(31)
    .optional()
    .describe("Monthly only."),
  intervalDays: z
    .number()
    .int()
    .min(CUSTOM_SCHEDULE_MIN_INTERVAL_DAYS)
    .max(CUSTOM_SCHEDULE_MAX_INTERVAL_DAYS)
    .optional()
    .describe("Custom frequency only: run every this many days."),
  outputType: outputTypeSchema.optional(),
  repositoryIds: repositoryIdsSchema.optional(),
  lookbackWindow: z.enum(LOOKBACK_WINDOWS).optional(),
  instructions: instructionsSchema.optional(),
  brandVoiceId: brandVoiceIdSchema.optional(),
  autoPublish: autoPublishSchema.optional(),
  notify: notifySchema.optional(),
});

const eventTypesSchema = z
  .array(z.enum(WEBHOOK_EVENT_TYPES))
  .min(1)
  .describe(
    "release: a GitHub release is published. push: commits land on the default branch."
  );

export const createEventTriggerInputSchema = z.object({
  repositoryIds: repositoryIdsSchema,
  eventTypes: eventTypesSchema,
  outputType: outputTypeSchema,
  includePreReleases: z
    .boolean()
    .default(true)
    .describe("Releases only: also react to pre-releases."),
  instructions: instructionsSchema.optional(),
  brandVoiceId: brandVoiceIdSchema.optional(),
  autoPublish: autoPublishSchema.default(false),
  notify: notifySchema.optional(),
});

export const updateEventTriggerInputSchema = z.object({
  eventTriggerId: automationIdSchema,
  repositoryIds: repositoryIdsSchema.optional(),
  eventTypes: eventTypesSchema.optional(),
  outputType: outputTypeSchema.optional(),
  includePreReleases: z.boolean().optional(),
  instructions: instructionsSchema.optional(),
  brandVoiceId: brandVoiceIdSchema.optional(),
  autoPublish: autoPublishSchema.optional(),
  notify: notifySchema.optional(),
});

const alertSignalSchema = z
  .enum(GEO_ALERT_SIGNALS)
  .describe(
    "visibility_drop: mention rate falls by at least threshold percentage points. mention_lost: the brand drops out of at least threshold prompts. competitor_gain: a competitor shows up in at least threshold new prompts. citation_lost: at least threshold pages stop being cited. scan_failed: a scan fails. scan_summary: a short summary after every scan."
  );

const alertThresholdSchema = z
  .number()
  .int()
  .min(1)
  .max(GEO_ALERT_MAX_THRESHOLD)
  .describe(
    "Minimum change that fires the alert. Only for visibility_drop, mention_lost, competitor_gain and citation_lost; omit for the default."
  );

const alertActionsSchema = z
  .object({ slack: z.boolean(), email: z.boolean(), webhook: z.boolean() })
  .describe(
    "Where the alert goes. Email goes to the workspace owners. Pick at least one, and only channels listAutomations reports as connected."
  );

const alertProjectIdSchema = z
  .string()
  .min(1)
  .nullable()
  .describe("GEO project id from listGeoProjects. null watches every project.");

export const createGeoAlertInputSchema = z.object({
  name: nameSchema,
  signal: alertSignalSchema,
  projectId: alertProjectIdSchema.default(null),
  threshold: alertThresholdSchema.optional(),
  actions: alertActionsSchema,
});

export const updateGeoAlertInputSchema = z.object({
  alertId: automationIdSchema,
  name: nameSchema.optional(),
  signal: alertSignalSchema.optional(),
  projectId: alertProjectIdSchema.optional(),
  threshold: alertThresholdSchema.nullable().optional(),
  actions: alertActionsSchema.optional(),
});

export const setAutomationEnabledInputSchema = z.object({
  automationId: automationIdSchema,
  enabled: z.boolean().describe("false pauses it, true resumes it."),
});

export const automationIdInputSchema = z.object({
  automationId: automationIdSchema,
});
