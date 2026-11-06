import { expect, test } from "bun:test";

import {
  agentReachDailyVisitsByKind,
  bucketAgentReachTrend,
  agentReachEngines,
  sumAgentReachByCollection,
} from "./content-agent-reach";

test("sums live posts per collection and flags failed lookups", () => {
  const byCollection = sumAgentReachByCollection(
    [
      { id: "a", collectionId: "c1" },
      { id: "b", collectionId: "c1" },
      { id: "c", collectionId: "c2" },
      { id: "d", collectionId: "c3" },
    ],
    [
      { postId: "a", available: true, crawler: 3, aiReferral: 1, total: 4 },
      { postId: "b", available: false, crawler: 0, aiReferral: 0, total: 0 },
      { postId: "c", available: true, crawler: 0, aiReferral: 0, total: 0 },
    ]
  );
  expect(byCollection).toEqual({
    c1: { crawler: 3, aiReferral: 1, total: 4, posts: 2, unavailable: true },
    c2: { crawler: 0, aiReferral: 0, total: 0, posts: 1, unavailable: false },
  });
});

const source = (
  name: string,
  visitorType: "crawler" | "ai_referral",
  category: string,
  visits: number
) => ({
  source: name,
  visitorType,
  agent: name,
  category,
  confidence: "verified",
  visits,
  markdownVisits: 0,
  paths: 1,
  lastSeenAt: "2026-11-05 10:00:00",
});

test("merges every kind of visit per AI company, busiest first", () => {
  const engines = agentReachEngines({
    postId: "p",
    siteId: "s",
    path: "/blog/a",
    url: "https://acme.com/blog/a",
    configured: true,
    totals: { crawled: 9, cited: 2, referred: 3, total: 14 },
    sources: [
      source("GPTBot", "crawler", "training-crawler", 5),
      source("ChatGPT-User", "crawler", "assistant-browse", 2),
      source("chatgpt", "ai_referral", "assistant-referral", 3),
      source("ClaudeBot", "crawler", "training-crawler", 4),
    ],
    points: [],
  });
  expect(
    engines.map((engine) => [
      engine.label,
      engine.crawled,
      engine.cited,
      engine.referred,
      engine.total,
    ])
  ).toEqual([
    ["OpenAI", 5, 2, 3, 10],
    ["Anthropic", 4, 0, 0, 4],
  ]);
});

test("splits daily visits by kind, including the window's oldest day", () => {
  const series = agentReachDailyVisitsByKind(
    {
      sources: [
        source("GPTBot", "crawler", "training-crawler", 6),
        source("ChatGPT-User", "crawler", "assistant-browse", 1),
        source("chatgpt", "ai_referral", "assistant-referral", 1),
      ],
      points: [
        {
          day: "2026-11-05",
          visitorType: "crawler",
          source: "GPTBot",
          visits: 2,
        },
        {
          day: "2026-11-05 00:00:00",
          visitorType: "crawler",
          source: "ChatGPT-User",
          visits: 1,
        },
        {
          day: "2026-11-05",
          visitorType: "ai_referral",
          source: "chatgpt",
          visits: 1,
        },
        {
          day: "2026-11-03",
          visitorType: "crawler",
          source: "GPTBot",
          visits: 4,
        },
        {
          day: "2026-10-01",
          visitorType: "crawler",
          source: "GPTBot",
          visits: 9,
        },
      ],
    },
    2,
    new Date("2026-11-05T18:00:00Z")
  );
  expect(series).toEqual({
    crawled: [4, 0, 2],
    cited: [0, 0, 1],
    referred: [0, 0, 1],
  });
});

test("buckets a trend from the newest day backwards", () => {
  expect(bucketAgentReachTrend([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([1, 9, 18]);
});
