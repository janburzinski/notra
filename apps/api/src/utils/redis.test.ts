import { describe, expect, test } from "bun:test";

import { getRedis } from "./redis";

describe("getRedis", () => {
  test("returns null when Redis is not configured", () => {
    expect(getRedis({})).toBeNull();
  });

  test("reuses the client for unchanged credentials", () => {
    const env = {
      UPSTASH_REDIS_REST_URL: "https://redis.example.test",
      UPSTASH_REDIS_REST_TOKEN: "token-a",
    };

    expect(getRedis(env)).toBe(getRedis({ ...env }));
  });

  test("replaces the client when credentials change", () => {
    const url = "https://redis.example.test";
    const first = getRedis({
      UPSTASH_REDIS_REST_URL: url,
      UPSTASH_REDIS_REST_TOKEN: "token-a",
    });
    const second = getRedis({
      UPSTASH_REDIS_REST_URL: url,
      UPSTASH_REDIS_REST_TOKEN: "token-b",
    });

    expect(second).not.toBe(first);
  });
});
