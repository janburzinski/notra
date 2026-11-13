import { beforeEach, expect, mock, test } from "bun:test";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { DEMO_API_KEY_BACKFILL_TIMEOUT_MS } from "../../src/constants/demo";
import type { DemoSandbox } from "../../src/types/demo";

const createDemoApiKey = mock(
  async (): Promise<{ key: string; keyId: string } | null> => ({
    key: "ntra_demo_backfilled",
    keyId: "key-backfilled",
  })
);
const deleteDemoApiKey = mock(async (_keyId: string) => {});
const updateDemoApiKey = mock(
  async (_input: { keyId: string; organizationId?: string }) => {}
);
const logError = mock();
let updatedRows: Partial<DemoSandbox>[] = [];
let updateFails = false;
let storedRow: Partial<DemoSandbox> | undefined;
let savedKeyId: string | null = null;
const updates: { values: Partial<DemoSandbox>; where: string }[] = [];

mock.module("@notra/db/drizzle", () => ({
  db: {
    transaction: async (work: (tx: unknown) => Promise<unknown>) =>
      work({ insert: () => ({ values: async () => {} }) }),
    update: () => ({
      set: (values: Partial<DemoSandbox>) => ({
        where: (condition: SQL) => {
          updates.push({
            values,
            where: new PgDialect().sqlToQuery(condition).sql,
          });
          return Object.assign(Promise.resolve(), {
            returning: async () => {
              if ("organizationId" in values) {
                return [{ anonymousId: keyless.anonymousId }];
              }
              if (updateFails) {
                throw new Error("update failed");
              }
              return updatedRows;
            },
          });
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () =>
          Object.assign(Promise.resolve([]), {
            limit: async () => [{ apiKeyId: savedKeyId }],
          }),
      }),
    }),
    delete: () => ({ where: async () => {} }),
    query: { demoSandboxes: { findFirst: async () => storedRow } },
  },
}));
mock.module("@notra/ai/utils/redis", () => ({ redis: null }));
mock.module("@notra/ai/utils/server-log", () => ({
  logError,
  logWarn: mock(),
}));
mock.module("@/lib/demo/api-key", () => ({
  createDemoApiKey,
  deleteDemoApiKey,
  updateDemoApiKey,
}));
mock.module("@/lib/demo/database-guard", () => ({
  assertDedicatedDemoDatabase: mock(),
}));
mock.module("@/lib/demo/rebase", () => ({
  rebaseDemoSandbox: mock(),
  shouldRebaseDemoSandbox: mock(),
}));
mock.module("@/lib/demo/seed/workspace", () => ({
  seedDemoWorkspace: mock(),
}));
mock.module("@/lib/framework/after-response", () => ({
  afterResponse: mock(),
}));

const { ensureDemoApiKey, resetDemoSandboxExclusive } =
  await import("../../src/lib/demo/sandbox");

const keyless = {
  anonymousId: "anon-demo",
  organizationId: "org-demo",
  apiKey: null,
  apiKeyId: null,
  expiresAt: new Date("2026-11-20T12:00:00Z"),
} as DemoSandbox;

beforeEach(() => {
  createDemoApiKey.mockClear();
  deleteDemoApiKey.mockClear();
  updateDemoApiKey.mockClear();
  logError.mockClear();
  updates.length = 0;
  updatedRows = [];
  updateFails = false;
  storedRow = undefined;
  savedKeyId = null;
});

test("a sandbox that already has a key is left alone", async () => {
  const keyed = { ...keyless, apiKey: "ntra_demo_old", apiKeyId: "key-old" };
  expect(await ensureDemoApiKey(keyed)).toBe(keyed);
  expect(createDemoApiKey).not.toHaveBeenCalled();
  expect(updates).toHaveLength(0);
});

test("a keyless sandbox gets a key that expires with it", async () => {
  updatedRows = [
    { ...keyless, apiKey: "ntra_demo_backfilled", apiKeyId: "key-backfilled" },
  ];
  const result = await ensureDemoApiKey(keyless);
  expect(result.apiKey).toBe("ntra_demo_backfilled");
  expect(createDemoApiKey).toHaveBeenCalledWith(
    {
      organizationId: "org-demo",
      anonymousId: "anon-demo",
      expiresAt: keyless.expiresAt,
    },
    { timeoutMs: DEMO_API_KEY_BACKFILL_TIMEOUT_MS }
  );
  expect(updates[0]?.values).toEqual({
    apiKey: "ntra_demo_backfilled",
    apiKeyId: "key-backfilled",
  });
  expect(updates[0]?.where).toContain('"api_key_id" is null');
  expect(deleteDemoApiKey).not.toHaveBeenCalled();
});

test("an Unkey failure is logged and the sandbox still loads", async () => {
  createDemoApiKey.mockRejectedValueOnce(new Error("unkey down"));
  expect(await ensureDemoApiKey(keyless)).toBe(keyless);
  expect(logError).toHaveBeenCalledTimes(1);
  expect(updates).toHaveLength(0);
});

test("losing a race deletes the extra key and returns the winner's", async () => {
  storedRow = {
    ...keyless,
    apiKey: "ntra_demo_winner",
    apiKeyId: "key-winner",
  };
  const result = await ensureDemoApiKey(keyless);
  expect(deleteDemoApiKey).toHaveBeenCalledWith("key-backfilled");
  expect(result.apiKey).toBe("ntra_demo_winner");
});

test("a failed save deletes the key it just created", async () => {
  updateFails = true;
  await expect(ensureDemoApiKey(keyless)).rejects.toThrow("update failed");
  expect(deleteDemoApiKey).toHaveBeenCalledWith("key-backfilled");
});

test("a reset moves a key that was backfilled after its snapshot", async () => {
  savedKeyId = "key-backfilled";
  const snapshot = {
    ...keyless,
    createdAt: new Date("2026-11-13T12:00:00Z"),
    timeZone: "UTC",
  } as DemoSandbox;
  const result = await resetDemoSandboxExclusive(snapshot, {
    firstName: "Ada",
    lastName: "Lovelace",
    companyName: "Analytical",
  });
  expect(result).not.toBe("busy");
  expect(createDemoApiKey).not.toHaveBeenCalled();
  expect(updateDemoApiKey).toHaveBeenCalledWith({
    keyId: "key-backfilled",
    organizationId: expect.not.stringMatching(/^org-demo$/),
  });
});
