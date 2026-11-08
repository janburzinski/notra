import { AUTOPILOT_AGENT_STEP_EVENT_KIND } from "@notra/db/constants/autopilot";
import type { AutopilotRunEventData } from "@notra/db/types/autopilot";

import { AUTOPILOT_TRACE_TEXT_MAX_CHARS } from "@/constants/autopilot";
import {
  AUTOPILOT_SECRET_FIELD,
  AUTOPILOT_SECRET_VALUE,
} from "@/constants/autopilot-observability";
import type { AutopilotAgentStepSource } from "@/types/autopilot-runtime";

/** Defense in depth, not a guarantee that arbitrary source text is public. */
export function redactAutopilotTraceDetail(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(AUTOPILOT_SECRET_VALUE, "[redacted]");
  }
  if (Array.isArray(value)) {
    return value.map(redactAutopilotTraceDetail);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        AUTOPILOT_SECRET_FIELD.test(key)
          ? "[redacted]"
          : redactAutopilotTraceDetail(entry),
      ])
    );
  }
  return value;
}

/** Long strings are clipped so one trace never bloats a row. */
export function clipAutopilotTraceDetail(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > AUTOPILOT_TRACE_TEXT_MAX_CHARS
      ? `${value.slice(0, AUTOPILOT_TRACE_TEXT_MAX_CHARS)}… (${value.length} chars)`
      : value;
  }
  if (Array.isArray(value)) {
    return value.map(clipAutopilotTraceDetail);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        clipAutopilotTraceDetail(entry),
      ])
    );
  }
  return value;
}

/**
 * What the admin console charts for one agent step. durationMs runs from the
 * previous step's end, so it covers the model call and the tools it ran.
 */
export function autopilotAgentStepData(
  step: AutopilotAgentStepSource,
  stepNumber: number,
  durationMs: number
): AutopilotRunEventData {
  return {
    kind: AUTOPILOT_AGENT_STEP_EVENT_KIND,
    step: stepNumber,
    model: step.model.modelId,
    finishReason: step.finishReason,
    durationMs,
    inputTokens: step.usage.inputTokens ?? null,
    outputTokens: step.usage.outputTokens ?? null,
    cachedInputTokens: step.usage.inputTokenDetails.cacheReadTokens ?? null,
    reasoningTokens: step.usage.outputTokenDetails.reasoningTokens ?? null,
    tools: step.toolCalls.flatMap((call) => (call ? [call.toolName] : [])),
  };
}
