import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("the assistant always runs on the GLM model", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--no-env-file",
      "--eval",
      `
import assert from "node:assert/strict";
import { mock } from "bun:test";
mock.module("eve", () => ({ defineDynamic: (value) => value }));
mock.module("@notra/tools/utils/organization", () => ({ getOrganizationId: () => "org-1" }));
const { createAssistantModel } = await import("./agent/lib/utils/model.ts");
const { ASSISTANT_MODEL_ID } = await import("./agent/lib/constants/models.ts");
delete process.env.AI_SDK_DEVTOOLS;
assert.equal(ASSISTANT_MODEL_ID, "zai/glm-5.3-flash");
const route = createAssistantModel().events["step.started"];
function select(turnId, surface) {
  return route({ data: { turnId } }, {
    session: { id: "thread-1", auth: { current: { attributes: { surface } } } },
  });
}
const chat = select("1", "standalone-chat");
assert.equal(chat.model.modelId, ASSISTANT_MODEL_ID);
assert.equal(chat.reasoning, undefined);
const task = select("2", "task");
assert.equal(task.model.modelId, ASSISTANT_MODEL_ID);
assert.equal(task.reasoning, "low");
`,
    ],
    { cwd: resolve(import.meta.dir, ".."), timeout: 30_000 }
  );
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  expect(result.exitCode).toBe(0);
});
