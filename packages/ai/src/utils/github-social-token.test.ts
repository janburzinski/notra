import { afterEach, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";

import { encryptToken } from "@notra/db/utils/integration-encryption";

import {
  isGitHubSocialTokenExpired,
  resolveGitHubSocialToken,
} from "./github-social-token";

const originalKey = process.env.INTEGRATION_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
  } else {
    process.env.INTEGRATION_ENCRYPTION_KEY = originalKey;
  }
});

test("encrypted connections resolve to their token", () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  expect(
    resolveGitHubSocialToken({
      encryptedAccessToken: encryptToken("synthetic-token"),
    })
  ).toBe("synthetic-token");
});

test("connections without credentials remain disconnected", () => {
  expect(resolveGitHubSocialToken({ encryptedAccessToken: null })).toBeNull();
});

test("unreadable ciphertext fails rather than returning an invalid credential", () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const encryptedAccessToken = encryptToken("synthetic-token");
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  expect(() => resolveGitHubSocialToken({ encryptedAccessToken })).toThrow();
});

test("tokens without an expiry never expire", () => {
  expect(isGitHubSocialTokenExpired(null)).toBe(false);
  expect(isGitHubSocialTokenExpired(undefined)).toBe(false);
});

test("expiring tokens count as expired once their expiry passes", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  expect(
    isGitHubSocialTokenExpired(new Date("2026-11-04T12:00:01Z"), now)
  ).toBe(false);
  expect(isGitHubSocialTokenExpired(now, now)).toBe(true);
  expect(
    isGitHubSocialTokenExpired(new Date("2026-11-04T04:00:00Z"), now)
  ).toBe(true);
});
