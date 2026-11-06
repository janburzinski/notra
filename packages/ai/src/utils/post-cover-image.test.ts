import { beforeEach, describe, expect, mock, test } from "bun:test";

const renders: { title: string; cachedTemplateOnly?: boolean }[] = [];
const uploads: { postId: string }[] = [];
const deleted: string[] = [];
let renderFails = false;
let renderDelayMs = 0;

const actualConstants = await import("@notra/ai/constants/post-metadata");
mock.module("@notra/ai/constants/post-metadata", () => ({
  ...actualConstants,
  GENERATED_COVER_TIMEOUT_MS: 100,
}));

mock.module("@notra/db/drizzle", () => ({ db: {} }));
mock.module("@notra/ai/utils/og-image", () => ({
  generateBrandOgImage: (params: {
    title: string;
    cachedTemplateOnly?: boolean;
  }) => {
    if (renderFails) {
      throw new Error("render failed");
    }
    renders.push(params);
    return new Promise((resolve) =>
      setTimeout(() => resolve({ pngBase64: "cG5n" }), renderDelayMs)
    );
  },
}));
mock.module("@notra/ai/utils/image-assets", () => ({
  uploadGeneratedCoverAsset: (params: { postId: string }) => {
    uploads.push(params);
    return Promise.resolve(
      `https://cdn.example.com/organization/org/content/${params.postId}-cover-0b5e9d2c-4f7a-4c1e-9a7d-3e2f1b0c9d8e-1700000000000.png`
    );
  },
  deleteGeneratedCoverAsset: (url: string) => {
    deleted.push(url);
    return Promise.resolve();
  },
}));

const { discardUnusedCover, generatedCoverImageUpdate, isGeneratedCoverImage } =
  await import("@notra/ai/utils/post-cover-image");

const GENERATED = {
  url: "https://cdn.example.com/organization/org/content/p_1-cover-0b5e9d2c-4f7a-4c1e-9a7d-3e2f1b0c9d8e-1700000000000.png",
  alt: "Old title",
};
const base = {
  organizationId: "org",
  postId: "p_1",
  contentType: "blog_post",
  coverImage: null as unknown,
  previousTitle: "Hello world",
  title: "Hello world",
  publishing: true,
  published: true,
};

beforeEach(() => {
  renders.length = 0;
  uploads.length = 0;
  deleted.length = 0;
  renderFails = false;
  renderDelayMs = 0;
});

describe("isGeneratedCoverImage", () => {
  test("recognizes only covers Notra generated", () => {
    expect(isGeneratedCoverImage(GENERATED)).toBe(true);
    expect(
      isGeneratedCoverImage({
        url: "https://cdn.example.com/organization/org/content/p_1-1700000000000.png",
        alt: "",
      })
    ).toBe(false);
    // Guessable names from before covers were random are not ours to manage.
    expect(
      isGeneratedCoverImage({
        url: "https://cdn.example.com/organization/org/content/p_1-cover-1700000000000.png",
        alt: "",
      })
    ).toBe(false);
    expect(
      isGeneratedCoverImage({
        url: "/api/uploads/content-images/organization/org/content/abc.png",
        alt: "",
      })
    ).toBe(false);
    expect(isGeneratedCoverImage(null)).toBe(false);
  });
});

describe("generatedCoverImageUpdate", () => {
  test("generates a cover when a blog post is published without one", async () => {
    const cover = await generatedCoverImageUpdate(base);
    expect(cover).toEqual({
      url: "https://cdn.example.com/organization/org/content/p_1-cover-0b5e9d2c-4f7a-4c1e-9a7d-3e2f1b0c9d8e-1700000000000.png",
      alt: "Hello world",
    });
    expect(renders).toHaveLength(1);
    expect(renders[0]).toMatchObject({
      organizationId: "org",
      title: "Hello world",
      cachedTemplateOnly: true,
    });
    expect(uploads[0]?.postId).toBe("p_1");
  });

  test("keeps a cover someone chose", async () => {
    const cover = await generatedCoverImageUpdate({
      ...base,
      coverImage: { url: "https://example.com/mine.png", alt: "" },
      title: "New title",
    });
    expect(cover).toBeNull();
    expect(renders).toHaveLength(0);
  });

  test("skips other content types, drafts and empty titles", async () => {
    expect(
      await generatedCoverImageUpdate({ ...base, contentType: "changelog" })
    ).toBeNull();
    expect(
      await generatedCoverImageUpdate({
        ...base,
        publishing: false,
        published: false,
      })
    ).toBeNull();
    expect(
      await generatedCoverImageUpdate({
        ...base,
        previousTitle: "",
        title: " ",
      })
    ).toBeNull();
    expect(renders).toHaveLength(0);
  });

  test("refreshes a generated cover when the title changes", async () => {
    const cover = await generatedCoverImageUpdate({
      ...base,
      coverImage: GENERATED,
      previousTitle: "Old title",
      title: "New title",
      publishing: false,
    });
    expect(cover?.alt).toBe("New title");
    expect(renders).toHaveLength(1);
  });

  test("leaves a generated cover alone when the title is unchanged", async () => {
    expect(
      await generatedCoverImageUpdate({
        ...base,
        coverImage: { ...GENERATED, alt: "Edited alt text" },
        publishing: false,
      })
    ).toBeNull();
    expect(renders).toHaveLength(0);
  });

  test("never renders a draft's title, even over a generated cover", async () => {
    expect(
      await generatedCoverImageUpdate({
        ...base,
        coverImage: GENERATED,
        previousTitle: "Old title",
        title: "Secret draft title",
        publishing: false,
        published: false,
      })
    ).toBeNull();
    expect(renders).toHaveLength(0);
  });

  test("republishing refreshes a cover whose title changed as a draft", async () => {
    const cover = await generatedCoverImageUpdate({
      ...base,
      coverImage: GENERATED,
      previousTitle: "New title",
      title: "New title",
    });
    expect(cover?.alt).toBe("New title");
  });

  test("returns null instead of failing the write", async () => {
    renderFails = true;
    expect(await generatedCoverImageUpdate(base)).toBeNull();
    expect(uploads).toHaveLength(0);
  });

  test("gives up at the deadline and deletes a late upload", async () => {
    renderDelayMs = 300;
    const started = Date.now();
    expect(await generatedCoverImageUpdate(base)).toBeNull();
    expect(Date.now() - started).toBeLessThan(250);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(uploads).toHaveLength(0);
  });
});

describe("discardUnusedCover", () => {
  const generated = {
    url: "https://cdn.example.com/organization/org/content/p_1-cover-0b5e9d2c-4f7a-4c1e-9a7d-3e2f1b0c9d8e-1.png",
    alt: "T",
  };

  test("keeps a cover the post references", async () => {
    await discardUnusedCover(generated, generated);
    await discardUnusedCover(null, null);
    expect(deleted).toHaveLength(0);
  });

  test("deletes a cover the write did not keep", async () => {
    await discardUnusedCover(generated, {
      url: "https://example.com/mine.png",
      alt: "",
    });
    await discardUnusedCover(generated, null);
    expect(deleted).toEqual([generated.url, generated.url]);
  });
});
