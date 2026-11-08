import { beforeEach, expect, mock, test } from "bun:test";

import {
  WEB_AI_DAILY_CAP,
  WEB_NETWORK_RATELIMIT_MAX_REQUESTS,
} from "../src/constants/ingest";
import { createLocalRateLimit } from "../src/utils/local-rate-limit";

const networkLimit = mock(
  async (_key: string): Promise<{ success: boolean; reason?: string }> => ({
    success: true,
  })
);
const aiLimit = mock(async (_key: string) => ({ success: true }));
const incr = mock(async (_key: string) => 1);
mock.module("../src/ingest/ratelimit", () => ({
  webIngestRatelimit: { limit: async () => ({ success: true }) },
  webNetworkRatelimit: { limit: networkLimit },
  webSharedNetworkRatelimit: { limit: networkLimit },
  webAiRatelimit: { limit: aiLimit },
}));
mock.module("@notra/ai/utils/redis", () => ({
  redis: { incr, expire: async () => 1 },
}));

const { admitWebAiEvent, admitWebNetwork } =
  await import("../src/ingest/web-limits");

const identity = {
  organizationId: "org_1",
  projectId: "proj_1",
  generation: 0,
};

beforeEach(() => {
  for (const fn of [networkLimit, aiLimit, incr]) {
    fn.mockReset();
  }
  networkLimit.mockImplementation(async () => ({ success: true }));
  aiLimit.mockImplementation(async () => ({ success: true }));
  incr.mockImplementation(async () => 1);
});

test("a limiter timeout or failure falls back to a local bucket instead of approving", async () => {
  networkLimit.mockImplementation(async () => ({
    success: true,
    reason: "timeout",
  }));
  const results: boolean[] = [];
  for (let index = 0; index <= WEB_NETWORK_RATELIMIT_MAX_REQUESTS; index += 1) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one bucket, in order
    results.push(await admitWebNetwork(identity, "198.51.100.7"));
  }
  expect(results.filter(Boolean)).toHaveLength(
    WEB_NETWORK_RATELIMIT_MAX_REQUESTS
  );
  expect(results.at(-1)).toBe(false);
  networkLimit.mockImplementation(async () => {
    throw new Error("redis down");
  });
  expect(await admitWebNetwork(identity, "198.51.100.7")).toBe(false);
  expect(await admitWebNetwork(identity, "198.51.100.8")).toBe(true);
  // Clients without an address share one bucket.
  await admitWebNetwork(identity, null);
  expect(networkLimit.mock.calls.at(-1)?.[0]).toBe(
    JSON.stringify(["org_1", "proj_1", "shared"])
  );
});

test("AI referrals stop at the daily cap and when the count cannot be read", async () => {
  incr.mockImplementation(async () => WEB_AI_DAILY_CAP);
  expect(await admitWebAiEvent(identity, "2026-11-04")).toBe(true);
  expect(incr.mock.calls[0]?.[0]).toBe(
    "geo:web-ai-daily:v1:org_1:proj_1:2026-11-04"
  );
  incr.mockImplementation(async () => WEB_AI_DAILY_CAP + 1);
  expect(await admitWebAiEvent(identity, "2026-11-04")).toBe(false);
  incr.mockImplementation(async () => {
    throw new Error("redis down");
  });
  expect(await admitWebAiEvent(identity, "2026-11-04")).toBe(false);
  aiLimit.mockImplementation(async () => ({ success: false }));
  incr.mockClear();
  expect(await admitWebAiEvent(identity, "2026-11-04")).toBe(false);
  expect(incr).not.toHaveBeenCalled();
});

test("the local bucket refills over its window", () => {
  const limit = createLocalRateLimit(2, 60_000, 10);
  expect([limit("k", 0), limit("k", 0), limit("k", 0)]).toEqual([
    true,
    true,
    false,
  ]);
  expect(limit("k", 30_000)).toBe(true);
});
