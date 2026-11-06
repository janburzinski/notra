import { describe, expect, test } from "bun:test";

import type { ContentApiResponse } from "@/types/hooks/content";
import { mergeSavedContentDetail } from "@/utils/content-document-save";

const current = {
  content: {
    id: "p_1",
    title: "Old",
    slug: null,
    markdown: "# Old",
    content: "<h1>Old</h1>",
    revision: 3,
    metadata: { coverImage: { url: "https://cdn/old.png", alt: "Old" } },
  },
} as unknown as ContentApiResponse;

const saved = {
  id: "p_1",
  title: "New",
  slug: null,
  markdown: "# New",
  content: "<h1>New</h1>",
  revision: 4,
  updatedAt: new Date(0).toISOString(),
};

describe("mergeSavedContentDetail", () => {
  test("shows a cover the save regenerated", () => {
    const cover = { url: "https://cdn/new.png", alt: "New" };
    const merged = mergeSavedContentDetail(current, {
      ...saved,
      coverImage: cover,
    });
    expect(merged?.content.metadata?.coverImage).toEqual(cover);
    expect(merged?.content.title).toBe("New");
  });

  test("keeps the cover when the save did not touch it", () => {
    const merged = mergeSavedContentDetail(current, saved);
    expect(merged?.content.metadata?.coverImage?.url).toBe(
      "https://cdn/old.png"
    );
  });
});
