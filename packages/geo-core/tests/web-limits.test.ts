import { beforeEach, expect, mock, test } from "bun:test";

import {
  WEB_AI_DAILY_CAP,
  WEB_NETWORK_RATELIMIT_MAX_REQUESTS,
} from "../src/constants/ingest";
import { createLocalRateLimit } from "../src/utils/local-rate-limit";

const exec = mock(
  async (_keys: string[], _args: string[]): Promise<[number, number]> => [1, 0]
);
mock.module("../src/ingest/ratelimit", () => ({
  webLimitScript: { exec },
}));
mock.module("@notra/ai/utils/redis", () => ({ redis: {} }));

const { admitWebAiEvent, createWebBeaconAdmission } =
  await import("../src/ingest/web-limits");

const identity = {
  organizationId: "org_1",
  projectId: "proj_1",
  generation: 0,
};

const admitNetwork = (network: string | null) =>
  createWebBeaconAdmission(identity, network).network();

beforeEach(() => {
  exec.mockReset();
  exec.mockImplementation(async () => [1, 0]);
});

test("a limiter failure falls back to a local bucket instead of approving", async () => {
  exec.mockImplementation(async () => {
    throw new Error("redis down");
  });
  const results: boolean[] = [];
  for (let index = 0; index <= WEB_NETWORK_RATELIMIT_MAX_REQUESTS; index += 1) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one bucket, in order
    results.push(await admitNetwork("198.51.100.7"));
  }
  expect(results.filter(Boolean)).toHaveLength(
    WEB_NETWORK_RATELIMIT_MAX_REQUESTS
  );
  expect(results.at(-1)).toBe(false);
  expect(await admitNetwork("198.51.100.8")).toBe(true);
  // Clients without an address share one bucket.
  await admitNetwork(null);
  expect(exec.mock.calls.at(-1)?.[0][0]).toContain(
    JSON.stringify(["org_1", "proj_1", "shared"])
  );
});

test("AI referrals stop at the daily cap and when the count cannot be read", async () => {
  exec.mockImplementation(async () => [1, WEB_AI_DAILY_CAP]);
  expect(await admitWebAiEvent(identity, "2026-11-04")).toBe(true);
  expect(exec.mock.calls[0]?.[0].at(-1)).toBe(
    "geo:web-ai-daily:v1:org_1:proj_1:2026-11-04"
  );
  exec.mockImplementation(async () => [1, WEB_AI_DAILY_CAP + 1]);
  expect(await admitWebAiEvent(identity, "2026-11-04")).toBe(false);
  exec.mockImplementation(async () => {
    throw new Error("redis down");
  });
  expect(await admitWebAiEvent(identity, "2026-11-04")).toBe(false);
  exec.mockImplementation(async () => [0, 0]);
  expect(await admitWebAiEvent(identity, "2026-11-04")).toBe(false);
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
