import { describe, expect, test } from "bun:test";

import type { GeoShelfPageBrand, GeoShelfPlacement } from "@/types/geo-shelf";
import {
  mergeFetchedPlacements,
  readShelfPage,
} from "@/utils/geo-shelf-page-read";

const BRANDS: GeoShelfPageBrand[] = [
  { competitorId: null, name: "Notra", domain: "usenotra.com", aliases: [] },
  {
    competitorId: "c-peec",
    name: "Peec AI",
    domain: "peec.ai",
    aliases: [],
  },
  {
    competitorId: "c-linear",
    name: "Linear Releases (Linear)",
    domain: "linear.app",
    aliases: [],
  },
];

const LISTICLE = `# The 7 best AI visibility tools in 2026

We tested every tool on the same 50 prompts.

## 1. Profound
Enterprise tracking with deep citation data.

## 2. Peec AI
[Peec AI](https://peec.ai/?ref=list) groups sources into owned and earned actions, which makes it easy to see what to fix first.

## 3. Linear Releases
Not really a GEO tool, but teams use it to plan the work.
`;

function byBrand(read: ReturnType<typeof readShelfPage>, id: string | null) {
  return read.brands.find((brand) => brand.competitorId === id);
}

describe("readShelfPage", () => {
  test("finds named brands with the page's own number, link and excerpt", () => {
    const read = readShelfPage({
      url: "https://example.org/blog/ai-visibility-tools",
      title: "The 7 best AI visibility tools in 2026",
      markdown: LISTICLE,
      currentKind: "other",
      brands: BRANDS,
    });

    expect(byBrand(read, null)).toEqual({
      competitorId: null,
      status: "absent",
      position: null,
      hasLink: false,
      excerpt: null,
    });
    expect(byBrand(read, "c-peec")).toEqual({
      competitorId: "c-peec",
      status: "present",
      position: 2,
      hasLink: true,
      excerpt:
        "Peec AI groups sources into owned and earned actions, which makes it easy to see what to fix first.",
    });
    // "(Linear)" never appears on a page; the bare name does.
    expect(byBrand(read, "c-linear")?.status).toBe("present");
    expect(byBrand(read, "c-linear")?.position).toBe(3);
    expect(read.kind).toBe("listicle");
  });

  test("reads the number from `#3` and bold `**3.**` entries", () => {
    for (const heading of ["## #2 Peec AI", "**2.** Peec AI"]) {
      const read = readShelfPage({
        url: "https://example.org/blog/tools",
        title: "Tools",
        markdown: `# Tools\n\n${heading}\nTracks prompts across engines every day.\n`,
        currentKind: "other",
        brands: BRANDS,
      });
      expect(byBrand(read, "c-peec")?.position).toBe(2);
    }
  });

  test("a link to the brand's site lists it even without its name", () => {
    const read = readShelfPage({
      url: "https://example.org/blog/tools",
      title: "Tools",
      markdown:
        "# Tools\n\nRelease notes your users actually read. [Visit website](https://www.usenotra.com/?ref=tools)\n",
      currentKind: "other",
      brands: BRANDS,
    });
    expect(byBrand(read, null)).toEqual({
      competitorId: null,
      status: "present",
      position: null,
      hasLink: true,
      excerpt: "Release notes your users actually read. Visit website",
    });
  });

  test("does not rank a brand that only appears inside a numbered step", () => {
    const read = readShelfPage({
      url: "https://example.org/docs/setup",
      title: "Set up release notes",
      markdown:
        "# Setup\n\n1. Connect GitHub\n2. Install the Notra app from the marketplace and pick a repo\n",
      currentKind: "other",
      brands: BRANDS,
    });
    expect(byBrand(read, null)).toMatchObject({
      status: "present",
      position: null,
    });
    expect(read.kind).toBe("other");
  });

  test("keeps kinds the domain rules already set", () => {
    const read = readShelfPage({
      url: "https://www.g2.com/categories/best-ai-visibility",
      title: "Best AI visibility tools",
      markdown: LISTICLE,
      currentKind: "review_site",
      brands: BRANDS,
    });
    expect(read.kind).toBe("review_site");
  });

  test("reads a ranked list from its slug alone", () => {
    const read = readShelfPage({
      url: "https://example.org/blog/top-10-geo-platforms",
      title: null,
      markdown: "Some intro text about platforms.",
      currentKind: "other",
      brands: [],
    });
    expect(read.kind).toBe("listicle");
  });
});

describe("mergeFetchedPlacements", () => {
  const manualOwn: GeoShelfPlacement = {
    competitorId: null,
    brandName: "Notra",
    brandDomain: "usenotra.com",
    status: "present",
    position: 4,
    hasLink: true,
    evidence: "manual",
    excerpt: null,
    checkedAt: "2026-11-01T00:00:00.000Z",
  };
  const untracked: GeoShelfPlacement = {
    ...manualOwn,
    competitorId: "c-old",
    brandName: "Old rival",
    evidence: "fetch",
  };

  test("keeps a teammate's call and fills in the rest from the page", () => {
    const merged = mergeFetchedPlacements({
      existing: [manualOwn, untracked],
      brands: BRANDS,
      results: [
        {
          competitorId: null,
          status: "absent",
          position: null,
          hasLink: false,
          excerpt: null,
        },
        {
          competitorId: "c-peec",
          status: "present",
          position: 2,
          hasLink: true,
          excerpt: "Peec AI groups sources.",
        },
        {
          competitorId: "c-linear",
          status: "absent",
          position: null,
          hasLink: false,
          excerpt: null,
        },
      ],
      checkedAt: "2026-11-16T00:00:00.000Z",
    });

    expect(merged.map((placement) => placement.competitorId)).toEqual([
      null,
      "c-peec",
      "c-linear",
      "c-old",
    ]);
    expect(merged[0]).toBe(manualOwn);
    expect(merged[1]).toMatchObject({
      status: "present",
      position: 2,
      hasLink: true,
      evidence: "fetch",
      checkedAt: "2026-11-16T00:00:00.000Z",
    });
    expect(merged[3]).toBe(untracked);
  });

  test("overwrites a manual reset to unknown", () => {
    const merged = mergeFetchedPlacements({
      existing: [{ ...manualOwn, status: "unknown", position: null }],
      brands: [BRANDS[0] as GeoShelfPageBrand],
      results: [
        {
          competitorId: null,
          status: "present",
          position: null,
          hasLink: false,
          excerpt: "Notra writes changelogs.",
        },
      ],
      checkedAt: "2026-11-16T00:00:00.000Z",
    });
    expect(merged[0]).toMatchObject({ status: "present", evidence: "fetch" });
  });
});
