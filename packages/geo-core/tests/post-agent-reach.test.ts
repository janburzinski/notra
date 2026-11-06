import { describe, expect, test } from "bun:test";

import type { GeoTrafficSource } from "../src/types/geo";
import type { PostAgentReach } from "../src/types/post-agent-reach";
import { summarizePostAgentReach } from "../src/utils/post-agent-reach";

function source(overrides: Partial<GeoTrafficSource>): GeoTrafficSource {
  return {
    source: "openai",
    visitorType: "crawler",
    agent: "GPTBot",
    category: "training-crawler",
    confidence: "verified",
    visits: 1,
    markdownVisits: 0,
    paths: 1,
    lastSeenAt: "2026-11-04 10:00:00",
    ...overrides,
  };
}

describe("summarizePostAgentReach", () => {
  test("explains posts that aren't live", () => {
    expect(summarizePostAgentReach(null)).toMatchObject({ live: false });
  });

  test("labels crawls, citations and referrals, busiest first", () => {
    const reach: PostAgentReach = {
      postId: "post_1",
      siteId: "site_1",
      path: "/blog/launch",
      url: "https://example.com/blog/launch",
      configured: true,
      totals: { crawled: 4, cited: 2, referred: 7, total: 13 },
      sources: [
        source({ visits: 4 }),
        source({
          agent: "ChatGPT-User",
          category: "assistant-browse",
          visits: 2,
        }),
        source({
          source: "chatgpt",
          visitorType: "ai_referral",
          agent: "",
          category: "assistant-referral",
          visits: 7,
        }),
      ],
      points: [],
    };
    const summary = summarizePostAgentReach(reach);
    expect(summary.live).toBe(true);
    if (!summary.live) {
      return;
    }
    expect(summary.sources.map((row) => [row.kind, row.visits])).toEqual([
      ["referred", 7],
      ["crawled", 4],
      ["cited", 2],
    ]);
    expect(summary.sources[0]?.agent).toBeNull();
  });
});
