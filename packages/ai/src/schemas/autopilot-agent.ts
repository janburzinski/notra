import {
  AUTOPILOT_AUTOMATION_KINDS,
  AUTOPILOT_JOB_KINDS,
} from "@notra/db/constants/autopilot";
import { z } from "zod";

function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

const idSchema = z.string().trim().min(1).max(64);

const autopilotJobKindSchema = z.enum(AUTOPILOT_JOB_KINDS);
const autopilotAutomationKindSchema = z.enum(AUTOPILOT_AUTOMATION_KINDS);

export const autopilotStatusInputSchema = z.object({});

export const autopilotUpdateSettingsInputSchema = z
  .object({
    enabled: z
      .boolean()
      .optional()
      .describe("false pauses Autopilot entirely, true turns it back on"),
    briefHour: z
      .number()
      .int()
      .min(0)
      .max(23)
      .optional()
      .describe("Hour of day (0-23) the daily brief runs, in the timezone"),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine(isValidTimezone, "Unknown timezone")
      .optional()
      .describe("IANA timezone such as Europe/Berlin"),
    jobs: z
      .partialRecord(autopilotJobKindSchema, z.boolean())
      .optional()
      .describe(
        "Automations to turn on (true) or off (false). Omitted automations keep their setting."
      ),
  })
  .refine(
    (input) =>
      input.enabled !== undefined ||
      input.briefHour !== undefined ||
      input.timezone !== undefined ||
      (input.jobs !== undefined && Object.keys(input.jobs).length > 0),
    "Change at least one setting"
  );

export const autopilotRunInputSchema = z.object({
  kind: autopilotAutomationKindSchema
    .optional()
    .describe("Run only this automation. Omit for the whole daily run."),
});

export const autopilotStopRunInputSchema = z.object({
  runId: idSchema.describe(
    "The running Autopilot or custom workflow run, from get_autopilot_status"
  ),
});

const autopilotFindingActionSchema = z.enum(["write", "dismiss", "merge"]);

export const autopilotFindingActionInputSchema = z.object({
  findingId: idSchema.describe(
    "Finding id from get_autopilot_status or a /autopilot/findings/{id} link in the brief"
  ),
  action: autopilotFindingActionSchema.describe(
    "write: write a saved idea now. dismiss: drop the idea or close its pull request. merge: merge its pull request."
  ),
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .describe(
      "Why it is dismissed, in the user's words. Autopilot learns rules from it."
    ),
});

export const autopilotAddRuleInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(3)
    .max(300)
    .describe("A standing preference, for example 'Never write about pricing'"),
});

export const autopilotDeleteRuleInputSchema = z.object({
  ruleId: idSchema.describe("Rule id from get_autopilot_status"),
});

export const autopilotSetWorkflowInputSchema = z.object({
  workflowId: idSchema.describe("Custom workflow id from get_autopilot_status"),
  enabled: z.boolean(),
});

export const autopilotRunWorkflowInputSchema = z.object({
  workflowId: idSchema.describe("Custom workflow id from get_autopilot_status"),
});

export const autopilotAgentActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("status") }),
  z.object({
    type: z.literal("update_settings"),
    input: autopilotUpdateSettingsInputSchema,
  }),
  z.object({ type: z.literal("run"), input: autopilotRunInputSchema }),
  z.object({ type: z.literal("stop"), input: autopilotStopRunInputSchema }),
  z.object({
    type: z.literal("finding"),
    input: autopilotFindingActionInputSchema,
  }),
  z.object({ type: z.literal("add_rule"), input: autopilotAddRuleInputSchema }),
  z.object({
    type: z.literal("delete_rule"),
    input: autopilotDeleteRuleInputSchema,
  }),
  z.object({
    type: z.literal("set_workflow"),
    input: autopilotSetWorkflowInputSchema,
  }),
  z.object({
    type: z.literal("run_workflow"),
    input: autopilotRunWorkflowInputSchema,
  }),
]);

export const autopilotAgentRequestSchema = z.object({
  organizationId: z.string().trim().min(1),
  slack: z.object({
    teamId: z.string().trim().min(1),
    userId: z.string().trim().min(1),
    channelId: z.string().trim().min(1).optional(),
    threadTs: z.string().trim().min(1).optional(),
  }),
  action: autopilotAgentActionSchema,
});

export const autopilotAgentErrorSchema = z.object({ error: z.string() });
