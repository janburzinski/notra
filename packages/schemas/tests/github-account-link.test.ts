import { expect, test } from "bun:test";

import {
  githubAccountLinkStateSchema,
  prepareGitHubAccountLinkInputSchema,
} from "../src/schemas/dashboard/github";

test("accepts same-origin paths with a query", () => {
  expect(
    prepareGitHubAccountLinkInputSchema.safeParse({
      returnTo: "/acme/sites/new?githubAccountConnected=true",
      callbackPath: "/acme/sites/new",
    }).success
  ).toBe(true);
});

test.each([
  "https://evil.example/steal",
  "//evil.example",
  "/\\evil.example",
  "/\t/evil.example",
  "acme/sites/new",
])("rejects %p as a return path", (path) => {
  expect(
    prepareGitHubAccountLinkInputSchema.safeParse({
      returnTo: path,
      callbackPath: "/acme/sites/new",
    }).success
  ).toBe(false);
  expect(
    prepareGitHubAccountLinkInputSchema.safeParse({
      returnTo: "/acme/sites/new",
      callbackPath: path,
    }).success
  ).toBe(false);
});

test("link state requires the user who started the link", () => {
  expect(
    githubAccountLinkStateSchema.safeParse({
      returnTo: "/acme/sites/new",
      callbackPath: "/acme/sites/new",
    }).success
  ).toBe(false);
});
