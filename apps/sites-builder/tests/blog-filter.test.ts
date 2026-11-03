import { describe, expect, test } from "bun:test";

import {
  blogFilterUrl,
  isCategoryTag,
  isPlainClick,
  matchesBlogFilter,
} from "../src/utils/blog-filter";

const click = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};

describe("isPlainClick", () => {
  test("a plain left click is handled by the page", () => {
    expect(isPlainClick(click)).toBe(true);
  });

  test.each([
    ["Cmd", { metaKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
    ["middle button", { button: 1 }],
  ])("%s keeps the browser's link behavior", (_name, change) => {
    expect(isPlainClick({ ...click, ...change })).toBe(false);
  });
});

describe("isCategoryTag", () => {
  test("no category bar has no category tags", () => {
    expect(isCategoryTag(false, "roi")).toBe(false);
  });

  test("with every tag as a category, every tag matches", () => {
    expect(isCategoryTag(true, "anything")).toBe(true);
  });

  test("listed names match their tag slug", () => {
    const categories = ["Customer results", "ROI"];
    expect(isCategoryTag(categories, "customer-results")).toBe(true);
    expect(isCategoryTag(categories, "roi")).toBe(true);
    expect(isCategoryTag(categories, "strategy")).toBe(false);
  });
});

describe("blogFilterUrl", () => {
  test("selecting a category keeps the search and other parameters", () => {
    const url = blogFilterUrl(
      "https://acme.com/blog?q=baseline&ref=news#posts",
      "roi",
      "baseline"
    );
    expect(url.pathname).toBe("/blog");
    expect(url.hash).toBe("#posts");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "baseline",
      ref: "news",
      category: "roi",
    });
  });

  test("All and an empty search clear their parameters", () => {
    const url = blogFilterUrl("https://acme.com/blog?category=roi&q=x", "", "");
    expect(url.search).toBe("");
  });
});

describe("matchesBlogFilter", () => {
  test("a category combines with the search", () => {
    expect(
      matchesBlogFilter("roi process", "Measure the return", "roi", "return")
    ).toBe(true);
    expect(matchesBlogFilter("roi", "Measure the return", "roi", "pilot")).toBe(
      false
    );
    expect(matchesBlogFilter("process", "Measure the return", "roi", "")).toBe(
      false
    );
  });
});
