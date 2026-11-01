import { afterEach, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";

import { encryptToken } from "@notra/db/utils/integration-encryption";

import { resolveGitHubSocialToken } from "./github-social-token";

const originalKey = process.env.INTEGRATION_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
  } else {
    process.env.INTEGRATION_ENCRYPTION_KEY = originalKey;
  }
});

test("legacy connections stay usable without an encryption key", () => {
  delete process.env.INTEGRATION_ENCRYPTION_KEY;
  expect(
    resolveGitHubSocialToken({
      accessToken: "synthetic-legacy-token",
      encryptedAccessToken: null,
    })
  ).toBe("synthetic-legacy-token");
});

test("a legacy writer's latest token takes precedence over stale ciphertext", () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const encryptedAccessToken = encryptToken("synthetic-previous-token");
  expect(
    resolveGitHubSocialToken({
      accessToken: "synthetic-latest-token",
      encryptedAccessToken,
    })
  ).toBe("synthetic-latest-token");
});

test("encrypted-only connections work after plaintext cleanup", () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  expect(
    resolveGitHubSocialToken({
      accessToken: null,
      encryptedAccessToken: encryptToken("synthetic-migrated-token"),
    })
  ).toBe("synthetic-migrated-token");
});

test("connections without credentials remain disconnected", () => {
  expect(
    resolveGitHubSocialToken({ accessToken: null, encryptedAccessToken: null })
  ).toBeNull();
});

test("unreadable ciphertext fails rather than returning an invalid credential", () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const encryptedAccessToken = encryptToken("synthetic-token");
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  expect(() =>
    resolveGitHubSocialToken({ accessToken: null, encryptedAccessToken })
  ).toThrow();
});
