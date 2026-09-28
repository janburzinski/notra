import { expect, test } from "bun:test";

import type {
  GeoAiSearchGapRow,
  GeoSearchGapRow,
} from "@notra/geo-core/types/geo";

import { GEO_GAPS_TABS } from "../src/constants/geo-gaps";
import {
  filterUnifiedSearchGaps,
  isGeoGapsTab,
  unifySearchGaps,
} from "../src/utils/geo-gaps";

test("content gaps has one search tab for both search sources", () => {
  expect(GEO_GAPS_TABS.map((tab) => tab.value)).toEqual(["prompt", "search"]);
  expect(isGeoGapsTab("ai")).toBe(false);
});

test("the same query from Search Console and AI appears once", () => {
  const consoleGap: GeoSearchGapRow = {
    id: "console-1",
    prompt: "Compare content platforms",
    title: null,
    impressions: 128,
    clicks: 3,
    position: 9,
    queries: [
      {
        query: "AI content generation platform comparison",
        clicks: 3,
        impressions: 128,
        position: 9,
      },
    ],
    brief: null,
    recommendation: { action: "create", reason: "No page", targets: [] },
  };
  const aiGap: GeoAiSearchGapRow = {
    id: "ai-1",
    query: "ai content generation platform comparison",
    variants: [],
    prompts: ["AI-specific discovery"],
    engines: ["openai/gpt-5.4-grounded"],
    searches: 2,
    ownMentionRate: 0,
    competitors: [],
    discoveredCompetitors: [],
    opportunity: 1,
    brief: null,
  };

  expect(unifySearchGaps([consoleGap], [aiGap])).toEqual([
    { kind: "console", row: consoleGap, ai: aiGap },
  ]);
  expect(
    filterUnifiedSearchGaps(unifySearchGaps([consoleGap], [aiGap]), "Compare")
  ).toEqual([{ kind: "console", row: consoleGap, ai: aiGap }]);
  expect(
    filterUnifiedSearchGaps(
      unifySearchGaps([consoleGap], [aiGap]),
      "AI-specific discovery"
    )
  ).toEqual([{ kind: "console", row: consoleGap, ai: aiGap }]);
});
