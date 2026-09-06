import { expect, test } from "bun:test";

import { selectGscContextProject } from "../src/geo/suggestion-context-project";

const project = {
  id: "real",
  websiteUrl: "https://example.com/blog/",
  isSample: false,
};

test("selects by property coverage, not candidate order", () => {
  const other = { ...project, id: "other", websiteUrl: "https://other.com" };
  expect(
    selectGscContextProject("sc-domain:example.com", [other, project])
  ).toBe("real");
  expect(
    selectGscContextProject("sc-domain:example.com", [project, other])
  ).toBe("real");
  expect(
    selectGscContextProject("sc-domain:unrelated.com", [project])
  ).toBeNull();
});

test("excludes samples and rejects ambiguous real projects", () => {
  const sample = { ...project, id: "sample", isSample: true };
  expect(selectGscContextProject("sc-domain:example.com", [sample])).toBeNull();
  expect(
    selectGscContextProject("sc-domain:example.com", [sample, project])
  ).toBe("real");
  expect(
    selectGscContextProject("sc-domain:example.com", [
      project,
      { ...project, id: "duplicate" },
    ])
  ).toBeNull();
  expect(selectGscContextProject("sc-domain:example.com", [])).toBeNull();
});

test("domain coverage respects subdomain boundaries and normalization", () => {
  expect(
    selectGscContextProject("sc-domain:EXAMPLE.COM.", [
      { ...project, websiteUrl: "https://docs.example.com" },
    ])
  ).toBe("real");
  expect(
    selectGscContextProject("sc-domain:example.com", [
      { ...project, websiteUrl: "https://notexample.com" },
    ])
  ).toBeNull();
  expect(
    selectGscContextProject("sc-domain:example.com", [
      { ...project, websiteUrl: "https://example.com.evil.test" },
    ])
  ).toBeNull();
});

test("URL-prefix coverage respects origin and path", () => {
  expect(selectGscContextProject("https://example.com/blog/", [project])).toBe(
    "real"
  );
  for (const site of [
    "http://example.com/",
    "https://example.com/docs/",
    "https://example.com:8443/",
    "invalid",
    "sc-domain:",
  ]) {
    expect(selectGscContextProject(site, [project])).toBeNull();
  }
  expect(
    selectGscContextProject("https://example.com/blog/", [
      { ...project, websiteUrl: "https://example.com/" },
    ])
  ).toBeNull();
  expect(
    selectGscContextProject("sc-domain:example.com", [
      { ...project, websiteUrl: "invalid" },
    ])
  ).toBeNull();
});
