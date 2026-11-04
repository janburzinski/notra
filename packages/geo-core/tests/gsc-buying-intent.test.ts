import { describe, expect, test } from "bun:test";

import {
  attachTopPages,
  resolveSourceKeywords,
  selectKeywordsForModel,
} from "../src/geo/suggestion-keywords";
import type {
  GeoContentCollisionCandidate,
  GeoContentCollisionMatch,
  GeoSuggestionKeyword,
} from "../src/types/geo";
import type { GscBuyingIntentSection } from "../src/types/google-search-console";
import {
  recommendSearchGapAction,
  searchGapRankingPage,
} from "../src/utils/geo-content-collision";
import { buyingIntentSection } from "../src/utils/gsc-buying-intent";

function row(query: string, impressions: number, position = 8, clicks = 0) {
  return { query, clicks, impressions, position };
}

describe("buyingIntentSection", () => {
  test.each<[string, GscBuyingIntentSection]>([
    ["notion alternatives", "alternatives"],
    ["linear competitors", "alternatives"],
    ["jira alternatives vs linear", "alternatives"],
    ["best changelog tools", "comparison"],
    ["linear vs jira", "comparison"],
    ["linear vs. jira", "comparison"],
    ["compare release note tools", "comparison"],
    ["how much does changelog software cost", "pricing"],
    ["changelog tool pricing for startups", "pricing"],
    ["release notes software reviews 2026", "reviews"],
    ["beste crm software", "comparison"],
    ["crm software vergleich", "comparison"],
    ["meilleur logiciel crm", "comparison"],
    ["mejores alternativas a notion", "alternatives"],
    ["erfahrungen mit changelog tools", "reviews"],
    ["crm software pricing", "pricing"],
    ["changelog tool pricing", "pricing"],
    ["email tools reviews", "reviews"],
    ["logiciel crm prix", "pricing"],
  ])("%p is %p", (query, section) => {
    expect(buyingIntentSection(query)).toBe(section);
  });

  test.each([
    "how to write a changelog",
    "changelog template",
    "email marketing best practices",
    "bestätigen anmeldung",
    "costco opening hours",
    "previews in markdown",
    "conversion tracking",
    "code review best practices",
    "api pricing best practices",
    "code review tool",
    "vs code",
    "vs code extensions",
    "install vs code on mac",
    "best buy",
    "best-in-class crm",
    "cost of living calculator",
    "stock price api",
  ])("%p has no buying intent", (query) => {
    expect(buyingIntentSection(query)).toBeNull();
  });

  test.each([
    "acme pricing",
    "acme pro pricing plans",
    "acme reviews",
    "acme erfahrungen",
    "acme pricing 2026",
    "acme reviews 2026",
    "acme reviews reddit",
    "acme pricing plans 2026",
  ])("%p names one product's own page, so it gets no boost", (query) => {
    expect(buyingIntentSection(query)).toBeNull();
  });

  test("matches accented terms whatever their Unicode form", () => {
    expect(buyingIntentSection("crm comparación".normalize("NFD"))).toBe(
      "comparison"
    );
  });

  test("code review tools with a price word are still a category search", () => {
    expect(buyingIntentSection("code review tools pricing")).toBe("pricing");
  });

  test("ignores case and extra whitespace", () => {
    expect(buyingIntentSection("  Notion   ALTERNATIVES ")).toBe(
      "alternatives"
    );
  });
});

describe("selectKeywordsForModel buying intent", () => {
  test("ranks a buying-intent query above a bigger informational one", () => {
    const picked = selectKeywordsForModel(
      [row("changelog examples", 100), row("notion alternatives", 80)],
      []
    );
    expect(picked.map((item) => item.query)).toEqual([
      "notion alternatives",
      "changelog examples",
    ]);
  });

  test("does not boost a single product's pricing page", () => {
    const picked = selectKeywordsForModel(
      [row("acme pricing", 80), row("changelog examples", 100)],
      []
    );
    expect(picked.map((item) => item.query)).toEqual([
      "changelog examples",
      "acme pricing",
    ]);
  });

  test("keeps position weighting: a won query stays below a striking one", () => {
    const picked = selectKeywordsForModel(
      [row("best changelog tools", 500, 1, 0), row("changelog examples", 100)],
      []
    );
    expect(picked.map((item) => item.query)).toEqual([
      "changelog examples",
      "best changelog tools",
    ]);
  });
});

describe("attachTopPages", () => {
  test("tags each query with the page it got most impressions on", () => {
    const rows = [row("email tools", 120, 6, 4), row("crm", 40)];
    const tagged = attachTopPages(rows, [
      {
        query: "email tools",
        page: "https://example.com/a",
        clicks: 3,
        impressions: 50,
        position: 4,
      },
      {
        query: "Email Tools",
        page: "https://example.com/b",
        clicks: 1,
        impressions: 70,
        position: 9,
      },
    ]);
    expect(tagged[0]).toEqual({
      query: "email tools",
      clicks: 4,
      impressions: 120,
      position: 6,
      page: "https://example.com/b",
      pagePosition: 9,
      pageImpressions: 70,
    });
    expect(tagged[1]).toEqual(row("crm", 40));
    expect(tagged[1]).not.toHaveProperty("page");
  });

  test("breaks an impression tie by the better position", () => {
    const [tagged] = attachTopPages(
      [row("email tools", 100)],
      [
        {
          query: "email tools",
          page: "https://example.com/low",
          clicks: 0,
          impressions: 50,
          position: 12,
        },
        {
          query: "email tools",
          page: "https://example.com/high",
          clicks: 0,
          impressions: 50,
          position: 3,
        },
      ]
    );
    expect(tagged?.page).toBe("https://example.com/high");
  });
});

describe("resolveSourceKeywords", () => {
  test("carries the ranking page through to the stored keyword", () => {
    const withPage = {
      ...row("email tools", 120),
      page: "https://e.com/x",
      pagePosition: 11.26,
      pageImpressions: 90,
    };
    const keywords = resolveSourceKeywords(
      ["email tools", "crm"],
      new Map([
        ["email tools", withPage],
        ["crm", row("crm", 40)],
      ]),
      new Set()
    );
    expect(keywords[0]?.page).toBe("https://e.com/x");
    expect(keywords[0]?.pagePosition).toBe(11.3);
    expect(keywords[0]?.pageImpressions).toBe(90);
    expect(keywords[1]).not.toHaveProperty("page");
    expect(keywords[1]).not.toHaveProperty("pagePosition");
  });
});

function keyword(
  query: string,
  impressions: number,
  position: number,
  page?: string,
  pagePosition?: number,
  pageImpressions?: number
): GeoSuggestionKeyword {
  return {
    query,
    clicks: 0,
    impressions,
    position,
    ...(page ? { page } : {}),
    ...(pagePosition === undefined ? {} : { pagePosition }),
    ...(pageImpressions === undefined ? {} : { pageImpressions }),
  };
}

describe("searchGapRankingPage", () => {
  test("is null when no keyword has a page", () => {
    expect(searchGapRankingPage([keyword("crm", 100, 5)])).toBeNull();
    expect(searchGapRankingPage(null)).toBeNull();
  });

  test("picks the page with the most impressions and weights its position", () => {
    const page = searchGapRankingPage([
      keyword("changelog examples", 30, 2, "https://e.com/small"),
      keyword("notion alternatives", 100, 6, "https://e.com/big"),
      keyword("notion competitors", 100, 10, "https://e.com/big"),
    ]);
    expect(page).toEqual({
      url: "https://e.com/big",
      position: 8,
      section: "alternatives",
    });
  });

  test("takes the section from the biggest query with buying intent", () => {
    const page = searchGapRankingPage([
      keyword("changelog examples", 200, 5, "https://e.com/p"),
      keyword("changelog tool pricing for teams", 50, 5, "https://e.com/p"),
      keyword("best changelog tools", 20, 5, "https://e.com/p"),
    ]);
    expect(page?.section).toBe("pricing");
  });

  test("is null past Google's second page", () => {
    expect(
      searchGapRankingPage([keyword("crm", 500, 35, "https://e.com/p")])
    ).toBeNull();
  });

  test("uses the page's own position, not the query's", () => {
    const page = searchGapRankingPage([
      keyword("crm software", 100, 6, "https://e.com/p", 9),
      keyword("crm tools", 100, 4, "https://e.com/p", 13),
    ]);
    expect(page?.position).toBe(11);
  });

  test("a page past position 20 is not eligible even when its query ranks well", () => {
    expect(
      searchGapRankingPage([keyword("crm", 500, 6, "https://e.com/p", 25)])
    ).toBeNull();
  });

  test("never picks the homepage", () => {
    const page = searchGapRankingPage([
      keyword("notion alternatives", 900, 9, "https://e.com/", 9),
      keyword("notion competitors", 50, 9, "https://e.com/alternatives", 9),
    ]);
    expect(page?.url).toBe("https://e.com/alternatives");
    expect(
      searchGapRankingPage([keyword("crm", 900, 9, "https://www.e.com", 9)])
    ).toBeNull();
    expect(
      searchGapRankingPage([
        keyword("crm", 900, 9, "https://e.com/?utm_source=google&srsltid=x", 9),
      ])
    ).toBeNull();
  });

  test("a root URL that selects content is not the homepage", () => {
    expect(
      searchGapRankingPage([keyword("crm", 900, 9, "https://e.com/?p=123", 9)])
        ?.url
    ).toBe("https://e.com/?p=123");
  });

  test("counts www, protocol and trailing-slash variants as one page", () => {
    const page = searchGapRankingPage([
      keyword("crm tools", 60, 8, "https://e.com/crm/", 8),
      keyword("crm software", 60, 8, "http://www.e.com/crm", 8),
      keyword("best crm", 100, 8, "https://e.com/other", 8),
    ]);
    expect(page?.url).toMatch(/\/crm\/?$/);
  });

  test("weights by the page's own impressions, not the query's total", () => {
    const page = searchGapRankingPage([
      // A big query mostly shown with other pages: only 30 of 1000 here.
      keyword("crm", 1000, 8, "https://e.com/a", 15, 30),
      keyword("crm software", 200, 8, "https://e.com/b", 6, 200),
    ]);
    expect(page?.url).toBe("https://e.com/b");
    expect(page?.position).toBe(6);
  });

  test("an ineligible bigger page does not hide an eligible one", () => {
    const page = searchGapRankingPage([
      keyword("crm", 900, 8, "https://e.com/far", 35),
      keyword("crm software", 100, 8, "https://e.com/near", 8),
    ]);
    expect(page?.url).toBe("https://e.com/near");
  });
});

const strongMatch: GeoContentCollisionMatch = {
  kind: "post",
  id: "post-1",
  url: "https://e.com/blog/other",
  title: "Other post",
  score: 0.9,
};

describe("recommendSearchGapAction with a ranking page", () => {
  const rankingPage = {
    url: "https://www.e.com/alternatives/",
    position: 6.2,
    section: "alternatives" as const,
  };

  test("updates the page Google ranks when no page strongly matches", () => {
    const recommendation = recommendSearchGapAction({
      matches: [{ ...strongMatch, score: 0.4 }],
      impressions: 400,
      clicks: 2,
      rankingPage,
    });
    expect(recommendation.action).toBe("update");
    expect(recommendation.reason).toBe(
      "Google already ranks this page at #6.2 for these queries. Add a list of alternatives near the top instead of publishing a new page."
    );
    expect(recommendation.targets).toEqual([
      {
        kind: "page",
        id: rankingPage.url,
        url: rankingPage.url,
        title: rankingPage.url,
        score: 0,
        googlePosition: 6.2,
      },
    ]);
  });

  test("a known ranking page wins over a stronger word match", () => {
    const known: GeoContentCollisionCandidate = {
      kind: "page",
      id: "sitemap-alt",
      url: "https://e.com/alternatives",
      title: "Alternatives",
      slug: null,
    };
    const recommendation = recommendSearchGapAction({
      matches: [strongMatch],
      impressions: 400,
      clicks: 2,
      rankingPage,
      candidates: [known],
    });
    expect(recommendation.action).toBe("update");
    expect(recommendation.targets[0]?.id).toBe("sitemap-alt");
    expect(recommendation.targets[0]?.googlePosition).toBe(6.2);
  });

  test("an unknown ranking page does not override a strong match", () => {
    const recommendation = recommendSearchGapAction({
      matches: [strongMatch],
      impressions: 400,
      clicks: 2,
      rankingPage,
    });
    expect(recommendation.action).toBe("update");
    expect(recommendation.targets).toEqual([strongMatch]);
    expect(recommendation.reason).toStartWith("Existing page covers 90%");
  });

  test("keeps a scored match's title and score for the same URL", () => {
    const scored: GeoContentCollisionMatch = {
      kind: "page",
      id: "sitemap-7",
      url: "https://e.com/alternatives",
      title: "Notion alternatives",
      score: 0.4,
    };
    const recommendation = recommendSearchGapAction({
      matches: [strongMatch, scored],
      impressions: 400,
      clicks: 2,
      rankingPage,
    });
    expect(recommendation.targets).toEqual([
      { ...scored, googlePosition: 6.2 },
    ]);
  });

  test("finds a sitemap page by URL when it shares no words with the queries", () => {
    const homepage: GeoContentCollisionCandidate = {
      kind: "page",
      id: "sitemap-home",
      url: "https://e.com/why-acme",
      title: "Acme: release notes for busy teams",
      slug: null,
    };
    const recommendation = recommendSearchGapAction({
      matches: [],
      impressions: 400,
      clicks: 0,
      rankingPage: {
        url: "https://www.e.com/why-acme/",
        position: 4,
        section: null,
      },
      candidates: [homepage],
    });
    expect(recommendation.reason).toBe(
      "Google already ranks this page at #4 for these queries; update it to answer them instead of publishing a new page."
    );
    expect(recommendation.targets).toEqual([
      {
        kind: "page",
        id: "sitemap-home",
        url: "https://e.com/why-acme",
        title: "Acme: release notes for busy teams",
        score: 0,
        googlePosition: 4,
      },
    ]);
  });

  test("keeps pages that differ only by query string apart", () => {
    const product = (id: string): GeoContentCollisionCandidate => ({
      kind: "page",
      id: `sitemap-${id}`,
      url: `https://e.com/product?id=${id}`,
      title: `Product ${id}`,
      slug: null,
    });
    const recommendation = recommendSearchGapAction({
      matches: [],
      impressions: 400,
      clicks: 0,
      rankingPage: {
        url: "https://www.e.com/product/?id=2",
        position: 5,
        section: null,
      },
      candidates: [product("1"), product("2")],
    });
    expect(recommendation.targets[0]?.id).toBe("sitemap-2");
    expect(recommendation.targets[0]?.url).toBe("https://e.com/product?id=2");
  });

  test("thin demand still falls through to ignore", () => {
    const recommendation = recommendSearchGapAction({
      matches: [],
      impressions: 10,
      clicks: 0,
      rankingPage,
    });
    expect(recommendation.action).toBe("ignore");
  });

  test("without a ranking page the advice is unchanged", () => {
    const recommendation = recommendSearchGapAction({
      matches: [strongMatch],
      impressions: 400,
      clicks: 2,
      rankingPage: null,
    });
    expect(recommendation.action).toBe("update");
    expect(recommendation.targets).toEqual([strongMatch]);
    expect(recommendation.targets[0]).not.toHaveProperty("googlePosition");
  });
});
