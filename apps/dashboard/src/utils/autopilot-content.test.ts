import { expect, test } from "bun:test";

import {
  postImageSources,
  replaceImageSources,
  resolvePostImagePath,
} from "@/utils/autopilot-content";

const IMAGES = [
  "apps/web/public/images/blog/flow.png",
  "content/blog/diagram.svg",
  "content/blog/team photo.jpg",
];

test("finds repository image sources and skips URLs", () => {
  expect(
    postImageSources(
      [
        "![Flow](/images/blog/flow.png)",
        '![Diagram](./diagram.svg "Title")',
        "![Again](/images/blog/flow.png)",
        "![Remote](https://cdn.example.com/a.png)",
        "![Inline](data:image/png;base64,AAAA)",
        "![Spaced](<team%20photo.jpg>)",
      ].join("\n\n")
    )
  ).toEqual(["/images/blog/flow.png", "./diagram.svg", "team%20photo.jpg"]);
});

test("resolves sources against the post folder and the site root", () => {
  const post = "content/blog/launch.mdx";
  expect(resolvePostImagePath(post, "/images/blog/flow.png", IMAGES)).toBe(
    "apps/web/public/images/blog/flow.png"
  );
  expect(resolvePostImagePath(post, "./diagram.svg", IMAGES)).toBe(
    "content/blog/diagram.svg"
  );
  expect(resolvePostImagePath(post, "team%20photo.jpg", IMAGES)).toBe(
    "content/blog/team photo.jpg"
  );
  // Same file name, one match: found even from another folder.
  expect(resolvePostImagePath(post, "../assets/flow.png", IMAGES)).toBe(
    "apps/web/public/images/blog/flow.png"
  );
  expect(resolvePostImagePath(post, "./missing.png", IMAGES)).toBeNull();
  expect(
    resolvePostImagePath(post, "./flow.png", [...IMAGES, "docs/flow.png"])
  ).toBeNull();
});

test("points only the matched images at their keys", () => {
  expect(
    replaceImageSources(
      "![flow.png](./flow.png) and ![b](./b.png)",
      new Map([["./flow.png", "/notra-pr-image/0"]])
    )
  ).toBe("![flow.png](/notra-pr-image/0) and ![b](./b.png)");
});
