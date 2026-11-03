import { expect, mock, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";

import { createUsageBatcher } from "../src/ingest/usage";
import { coalesce } from "../src/utils/coalesce";

test("usage batcher reports one summed value per organization", async () => {
  const track = mock(async (_organizationId: string, _value: number) => true);
  const usage = createUsageBatcher({ intervalMs: 60_000, track });
  for (let i = 0; i < 500; i++) {
    usage.add(i % 2 === 0 ? "org-a" : "org-b", 1);
  }
  usage.add("org-b", 25);
  expect(usage.size()).toBe(525);
  expect(track).not.toHaveBeenCalled();

  await usage.stop();
  expect(track).toHaveBeenCalledTimes(2);
  expect(track).toHaveBeenCalledWith("org-a", 250);
  expect(track).toHaveBeenCalledWith("org-b", 275);
  expect(usage.size()).toBe(0);
});

test("usage batcher flushes on its interval and stop waits for writes in flight", async () => {
  let release = () => {};
  const track = mock(
    (_organizationId: string, _value: number) =>
      new Promise<boolean>((resolve) => {
        release = () => resolve(true);
      })
  );
  const usage = createUsageBatcher({ intervalMs: 10, track });
  usage.add("org-a", 3);
  await sleep(30);
  expect(track).toHaveBeenCalledWith("org-a", 3);

  let stopped = false;
  const stopping = usage.stop().then(() => {
    stopped = true;
  });
  await sleep(5);
  expect(stopped).toBe(false);
  release();
  await stopping;
  expect(stopped).toBe(true);
  expect(track).toHaveBeenCalledTimes(1);
});

test("usage batcher retries sums Autumn did not record and refuses counts after stop", async () => {
  const recorded = [false, true];
  const track = mock(
    async (_organizationId: string, _value: number) => recorded.shift() ?? true
  );
  const usage = createUsageBatcher({ intervalMs: 10, track });
  usage.add("org-a", 4);
  await sleep(30);
  expect(track).toHaveBeenNthCalledWith(1, "org-a", 4);
  expect(track).toHaveBeenNthCalledWith(2, "org-a", 4);

  await usage.stop();
  expect(usage.add("org-a", 1)).toBe(false);
  expect(usage.size()).toBe(0);
  expect(track).toHaveBeenCalledTimes(2);
});

test("coalesce shares concurrent lookups per key and keeps nothing afterwards", async () => {
  let calls = 0;
  const load = coalesce(
    (key: string) => key,
    async (key: string) => {
      calls++;
      await sleep(5);
      return `${key}:${calls}`;
    }
  );

  const shared = await Promise.all([load("a"), load("a"), load("b")]);
  expect(shared).toEqual(["a:2", "a:2", "b:2"]);
  expect(calls).toBe(2);
  expect(await load("a")).toBe("a:3");
});

test("coalesce shares a failure with every waiter and retries the next call", async () => {
  let fail = true;
  const load = coalesce(
    () => "key",
    async () => {
      await sleep(1);
      if (fail) {
        throw new Error("lookup failed");
      }
      return 1;
    }
  );

  const results = await Promise.allSettled([load(), load()]);
  expect(results.map((result) => result.status)).toEqual([
    "rejected",
    "rejected",
  ]);
  fail = false;
  expect(await load()).toBe(1);
});
