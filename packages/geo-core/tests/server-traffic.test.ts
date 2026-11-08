import { expect, mock, test } from "bun:test";

import { GEO_SERVER_TRAFFIC_KEY_PREFIX } from "../src/constants/ingest";

const store = new Set<string>();
const lookups: string[][] = [];
mock.module("@notra/ai/utils/redis", () => ({
  redis: {
    set: async (key: string) => {
      store.add(key);
      return "OK";
    },
    exists: async (...keys: string[]) => {
      lookups.push(keys);
      return keys.filter((key) => store.has(key)).length;
    },
  },
}));

const { hasServerTraffic, markServerTraffic } =
  await import("../src/ingest/server-traffic");

test("a project's web key sees legacy organization markers, never a sibling project's", async () => {
  await markServerTraffic({
    organizationId: "org_legacy",
    projectId: null,
    generation: 0,
  });
  await markServerTraffic({
    organizationId: "org_split",
    projectId: "proj_a",
    generation: 0,
  });
  const seen = (organizationId: string, projectId: string) =>
    hasServerTraffic({ organizationId, projectId, generation: 0, web: true });
  expect(await seen("org_legacy", "proj_1")).toBe(true);
  expect(await seen("org_split", "proj_b")).toBe(false);
  expect(lookups.at(-1)).toEqual([
    `${GEO_SERVER_TRAFFIC_KEY_PREFIX}:org_split:proj_b`,
    `${GEO_SERVER_TRAFFIC_KEY_PREFIX}:org_split:-`,
  ]);
});
