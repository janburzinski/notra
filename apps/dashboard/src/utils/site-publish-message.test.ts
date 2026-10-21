import { expect, test } from "bun:test";

import { sitePublishMessageKey } from "./site-publish-message";

test("publish headlines describe design, posts, and mixed site changes", () => {
  expect(sitePublishMessageKey([{ path: "blog.json" }])).toBe("messageDesign");
  expect(
    sitePublishMessageKey([
      { path: "blog/hello.md" },
      { path: "blog/another.mdx" },
    ])
  ).toBe("messagePosts");
  expect(
    sitePublishMessageKey([{ path: "blog.json" }, { path: "blog/hello.md" }])
  ).toBe("messageSite");
  expect(sitePublishMessageKey([{ path: "public/logo.svg" }])).toBe(
    "messageSite"
  );
  expect(sitePublishMessageKey([])).toBe("messageSite");
});
