import { expect, test } from "bun:test";

import { settleWithin } from "./settle-within";

test("returns the value when the promise settles in time", async () => {
  expect(await settleWithin(Promise.resolve(true), 50)).toBe(true);
});

test("returns undefined when the promise is slower than the budget", async () => {
  const slow = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(true), 200);
  });
  expect(await settleWithin(slow, 10)).toBeUndefined();
});
