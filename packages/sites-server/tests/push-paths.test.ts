import { describe, expect, test } from "bun:test";

import { pathsTouchSiteInputs } from "../src/utils/push-paths";

describe("pathsTouchSiteInputs", () => {
  test.each([
    ["a post in the site folder", ["apps/blog/blog/post.mdx"], true],
    ["a stylesheet", ["apps/blog/style.css"], true],
    ["a custom chrome script", ["apps/blog/scripts/web-chrome.js"], true],
    ["the ignore file", ["apps/blog/.notraignore"], true],
    ["archive attributes anywhere", [".gitattributes"], true],
    ["code outside the folder", ["apps/web/src/page.tsx"], false],
    ["a non-input file inside the folder", ["apps/blog/README.md"], false],
    ["tooling inside the folder", ["apps/blog/package.json"], false],
    ["hidden folders inside the folder", ["apps/blog/.github/ci.yml"], false],
    ["no files", [], false],
  ] as const)("%s", (_, paths, touches) => {
    expect(pathsTouchSiteInputs(paths, "apps/blog")).toBe(touches);
  });

  test("a repository-root site ignores files the compiler does not read", () => {
    expect(
      pathsTouchSiteInputs(["README.md", ".github/workflows/ci.yml"], "")
    ).toBe(false);
    expect(pathsTouchSiteInputs(["blog/post.mdx"], "")).toBe(true);
  });
});
