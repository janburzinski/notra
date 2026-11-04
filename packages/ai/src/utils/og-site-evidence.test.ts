import { describe, expect, test } from "bun:test";

import { extractOgSiteEvidence } from "@notra/ai/utils/og-site-evidence";

describe("extractOgSiteEvidence", () => {
  test("keeps compressed hero images but skips investor and press logos", () => {
    const { assets } = extractOgSiteEvidence(
      `<img src="/images/hero-compressed.webp">
       <img src="/logos/backers/ubs.png">
       <img src="/press/logo.png">`,
      "https://example.com"
    );
    expect(assets.map((asset) => asset.url)).toEqual([
      "https://example.com/images/hero-compressed.webp",
    ]);
  });
});
