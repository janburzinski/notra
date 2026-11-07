import { expect, test } from "bun:test";

import {
  normalizeRequestPath,
  resolveFile,
  resolveMarkdownFile,
  wellKnownLlmsTxtTarget,
} from "@notra/sites-core/utils/request-paths";

test("request paths are decoded and cleaned up like the worker serves them", () => {
  expect(normalizeRequestPath("/blog/2026%2Frecap")).toBe("/blog/2026/recap");
  expect(normalizeRequestPath("//blog///launch")).toBe("/blog/launch");
  expect(normalizeRequestPath("/blog/./launch/")).toBe("/blog/launch/");
  expect(normalizeRequestPath("/blog/caf%C3%A9")).toBe("/blog/café");
  expect(normalizeRequestPath("/")).toBe("/");
  expect(normalizeRequestPath("//")).toBe("/");
  expect(normalizeRequestPath("/blog/%2E%2E/secret")).toBeNull();
  expect(normalizeRequestPath("/blog/100%")).toBeNull();
  expect(normalizeRequestPath("/blog/a%00b")).toBeNull();
  expect(normalizeRequestPath("/blog/a%5Cb")).toBeNull();
});

test("files resolve like the worker finds them", () => {
  const files = new Map(
    [
      "/index.html",
      "/blog/index.html",
      "/blog/launch/index.html",
      "/blog/launch/index.md",
      "/blog/about.html",
      "/blog/feed.xml",
      "/blog/llms.txt",
    ].map((path) => [path, path])
  );
  expect(resolveFile(files, "/")).toBe("/index.html");
  expect(resolveFile(files, "/blog")).toBe("/blog/index.html");
  expect(resolveFile(files, "/blog/launch/")).toBe("/blog/launch/index.html");
  expect(resolveFile(files, "/blog/about")).toBe("/blog/about.html");
  expect(resolveFile(files, "/blog/feed.xml")).toBe("/blog/feed.xml");
  expect(resolveFile(files, "/blog/feed.xml/")).toBeNull();
  expect(resolveMarkdownFile(files, "/blog/launch.md")).toBe(
    "/blog/launch/index.md"
  );
  expect(resolveMarkdownFile(files, "/blog/launch")).toBeNull();
  expect(wellKnownLlmsTxtTarget(files, "/blog/.well-known/llms.txt")).toBe(
    "/blog/llms.txt"
  );
  expect(
    wellKnownLlmsTxtTarget(files, "/blog/.well-known/llms-full.txt")
  ).toBeNull();
});
