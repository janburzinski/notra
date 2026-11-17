import { expect, mock, test } from "bun:test";

import { relinkUrls } from "../src/utils/autopilot-edits";

// Each address answers with a status and, for a redirect, where it points.
const web: Record<string, { status: number; location?: string }> = {
  "https://example.com/changelog/acme": {
    status: 308,
    location: "/showcase/acme",
  },
  "https://example.com/showcase/acme": { status: 200 },
  "http://www.example.com/docs": {
    status: 301,
    location: "https://example.com/docs/",
  },
  "https://example.com/docs/": { status: 200 },
  "https://example.com/private": {
    status: 302,
    location: "https://login.example.org/?next=/private",
  },
  "https://login.example.org/?next=/private": { status: 200 },
  "https://example.com/gone": { status: 404 },
  "https://example.com/walled": { status: 403 },
  "https://example.com/loop": { status: 302, location: "/loop" },
};

mock.module("@notra/ai/utils/public-fetch", () => ({
  fetchPublicUrl: async (url: string, init: RequestInit) => {
    expect(init.redirect).toBe("manual");
    // A #section never goes to the server.
    const page = web[url.split("#")[0] ?? url];
    if (!page) {
      throw new Error(`Unreachable: ${url}`);
    }
    return new Response(null, {
      status: page.status,
      headers: page.location ? { location: page.location } : {},
    });
  },
}));
mock.module("@notra/ai/utils/context-dev", () => ({ fetchWebpage: mock() }));

const { resolveLinks } = await import("../src/lib/autopilot/pages");

test("a redirect within the site is followed to where it lands", async () => {
  const { dead, moved } = await resolveLinks([
    "https://example.com/changelog/acme",
    "http://www.example.com/docs#setup",
    "https://example.com/showcase/acme",
  ]);
  expect(dead).toEqual([]);
  expect(Object.fromEntries(moved)).toEqual({
    "https://example.com/changelog/acme": "https://example.com/showcase/acme",
    // The section the link pointed at survives the redirect.
    "http://www.example.com/docs#setup": "https://example.com/docs/#setup",
  });
});

test("a redirect to another site is left alone", async () => {
  const { dead, moved } = await resolveLinks(["https://example.com/private"]);
  expect(dead).toEqual([]);
  expect(moved.size).toBe(0);
});

test("gone, unreachable and endlessly redirecting links are dead; bot walls are not", async () => {
  const { dead, moved } = await resolveLinks([
    "https://example.com/gone",
    "https://example.com/missing",
    "https://example.com/loop",
    "https://example.com/walled",
  ]);
  expect(dead.toSorted()).toEqual([
    "https://example.com/gone",
    "https://example.com/loop",
    "https://example.com/missing",
  ]);
  expect(moved.size).toBe(0);
});

test("relinking replaces whole URLs only", () => {
  const moved = new Map([["https://a.dev/x", "https://a.dev/y"]]);
  expect(
    relinkUrls(
      "See [x](https://a.dev/x), https://a.dev/x. Not https://a.dev/x/z, https://a.dev/xz or https://b.dev/?next=https://a.dev/x.",
      moved
    )
  ).toBe(
    "See [x](https://a.dev/y), https://a.dev/y. Not https://a.dev/x/z, https://a.dev/xz or https://b.dev/?next=https://a.dev/x."
  );
});
