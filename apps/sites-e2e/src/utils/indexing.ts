import assert from "node:assert/strict";

import type { Page } from "playwright";

const INDEXABLE = "index, follow, max-image-preview:large";

// Every robots check elsewhere is a noindex one; this proves the live site
// stays indexable while its tag pages (default `seo.indexing: navigable`)
// stay out of search and out of the sitemap.
export async function assertLiveIndexing(
  page: Page,
  origin: string,
  request: (path: string, init?: RequestInit) => Promise<Response>,
  post: Response
) {
  assert.equal(
    new URL(page.url()).pathname,
    "/blog/2026/launch",
    "indexing is read from the launch post"
  );
  assert.deepEqual(
    await page
      .locator('meta[name="robots"]')
      .evaluateAll((tags) => tags.map((tag) => tag.getAttribute("content"))),
    [INDEXABLE],
    "a live post has exactly one indexable robots tag"
  );
  assert.equal(post.headers.get("x-robots-tag"), null);
  const tag = await request("/blog/tags/meta", {
    headers: { accept: "text/html" },
  });
  assert.equal(tag.status, 200);
  assert.equal(tag.headers.get("x-robots-tag"), null);
  assert.match(
    await tag.text(),
    /name="robots"[^>]*content="noindex, nofollow"/
  );
  const sitemap = await (await request("/blog/sitemap.xml")).text();
  for (const path of ["/blog/2026/launch", "/blog/hello-world"]) {
    assert.ok(
      sitemap.includes(`<loc>${origin}${path}</loc>`),
      `the blog sitemap lists ${path}`
    );
  }
  assert.ok(!sitemap.includes("/tags/"), "noindex tag pages are not listed");
  return "live posts are indexable (robots meta, no X-Robots-Tag) and in the sitemap; tag pages stay noindex and unlisted";
}
