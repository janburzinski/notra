import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import { WORKFLOW_ERROR_POLICIES } from "@notra/workflows/constants/graph";
import * as z from "zod";

import { AUTOPILOT_WORKFLOW_SLACK_MESSAGE_LIMIT } from "@/constants/autopilot-workflows";
import { truncateText } from "@/utils/autopilot-workflows";

export const compareVisibilityConfigSchema = z.object({
  projectId: z.string().min(1).optional(),
  // The agent sometimes writes numbers as text.
  days: z.coerce.number().int().min(1).max(90).default(7),
});

// Limits leave room for earlier steps' output filled into the text at run time.
export const askAgentConfigSchema = z.object({
  instructions: z.string().min(1).max(40_000),
});

export const decideConfigSchema = z.object({
  question: z.string().min(1).max(20_000),
});

export const postToSlackConfigSchema = z.object({
  message: z
    .string()
    .min(1)
    .transform((message) =>
      truncateText(message, AUTOPILOT_WORKFLOW_SLACK_MESSAGE_LIMIT)
    ),
});

export const decisionSchema = z.object({
  answer: z.boolean().describe("true for yes, false for no"),
  reason: z.string().describe("One or two sentences on why"),
});

const autopilotWorkflowScheduleSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly"]),
  hour: z.number().int().min(0).max(23).describe("UTC hour"),
  minute: z.number().int().min(0).max(59).default(0),
  dayOfWeek: z
    .number()
    .int()
    .min(0)
    .max(6)
    .optional()
    .describe("0 is Sunday; weekly only"),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
});

const nodeIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, digits, - and _ only");

export const saveAutopilotWorkflowInputSchema = z.object({
  workflowId: z
    .string()
    .optional()
    .describe("Pass to update an existing workflow; omit to create one"),
  name: z.string().min(1).max(120),
  description: z
    .string()
    .max(500)
    .optional()
    .describe("One sentence on what the workflow keeps the user on track with"),
  schedule: autopilotWorkflowScheduleSchema
    .nullable()
    .optional()
    .describe("When it runs on its own, in UTC. null for manual only"),
  enabled: z
    .boolean()
    .optional()
    .describe("Whether the schedule is on. Defaults to true with a schedule"),
  nodes: z
    .array(
      z.object({
        id: nodeIdSchema,
        type: z.string().min(1),
        title: z.string().min(1).max(160),
        description: z.string().max(1000).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        onError: z.enum(WORKFLOW_ERROR_POLICIES).optional(),
      })
    )
    .min(2)
    .max(30),
  edges: z
    .array(
      z.object({
        source: nodeIdSchema,
        target: nodeIdSchema,
        sourcePort: nodeIdSchema
          .optional()
          .describe("Branch to follow, such as yes or no"),
      })
    )
    .max(60),
});

export const workflowIdToolInputSchema = z.object({
  workflowId: z.string().min(1),
});

export const workflowRunToolInputSchema = z.object({
  runId: z.string().min(1),
});

export const autopilotWorkflowInputSchema = organizationIdInputSchema.extend({
  workflowId: z.string().min(1),
});

export const autopilotWorkflowEnabledInputSchema =
  autopilotWorkflowInputSchema.extend({
    enabled: z.boolean(),
  });

export const autopilotWorkflowRunInputSchema = organizationIdInputSchema.extend(
  {
    runId: z.string().min(1),
  }
);

export const autopilotWorkflowDeliverySchema = z.object({
  workflowId: z.string().min(1),
});

/** The agent's tools that list steps or workflows take no input. */
export const listAutopilotWorkflowStepsInputSchema = z.object({});
export const listAutopilotWorkflowsInputSchema = z.object({});
