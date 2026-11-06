import { expect, test } from "bun:test";

import type {
  PublicAiTrafficDailyRow,
  PublicAiTrafficProjectRow,
} from "@/types/public-data";

import { buildPublicAiTrafficSnapshot } from "./public-ai-traffic";

const TODAY = "2026-11-02";
const SITES = Array.from({ length: 12 }, (_, index) => `p${index}`);

function projectRows(
  visitorType: string,
  source: string,
  sites: string[],
  visits: { recent: number; previous: number }
): PublicAiTrafficProjectRow[] {
  return sites.flatMap((projectId) => [
    {
      project_id: projectId,
      visitor_type: visitorType,
      source,
      weeks_ago: 0,
      visits: visits.recent,
      markdown_visits: Math.floor(visits.recent / 4),
    },
    {
      project_id: projectId,
      visitor_type: visitorType,
      source,
      weeks_ago: 1,
      visits: visits.previous,
      markdown_visits: Math.floor(visits.previous / 4),
    },
  ]);
}

function dailyRow(
  day: string,
  visitorType: string,
  source: string,
  category: string,
  visits: number,
  projects = SITES.length
): PublicAiTrafficDailyRow {
  return {
    day,
    visitor_type: visitorType,
    source,
    category,
    visits,
    markdown_visits: Math.floor(visits / 4),
    projects,
  };
}

const projects = [
  ...projectRows("crawler", "GPTBot", SITES, { recent: 70, previous: 35 }),
  ...projectRows("crawler", "ClaudeBot", SITES.slice(0, 6), {
    recent: 35,
    previous: 35,
  }),
  // One customer's private bot never clears the anonymity floor.
  ...projectRows("crawler", "AcmeInternalBot", ["p0"], {
    recent: 10_000,
    previous: 0,
  }),
  ...projectRows("ai_referral", "chatgpt", SITES, { recent: 7, previous: 7 }),
];

const daily = [
  dailyRow("2026-11-01", "", "", "", 1000),
  dailyRow("2026-11-01", "crawler", "GPTBot", "training-crawler", 600),
  dailyRow("2026-11-01", "crawler", "ClaudeBot", "training-crawler", 200),
  dailyRow("2026-11-01", "crawler", "AcmeInternalBot", "search-index", 200, 1),
  dailyRow("2026-10-31", "", "", "", 10, 2),
  dailyRow("2026-10-31", "crawler", "GPTBot", "training-crawler", 10, 2),
];

test("lists only sources that reached the anonymity floor", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects,
  });

  expect(snapshot.available).toBe(true);
  expect(snapshot.crawlers.map((row) => row.source)).toEqual([
    "GPTBot",
    "ClaudeBot",
  ]);
  expect(JSON.stringify(snapshot)).not.toContain("AcmeInternalBot");
  expect(JSON.stringify(snapshot)).not.toContain("p0");
});

test("publishes shares, reach and matched-site change, not counts", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects,
  });
  const gpt = snapshot.crawlers.find((row) => row.source === "GPTBot");

  expect(gpt?.vendor).toBe("OpenAI");
  expect(gpt?.purpose).toBe("training-crawler");
  expect(gpt?.reach).toBe(1);
  expect(gpt?.change).toBe(1);
  expect(gpt?.medianDailyVisits).toBe(10);
  expect(snapshot.referrers[0]?.vendor).toBe("OpenAI");
  expect(snapshot.vendors.map((row) => row.vendor)).toEqual(["OpenAI"]);
  expect(snapshot.window).toEqual({
    from: "2026-09-03",
    to: "2026-11-01",
    recentFrom: "2026-10-26",
  });
});

test("charts visits per site and blanks days with too few sites", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects,
  });
  const days = new Map(
    snapshot.crawlerVolume.days.map((entry) => [entry.day, entry.values])
  );

  expect(snapshot.crawlerVolume.series.map((entry) => entry.label)).toEqual([
    "GPTBot",
    "ClaudeBot",
  ]);
  expect(days.get("2026-10-31")?.s1).toBeNull();
  // 600 GPTBot visits over 12 sites.
  expect(days.get("2026-11-01")?.s1).toBe(50);
  // Other holds only the private bot, seen on one site, so it is dropped.
  expect(days.get("2026-11-01")).not.toHaveProperty("other");
});

test("hides purposes fed by too few sites", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects: [
      ...projects,
      ...projectRows("crawler", "OAI-SearchBot", SITES.slice(0, 2), {
        recent: 50,
        previous: 50,
      }),
    ],
  });

  expect(snapshot.purposes.map((row) => row.purpose)).not.toContain(
    "search-index"
  );
});

test("publishes nothing below the minimum number of sites", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects: projectRows("crawler", "GPTBot", SITES.slice(0, 3), {
      recent: 70,
      previous: 35,
    }),
  });

  expect(snapshot.available).toBe(false);
  expect(snapshot.crawlers).toEqual([]);
});

test("leaves out heuristic sources the dashboard hides", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily: [
      ...daily,
      dailyRow(
        "2026-11-01",
        "crawler",
        "Browser-imitating agent",
        "assistant-browse",
        5000
      ),
    ],
    projects: [
      ...projects,
      ...projectRows("crawler", "Browser-imitating agent", SITES, {
        recent: 5000,
        previous: 5000,
      }),
    ],
  });
  const plain = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects,
  });

  expect(JSON.stringify(snapshot)).not.toContain("Browser-imitating agent");
  expect(snapshot.crawlers).toEqual(plain.crawlers);
  expect(snapshot.summary).toEqual(plain.summary);
});

test("caps one large site so it can't dominate a share", () => {
  const sites = SITES.slice(0, 6);
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects: [
      ...projectRows("crawler", "GPTBot", sites, { recent: 10, previous: 10 }),
      // One huge customer: 1,000× the others.
      ...projectRows("crawler", "GPTBot", ["big"], {
        recent: 10_000,
        previous: 10_000,
      }),
      ...projectRows("crawler", "ClaudeBot", sites, {
        recent: 20,
        previous: 20,
      }),
      ...projectRows("crawler", "Bytespider", SITES, {
        recent: 1,
        previous: 1,
      }),
      ...projectRows("ai_referral", "chatgpt", SITES, {
        recent: 7,
        previous: 7,
      }),
    ],
  });
  const share = (source: string) =>
    snapshot.crawlers.find((row) => row.source === source)?.share ?? 0;

  // Uncapped GPTBot would hold 99% of crawls; capped, the big site counts
  // 5× the median (50) and ClaudeBot stays ahead.
  expect(share("GPTBot")).toBeLessThan(share("ClaudeBot"));
  expect(snapshot.crawlers[0]?.source).toBe("ClaudeBot");
  // Reach still counts the big site.
  expect(
    snapshot.crawlers.find((row) => row.source === "GPTBot")?.reach
  ).toBeGreaterThan(0.5);
});

test("drops Other from a chart when it is withheld on some days", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily: [
      dailyRow("2026-11-01", "", "", "", 1000),
      dailyRow("2026-11-01", "crawler", "GPTBot", "training-crawler", 600),
      // A tail bot on two sites lands in "Other", below the floor.
      dailyRow("2026-11-01", "crawler", "TailBot", "search-index", 40, 2),
      dailyRow("2026-10-31", "", "", "", 1000),
      dailyRow("2026-10-31", "crawler", "GPTBot", "training-crawler", 600),
      dailyRow("2026-10-31", "crawler", "TailBot", "search-index", 40, 6),
    ],
    projects: [
      ...projectRows("crawler", "GPTBot", SITES, { recent: 70, previous: 35 }),
      ...projectRows("crawler", "TailBot", ["p0", "p1"], {
        recent: 5,
        previous: 5,
      }),
    ],
  });
  const chart = snapshot.crawlerVolume;

  expect(chart.series.map((entry) => entry.label)).toEqual(["GPTBot"]);
  for (const entry of chart.days) {
    expect(Object.keys(entry.values)).toEqual(["s1"]);
  }
});

test("withholds last week's figures when too few sites fed them", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects: [
      ...projectRows("crawler", "GPTBot", SITES, { recent: 70, previous: 35 }),
      // Six sites this week, only two of them last week.
      ...projectRows("crawler", "ClaudeBot", SITES.slice(0, 2), {
        recent: 35,
        previous: 35,
      }),
      ...projectRows("crawler", "ClaudeBot", SITES.slice(2, 6), {
        recent: 35,
        previous: 0,
      }),
      ...projectRows("ai_referral", "chatgpt", SITES, {
        recent: 7,
        previous: 7,
      }),
    ],
  });
  const claude = snapshot.crawlers.find((row) => row.source === "ClaudeBot");

  expect(claude?.previousShare).toBeNull();
  expect(claude?.change).toBeNull();
  expect(snapshot.crawlers.find((row) => row.source === "GPTBot")?.change).toBe(
    1
  );
});

test("withholds summary figures fed by too few sites", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects: [
      // Crawlers on twelve sites, but only two ask for Markdown.
      ...projectRows("crawler", "GPTBot", SITES, { recent: 3, previous: 3 }),
      ...projectRows("crawler", "ClaudeBot", SITES.slice(0, 2), {
        recent: 40,
        previous: 40,
      }),
      // Referrals from two sites only.
      ...projectRows("ai_referral", "chatgpt", SITES.slice(0, 2), {
        recent: 7,
        previous: 7,
      }),
    ],
  });

  expect(snapshot.available).toBe(true);
  expect(snapshot.summary.crawlsPerReferral).toBeNull();
  expect(snapshot.summary.markdownShare).toBeNull();
});

test("publishes summary figures once five sites feed each part", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects,
  });

  expect(snapshot.summary.crawlsPerReferral).not.toBeNull();
  expect(snapshot.summary.markdownShare).not.toBeNull();
});
