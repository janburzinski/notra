import { expect, test } from "bun:test";

import type {
  PublicAiTrafficChartRow,
  PublicAiTrafficDailyRow,
  PublicAiTrafficDetailRow,
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
    averageDays: 1,
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
    "Other",
  ]);
  expect(days.get("2026-10-31")?.total).toBeNull();
  expect(days.get("2026-10-31")?.s1).toBeNull();
  // Every group is spread over all 12 sites; the private bot, seen on one
  // site, only adds to "Other": (600 + 200 + 200) / 12 sites in total.
  expect(days.get("2026-11-01")).toEqual({
    total: 83.33,
    s1: 50,
    s2: 16.67,
    other: 16.67,
  });
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

test("keeps a tail bot on two sites inside Other on every day", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily: [
      dailyRow("2026-11-01", "", "", "", 1000),
      dailyRow("2026-11-01", "crawler", "GPTBot", "training-crawler", 600),
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

  expect(chart.series.map((entry) => entry.label)).toEqual(["GPTBot", "Other"]);
  expect(JSON.stringify(snapshot)).not.toContain("TailBot");
  for (const day of ["2026-11-01", "2026-10-31"]) {
    expect(chart.days.find((entry) => entry.day === day)?.values).toEqual({
      total: 53.33,
      s1: 50,
      other: 3.33,
    });
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

test("ranks assistants over four weeks so sparse referrals reach the floor", () => {
  const referral = (projectId: string, weeksAgo: number) => ({
    project_id: projectId,
    visitor_type: "ai_referral",
    source: "chatgpt",
    weeks_ago: weeksAgo,
    visits: 2,
    markdown_visits: 0,
  });
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects: [
      ...projectRows("crawler", "GPTBot", SITES, { recent: 70, previous: 35 }),
      // Three sites this week and three others two weeks ago: six in four weeks.
      ...["p0", "p1", "p2"].map((site) => referral(site, 0)),
      ...["p3", "p4", "p5"].map((site) => referral(site, 2)),
    ],
  });

  expect(snapshot.referrers.map((row) => row.source)).toEqual(["chatgpt"]);
  expect(snapshot.referrers[0]?.share).toBe(1);
});

function detailRow(
  section: string,
  visitorType: string,
  key: string,
  values: Partial<PublicAiTrafficDetailRow>
): PublicAiTrafficDetailRow {
  return {
    section,
    visitor_type: visitorType,
    key,
    share: 0,
    previous_share: 0,
    sites: 0,
    previous_sites: 0,
    subset_sites: 0,
    ...values,
  };
}

test("publishes hours, countries and llms.txt once enough sites stand behind them", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects: [
      ...projects,
      ...projectRows("crawler", "OAI-SearchBot", SITES.slice(0, 6), {
        recent: 20,
        previous: 20,
      }),
    ],
    detail: [
      // Seen only last window; listed first, it must not hide the rest.
      detailRow("countries", "ai_referral", "FR", {
        previous_share: 1,
        previous_sites: 4,
      }),
      detailRow("hours", "crawler", "1:4", { share: 0.75, sites: 12 }),
      detailRow("hours", "crawler", "7:23", { share: 0.25, sites: 12 }),
      // Referrals from two sites only: their grid stays out.
      detailRow("hours", "ai_referral", "3:15", { share: 1, sites: 2 }),
      detailRow("countries", "ai_referral", "US", {
        share: 0.6,
        sites: 8,
        previous_share: 0.5,
        previous_sites: 6,
        subset_sites: 10,
      }),
      // One site's visitors, averaged in as one vote of ten.
      detailRow("countries", "ai_referral", "DE", {
        share: 0.1,
        sites: 1,
        subset_sites: 10,
      }),
      detailRow("llms_txt", "crawler", "GPTBot", {
        sites: 12,
        subset_sites: 6,
      }),
      detailRow("llms_txt", "crawler", "ClaudeBot", {
        sites: 6,
        subset_sites: 2,
      }),
      detailRow("llms_txt", "crawler", "OAI-SearchBot", {
        sites: 6,
        subset_sites: 5,
      }),
    ],
  });
  const crawler = (source: string) =>
    snapshot.crawlers.find((row) => row.source === source);

  expect(snapshot.hours?.crawlers?.[0]?.[4]).toBe(0.75);
  expect(snapshot.hours?.crawlers?.[6]?.[23]).toBe(0.25);
  expect(snapshot.hours?.referrals).toBeNull();
  expect(snapshot.countries).toEqual([
    { country: "US", share: 0.6, change: 0.2 },
    { country: "DE", share: 0.1, change: null },
  ]);
  expect(crawler("GPTBot")?.llmsTxtReach).toBe(0.5);
  expect(crawler("ClaudeBot")?.llmsTxtReach).toBe(0.3333);
  expect(crawler("OAI-SearchBot")?.llmsTxtReach).toBe(0.8333);
});

test("leaves countries out when fewer than three sites had referrals", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects,
    detail: [
      detailRow("countries", "ai_referral", "US", {
        share: 1,
        sites: 2,
        subset_sites: 2,
      }),
    ],
  });

  expect(snapshot.countries).toEqual([]);
});

function rollingRow(
  row: PublicAiTrafficDailyRow,
  siteDays = 0
): PublicAiTrafficChartRow {
  return { ...row, site_days: siteDays };
}

test("charts a rolling week from the kind's own site count and site-days", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects,
    rolling: [
      rollingRow(dailyRow("2026-11-01", "", "", "", 600, 8), 20),
      // Eight sites had crawlers that week, each bot only two of them.
      rollingRow(dailyRow("2026-11-01", "crawler", "", "", 500, 8), 20),
      rollingRow(
        dailyRow("2026-11-01", "crawler", "GPTBot", "training-crawler", 400, 2)
      ),
      rollingRow(
        dailyRow(
          "2026-11-01",
          "crawler",
          "ClaudeBot",
          "training-crawler",
          100,
          2
        )
      ),
    ],
  });
  const day = snapshot.crawlerVolume.days.find(
    (entry) => entry.day === "2026-11-01"
  );

  expect(snapshot.window.averageDays).toBe(7);
  // 500 visits over 20 site-days; each bot spread over all of them.
  expect(day?.values.total).toBe(25);
  expect(day?.values.s1).toBe(20);
  expect(day?.values.s2).toBe(5);
});

test("charts a week once three sites had traffic in it", () => {
  const snapshot = buildPublicAiTrafficSnapshot({
    today: TODAY,
    generatedAt: "2026-11-02T00:20:00.000Z",
    daily,
    projects,
    rolling: [
      rollingRow(dailyRow("2026-11-01", "", "", "", 300, 3), 12),
      rollingRow(dailyRow("2026-11-01", "crawler", "", "", 300, 3), 12),
      rollingRow(
        dailyRow("2026-11-01", "crawler", "GPTBot", "training-crawler", 300, 3)
      ),
      rollingRow(dailyRow("2026-10-31", "", "", "", 200, 2), 6),
      rollingRow(dailyRow("2026-10-31", "crawler", "", "", 200, 2), 6),
      rollingRow(
        dailyRow("2026-10-31", "crawler", "GPTBot", "training-crawler", 200, 2)
      ),
    ],
  });
  const days = new Map(
    snapshot.crawlerVolume.days.map((entry) => [entry.day, entry.values])
  );

  expect(snapshot.minSites).toBe(3);
  // 300 visits over 12 site-days.
  expect(days.get("2026-11-01")?.total).toBe(25);
  expect(days.get("2026-11-01")?.s1).toBe(25);
  expect(days.get("2026-10-31")?.total).toBeNull();
});
