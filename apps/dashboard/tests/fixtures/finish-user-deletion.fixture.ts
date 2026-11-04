import { afterAll, expect, mock, spyOn, test } from "bun:test";

const pending: Promise<unknown>[] = [];
const calls: string[] = [];
const logError = mock(
  (message: string, _error?: unknown, fields?: Record<string, unknown>) => {
    calls.push(`log:${message}:${JSON.stringify(fields)}`);
  }
);

process.env.DATABUDDY_API_KEY = "synthetic-key";
process.env.NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID = "synthetic-website";
const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async () => {
  calls.push("databuddy");
  throw new TypeError("fetch failed");
}) as unknown as typeof fetch);
afterAll(() => fetchSpy.mockRestore());

mock.module("@notra/ai/utils/server-log", () => ({ logError }));
mock.module("@/lib/framework/after-response", () => ({
  afterResponse: (task: () => Promise<unknown>) => {
    pending.push(task());
  },
}));
mock.module("@notra/email/utils/brew", () => ({
  deleteBrewContact: async (email: string) => {
    calls.push(`brew:${email}`);
    throw new Error("Synthetic Brew failure");
  },
}));
mock.module("@/lib/slack/info-channel", () => ({
  notifyInfoChannel: () => {
    calls.push("slack");
  },
}));

const { finishUserDeletion } =
  await import("../../src/lib/auth/finish-user-deletion");

test("failed erasure steps, network errors included, are logged with the user ID and block nothing", async () => {
  expect(() =>
    finishUserDeletion({ userId: "user-1", email: "deleted@example.test" })
  ).not.toThrow();
  await Promise.all(pending);
  expect(calls.toSorted()).toEqual([
    "brew:deleted@example.test",
    "databuddy",
    'log:[Delete User] Brew contact deletion failed:{"userId":"user-1","step":"Brew contact deletion"}',
    'log:[Delete User] Databuddy visitor deletion failed:{"userId":"user-1","step":"Databuddy visitor deletion"}',
    "slack",
  ]);
});
