import { afterEach, expect, mock, test } from "bun:test";

const check = mock();
const finalize = mock();
const generate = mock();
let attempt = 1;

const autumnModule = await import("@notra/ai/billing/autumn");
mock.module("@notra/ai/billing/autumn", () => ({
  ...autumnModule,
  autumn: { check, balances: { finalize } },
  allowUnmeteredAiInDevelopment: false,
}));
mock.module("@notra/ai/model", () => ({ createModel: () => ({}) }));
const ai = await import("ai");
mock.module("ai", () => ({ ...ai, generateText: generate }));
const workflow = await import("workflow");
mock.module("workflow", () => ({
  ...workflow,
  getStepMetadata: () => ({ attempt }),
}));

const { runAutopilotAgentText, runAutopilotAgentDecision } =
  await import("./agent");
const call = {
  organizationId: "org_fixture",
  idempotencyKey: "run:node",
  tag: "agent",
  instructions: "Answer concisely.",
  prompt: "How many posts are there?",
};
const lockId = "autopilot-workflow:run:node:1";
const generation = { text: "Three posts.", totalUsage: {}, steps: [] };

afterEach(() => {
  attempt = 1;
  check.mockReset();
  finalize.mockReset();
  generate.mockReset();
});

test("both workflow agent blocks stop before generation when AI credits run out", async () => {
  check.mockResolvedValue({ allowed: false });

  expect(await runAutopilotAgentText(call)).toBeNull();
  expect(await runAutopilotAgentDecision(call)).toBeNull();
  expect(check).toHaveBeenCalledWith(
    expect.objectContaining({ featureId: "ai_credits", requiredBalance: 1 }),
    expect.anything()
  );
  expect(generate).not.toHaveBeenCalled();
  expect(finalize).not.toHaveBeenCalled();
});

test("successful generation confirms the reserved AI credits", async () => {
  check.mockResolvedValue({ allowed: true });
  generate.mockResolvedValue(generation);

  expect(await runAutopilotAgentText(call)).toBe(generation.text);
  expect(finalize).toHaveBeenCalledTimes(1);
  expect(finalize).toHaveBeenCalledWith(
    expect.objectContaining({ lockId, action: "confirm", overrideValue: 1 }),
    expect.objectContaining({
      headers: { "Idempotency-Key": `${lockId}:confirm` },
    })
  );
});

test("a duplicate reservation does not run or settle the same attempt again", async () => {
  check.mockRejectedValue({ status: 409 });

  await expect(runAutopilotAgentText(call)).rejects.toThrow(
    "already has a billing reservation"
  );
  expect(generate).not.toHaveBeenCalled();
  expect(finalize).not.toHaveBeenCalled();
});

test("failed generation releases the hold and the next attempt gets a fresh one", async () => {
  check.mockResolvedValue({ allowed: true });
  generate.mockRejectedValueOnce(new Error("Model unavailable"));
  await expect(runAutopilotAgentText(call)).rejects.toThrow(
    "Model unavailable"
  );
  expect(finalize).toHaveBeenCalledWith(
    { lockId, action: "release" },
    expect.anything()
  );

  attempt = 2;
  generate.mockResolvedValue(generation);
  expect(await runAutopilotAgentText(call)).toBe(generation.text);
  expect(check.mock.calls.map(([input]) => input.lock.lockId)).toEqual([
    lockId,
    "autopilot-workflow:run:node:2",
  ]);
});
