import { afterAll, expect, mock, spyOn, test } from "bun:test";

import * as ai from "ai";
import { Effect } from "effect";

import { geoWebsiteDiscoverySchema } from "../src/schemas/geo";

const realScrape = (await import("../../ai/src/utils/context-dev"))
  .scrapeWebsiteForBrandAnalysis;

const cached = {
  companyName: "Old Brand",
  aliases: [],
  audienceType: "technical" as const,
  competitors: [],
  prompts: Array.from({ length: 6 }, (_, i) => ({
    prompt: `how do i solve this problem in my app number ${i}`,
    title: `How to Solve Problem ${i}`,
  })),
  conversations: [],
};
const scrape = mock(async () => ({
  success: true as const,
  content: "New website",
}));
const generate = mock(async (_options: { model: string; prompt: string }) => ({
  output: { ...cached, companyName: "New Brand" },
}));
const read = mock(() => Effect.succeed(cached));
const write = mock(() => Effect.void);

mock.module("@notra/ai/utils/context-dev", () => ({
  scrapeWebsiteForBrandAnalysis: scrape,
}));
mock.module("@notra/ai/gateway", () => ({ gateway: (model: string) => model }));
spyOn(ai, "generateText").mockImplementation(
  generate as unknown as typeof ai.generateText
);
mock.module("../src/geo/cache", () => ({
  readGeoCache: read,
  writeGeoCache: write,
}));

const { discoverGeoWebsite, prepareGeoWebsiteGeneration } =
  await import("../src/geo/discover");
afterAll(() => mock.restore());

test("explicit website generation bypasses a stale discovery cache", async () => {
  const reused = await Effect.runPromise(
    discoverGeoWebsite("org", "https://example.com")
  );
  expect(reused.discovery.companyName).toBe("Old Brand");
  expect(scrape).not.toHaveBeenCalled();

  const fresh = await Effect.runPromise(
    discoverGeoWebsite("org", "https://example.com", true)
  );
  expect(fresh.discovery.companyName).toBe("New Brand");
  expect(read).toHaveBeenCalledTimes(1);
  expect(scrape).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledTimes(1);
  expect(generate.mock.calls[0]?.[0].model).toBe("moonshotai/kimi-k3");
  expect(generate.mock.calls[0]?.[0].prompt).toContain(
    "not email delivery providers"
  );
});

test("filters both saved and newly discovered brand names before insertion", async () => {
  const discovery = geoWebsiteDiscoverySchema.parse({
    ...cached,
    companyName: "New Brand",
    aliases: ["new-alias"],
    prompts: [
      "is New Brand good for this",
      "should i choose Old Brand",
      "how does new-alias handle this",
      "how do i solve this without changing my app",
      "what other options work with my existing setup",
      "can i use a library instead of building it",
    ].map((prompt) => ({ prompt, title: "Comparison" })),
  });
  const existingAliases = Array.from({ length: 8 }, (_, i) => `old-${i}`);
  const prepared = await Effect.runPromise(
    prepareGeoWebsiteGeneration(discovery, "Old Brand", existingAliases)
  );

  expect(prepared.entries).toHaveLength(3);
  expect(prepared.entries.map((entry) => entry.prompt)).toEqual(
    discovery.prompts.slice(3).map((entry) => entry.prompt)
  );
  expect(prepared.aliases).not.toContain("new-alias");
  expect(prepared.companyName).toBe("Old Brand");
});

test("website discovery accepts fewer distinct prompts rather than padding", () => {
  expect(geoWebsiteDiscoverySchema.safeParse(cached).success).toBe(true);
  expect(
    geoWebsiteDiscoverySchema.safeParse({
      ...cached,
      prompts: cached.prompts.slice(0, 5),
    }).success
  ).toBe(false);
});

test("brand analysis rejects pages redirected to another website", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    return Response.json(
      url.includes("/web/scrape/sitemap")
        ? { urls: [] }
        : { url: "https://other.example/", markdown: "Unrelated brand" }
    );
  });

  try {
    const result = await realScrape("https://example.com/");
    expect(result.success).toBe(false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
