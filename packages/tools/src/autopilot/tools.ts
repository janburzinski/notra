import {
  autopilotAddRuleInputSchema,
  autopilotDeleteRuleInputSchema,
  autopilotFindingActionInputSchema,
  autopilotRunInputSchema,
  autopilotRunWorkflowInputSchema,
  autopilotSetWorkflowInputSchema,
  autopilotStatusInputSchema,
  autopilotStopRunInputSchema,
  autopilotUpdateSettingsInputSchema,
} from "@notra/ai/schemas/autopilot-agent";
import type { z } from "zod";

import { AUTOPILOT_TOOL_DESCRIPTIONS } from "../constants/autopilot";
import type { AutopilotToolSpec } from "../types/autopilot";

function spec<TSchema extends z.ZodType>(value: AutopilotToolSpec<TSchema>) {
  return value;
}

const always = () => true;

export const getAutopilotStatusSpec = spec({
  description: AUTOPILOT_TOOL_DESCRIPTIONS.status,
  inputSchema: autopilotStatusInputSchema,
  activityLabel: "Checking Autopilot",
  needsConfirmation: null,
  toAction: () => ({ type: "status" }),
});

export const updateAutopilotSettingsSpec = spec({
  description: AUTOPILOT_TOOL_DESCRIPTIONS.updateSettings,
  inputSchema: autopilotUpdateSettingsInputSchema,
  activityLabel: "Updating Autopilot settings",
  needsConfirmation: (input) =>
    input.enabled === false ||
    Object.values(input.jobs ?? {}).some((enabled) => enabled === false),
  toAction: (input) => ({ type: "update_settings", input }),
});

export const runAutopilotSpec = spec({
  description: AUTOPILOT_TOOL_DESCRIPTIONS.run,
  inputSchema: autopilotRunInputSchema,
  activityLabel: "Starting Autopilot",
  needsConfirmation: null,
  toAction: (input) => ({ type: "run", input }),
});

export const stopAutopilotRunSpec = spec({
  description: AUTOPILOT_TOOL_DESCRIPTIONS.stop,
  inputSchema: autopilotStopRunInputSchema,
  activityLabel: "Stopping the Autopilot run",
  needsConfirmation: always,
  toAction: (input) => ({ type: "stop", input }),
});

export const actOnAutopilotFindingSpec = spec({
  description: AUTOPILOT_TOOL_DESCRIPTIONS.finding,
  inputSchema: autopilotFindingActionInputSchema,
  activityLabel: "Updating the Autopilot finding",
  needsConfirmation: (input) => input.action !== "write",
  toAction: (input) => ({ type: "finding", input }),
});

export const addAutopilotRuleSpec = spec({
  description: AUTOPILOT_TOOL_DESCRIPTIONS.addRule,
  inputSchema: autopilotAddRuleInputSchema,
  activityLabel: "Adding an Autopilot rule",
  needsConfirmation: null,
  toAction: (input) => ({ type: "add_rule", input }),
});

export const deleteAutopilotRuleSpec = spec({
  description: AUTOPILOT_TOOL_DESCRIPTIONS.deleteRule,
  inputSchema: autopilotDeleteRuleInputSchema,
  activityLabel: "Removing an Autopilot rule",
  needsConfirmation: always,
  toAction: (input) => ({ type: "delete_rule", input }),
});

export const setAutopilotWorkflowSpec = spec({
  description: AUTOPILOT_TOOL_DESCRIPTIONS.setWorkflow,
  inputSchema: autopilotSetWorkflowInputSchema,
  activityLabel: "Updating the Autopilot workflow",
  needsConfirmation: (input) => !input.enabled,
  toAction: (input) => ({ type: "set_workflow", input }),
});

export const runAutopilotWorkflowSpec = spec({
  description: AUTOPILOT_TOOL_DESCRIPTIONS.runWorkflow,
  inputSchema: autopilotRunWorkflowInputSchema,
  activityLabel: "Running the Autopilot workflow",
  needsConfirmation: null,
  toAction: (input) => ({ type: "run_workflow", input }),
});
