import { expect, test } from "bun:test";

import { isShareableImage } from "../src/utils/images";

test("SVG covers are not used as link previews", () => {
  for (const path of [
    "/images/cover.svg",
    "/images/cover.SVG",
    "/images/cover.svgz",
    "https://cdn.example.com/cover.svg?v=2",
    "/images/cover.svg#frame",
  ]) {
    expect(isShareableImage(path)).toBe(false);
  }
});

test("raster covers are used as link previews", () => {
  for (const path of [
    "/images/cover.png",
    "/images/cover.jpg",
    "/images/cover.webp",
    "/images/svg-guide.png",
    "https://cdn.example.com/cover.gif?format=svg",
  ]) {
    expect(isShareableImage(path)).toBe(true);
  }
});
