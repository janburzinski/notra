import { describe, expect, mock, test } from "bun:test";

const copied: string[] = [];
mock.module("@/lib/integrations/github/content-assets", () => ({
  prepareR2GitHubContentAssets: (params: { markdown: string }) => {
    copied.push(params.markdown);
    return Promise.resolve({ markdown: params.markdown, assets: [] });
  },
}));

const { prepareSiteEntryMetadata } =
  await import("@/lib/integrations/github/site-entry-metadata");

const post = {
  tags: [],
  excerpt: null,
  authorIds: [],
  featured: false,
  noindex: false,
  hidden: false,
  displayDate: null,
};
const context = {
  contentPath: "blog",
  imagePathTemplate: "images/post",
  organizationId: "org",
  publicDirectory: "public",
  slug: "post",
  contentType: "blog_post" as const,
};

describe("site entry cover", () => {
  test("leaves a generated cover to the site's own thumbnail", async () => {
    const { metadata } = await prepareSiteEntryMetadata(
      {
        ...post,
        coverImage: {
          url: "https://cdn.example.com/organization/org/content/p_1-cover-0b5e9d2c-4f7a-4c1e-9a7d-3e2f1b0c9d8e-1700000000000.png",
          alt: "Title",
        },
      },
      context
    );
    expect(metadata.image).toBeNull();
    expect(copied).toHaveLength(0);
  });

  test("keeps a cover someone chose", async () => {
    const { metadata } = await prepareSiteEntryMetadata(
      {
        ...post,
        coverImage: { url: "https://cdn.example.com/mine.png", alt: "Mine" },
      },
      context
    );
    expect(metadata.image).toEqual({
      src: "https://cdn.example.com/mine.png",
      alt: "Mine",
    });
  });
});
