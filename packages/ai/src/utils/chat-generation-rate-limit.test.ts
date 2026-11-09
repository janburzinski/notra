import { expect, mock, test } from "bun:test";

const evals: { keys: string[]; args: number[] }[] = [];
let scriptResult: [number, number] = [5, 20];

mock.module("@notra/ai/utils/redis", () => ({
  redis: {
    eval: async (_script: string, keys: string[], args: number[]) => {
      evals.push({ keys, args });
      return scriptResult;
    },
  },
}));

const { consumeChatGenerationRateLimit } =
  await import("./chat-generation-rate-limit");

test("counts against the shared organization window and the given user key", async () => {
  const result = await consumeChatGenerationRateLimit("org-1", "slack:T1:U1");
  const window = Math.floor(Date.now() / 60_000);

  expect(result.success).toBe(true);
  expect(result.remaining).toBe(5);
  expect(evals[0]?.keys).toEqual([
    `ratelimit:chat-generation:org-1:${window}`,
    `ratelimit:chat-generation:org-1:${window - 1}`,
    `ratelimit:dashboard-chat-generation-user:org-1:slack:T1:U1:${window}`,
    `ratelimit:dashboard-chat-generation-user:org-1:slack:T1:U1:${window - 1}`,
  ]);
  expect(evals[0]?.args.slice(0, 2)).toEqual([30, 20]);
});

test("reports a rejected generation", async () => {
  scriptResult = [-1, 30];
  const result = await consumeChatGenerationRateLimit("org-1", "user-1");

  expect(result).toMatchObject({ success: false, limit: 30, remaining: 0 });
});
