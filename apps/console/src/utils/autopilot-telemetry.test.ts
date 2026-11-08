import { expect, test } from "bun:test";

import type { AutopilotTraceEvent } from "@/types/autopilot";
import {
  buildAutopilotTelemetry,
  packAutopilotSpans,
} from "@/utils/autopilot-telemetry";

let sequence = 0;
function event(
  seconds: number,
  message: string,
  fields: Partial<AutopilotTraceEvent> = {}
): AutopilotTraceEvent {
  sequence += 1;
  return {
    id: `e${sequence}`,
    job: "rendering",
    level: "info",
    message,
    internal: false,
    createdAt: new Date(Date.UTC(2026, 10, 1, 10, 0, seconds)).toISOString(),
    data: null,
    detail: null,
    ...fields,
  };
}

test("counts tokens once per call and keeps legacy steps on the timeline", () => {
  const telemetry = buildAutopilotTelemetry([
    event(0, "rendering-agent prompt", { internal: true }),
    event(4, "Agent step 1", { internal: true }),
    event(6, "Agent step 2", {
      internal: true,
      data: {
        kind: "agent-step",
        step: 2,
        model: "anthropic/claude-sonnet-5",
        durationMs: 2000,
        inputTokens: 900,
        outputTokens: 40,
        cachedInputTokens: 600,
        tools: ["readFile", "searchFiles"],
      },
    }),
    // A running sum, not a call: must not add to the totals.
    event(6, "Done exploring, staging the fix", {
      data: { inputTokens: 1500, step: 3 },
    }),
    event(8, "Agent finished with anthropic/claude-sonnet-5", {
      level: "action",
      data: {
        model: "anthropic/claude-sonnet-5",
        steps: 2,
        durationMs: 8000,
        inputTokens: 1500,
        outputTokens: 100,
      },
    }),
    event(9, "Opened pull request #12", { level: "action" }),
    event(9, "Called anthropic/claude-sonnet-5 (planner)", {
      job: null,
      level: "action",
      data: {
        model: "anthropic/claude-sonnet-5",
        durationMs: 3000,
        inputTokens: 300,
        outputTokens: 50,
      },
    }),
  ]);

  expect(telemetry.totals).toMatchObject({
    calls: 2,
    steps: 2,
    toolCalls: 2,
    inputTokens: 1800,
    outputTokens: 150,
    cachedInputTokens: 600,
    modelTimeMs: 11_000,
  });
  const legacy = telemetry.spans.find((span) => span.label === "Step 1");
  expect(legacy && legacy.endMs - legacy.startMs).toBe(4000);
  expect(telemetry.lanes.map((lane) => lane.lane)).toEqual([
    "rendering",
    "run",
  ]);
  expect(telemetry.lanes[0]?.pullRequests).toBe(1);
  expect(telemetry.endMs - telemetry.originMs).toBe(9000);
  // Steps know their loop; extra fields become tooltip rows.
  const step = telemetry.spans.find((span) => span.label === "Step 2");
  expect(step?.loopSteps).toBe(2);
  expect(
    telemetry.marks.find((mark) => mark.label.startsWith("Done"))?.details
  ).toEqual([
    { label: "Input tokens", value: "1,500" },
    { label: "Step", value: "3" },
  ]);
});

test("failed attempts count as calls, also from before they logged a model", () => {
  const telemetry = buildAutopilotTelemetry([
    event(1, "Retrying anthropic/claude-sonnet-5 (fact-check)", {
      level: "action",
      data: { reason: "The response was not valid JSON", outputTokens: 700 },
    }),
    event(4, "Retrying anthropic/claude-sonnet-5 (fact-check)", {
      level: "action",
      data: {
        model: "anthropic/claude-sonnet-5",
        durationMs: 2000,
        inputTokens: 900,
        outputTokens: 800,
      },
    }),
    event(8, "Called anthropic/claude-sonnet-5 (fact-check)", {
      level: "action",
      data: {
        model: "anthropic/claude-sonnet-5",
        durationMs: 4000,
        inputTokens: 900,
        outputTokens: 300,
      },
    }),
  ]);
  expect(telemetry.totals).toMatchObject({
    calls: 3,
    retries: 2,
    inputTokens: 1800,
    outputTokens: 1800,
    modelTimeMs: 6000,
  });
  expect(telemetry.models[0]?.calls).toBe(3);
});

test("concurrent calls in one job get their own rows", () => {
  const calls = buildAutopilotTelemetry(
    [10, 12, 20].map((seconds) =>
      event(seconds, "Called model (fact-check)", {
        data: { model: "m", durationMs: 5000 },
      })
    )
  ).spans;
  expect(packAutopilotSpans(calls).map((row) => row.length)).toEqual([2, 1]);
});
