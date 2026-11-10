import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type {
  SqlitePipe,
  SqlitePipeEndpoint,
  SqlitePipeParams,
} from "../../types/sqlite-pipe";
import { createSqlitePipeDatabase } from "../../utils/sqlite-pipe";
import {
  geoTrafficOverview,
  geoTrafficPages,
  geoTrafficTimeseries,
} from "./geo-traffic";
import {
  webAudience,
  webHosts,
  webOverview,
  webPages,
  webSources,
  webTimeseries,
  webUtm,
} from "./web";

const SCHEMA = `
  CREATE TABLE web_pages_daily (day TEXT, organization_id TEXT, project_id TEXT, site_id TEXT, host TEXT, path TEXT, status INTEGER,
    views_state INTEGER, visitors_state INTEGER, sessions_state INTEGER, engaged_sessions_state INTEGER, ai_visitors_state INTEGER);
  CREATE TABLE web_sources_daily (day TEXT, organization_id TEXT, project_id TEXT, site_id TEXT, host TEXT,
    referrer_group TEXT, referrer_source TEXT, ai_product TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
    sessions_state INTEGER, visitors_state INTEGER);
  CREATE TABLE web_audience_daily (day TEXT, organization_id TEXT, project_id TEXT, site_id TEXT, host TEXT,
    country TEXT, device TEXT, browser TEXT, os TEXT, views_state INTEGER, visitors_state INTEGER);
  CREATE TABLE web_page_views (captured_at TEXT, organization_id TEXT, project_id TEXT, site_id TEXT, host TEXT, path TEXT,
    status INTEGER, visitor_id TEXT, session_id TEXT, session_page_index INTEGER, referrer_group TEXT, referrer_source TEXT,
    ai_product TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, country TEXT, device TEXT, browser TEXT, os TEXT,
    utm_term TEXT DEFAULT '', utm_content TEXT DEFAULT '');
  CREATE TABLE web_imported_daily (organization_id TEXT, project_id TEXT, site_id TEXT DEFAULT '', import_id TEXT,
    source_provider TEXT DEFAULT 'plausible', grain TEXT, day TEXT, host TEXT DEFAULT 'example.com', path TEXT DEFAULT '',
    referrer_host TEXT DEFAULT '', referrer_group TEXT DEFAULT '', referrer_source TEXT DEFAULT '', ai_product TEXT DEFAULT '',
    utm_source TEXT DEFAULT '', utm_medium TEXT DEFAULT '', utm_campaign TEXT DEFAULT '', utm_term TEXT DEFAULT '',
    utm_content TEXT DEFAULT '', country TEXT DEFAULT '',
    device TEXT DEFAULT '', browser TEXT DEFAULT '', os TEXT DEFAULT '', visitors INTEGER, visits INTEGER,
    pageviews INTEGER DEFAULT 0, bounces INTEGER, visit_duration_s INTEGER, entrances INTEGER, imported_at TEXT DEFAULT '');
  CREATE TABLE geo_traffic_daily (day TEXT, organization_id TEXT, project_id TEXT, site_id TEXT, visitor_type TEXT, source TEXT,
    visits_state INTEGER, markdown_visits_state INTEGER, paths_state TEXT, last_seen_state TEXT,
    agent_state TEXT, category_state TEXT, confidence_state TEXT);
  CREATE TABLE geo_traffic_pages_by_host_daily (day TEXT, organization_id TEXT, project_id TEXT, site_id TEXT, visitor_type TEXT,
    source TEXT, host TEXT, path TEXT, visits_state INTEGER, last_seen_state TEXT);
  CREATE TABLE geo_imported_daily (organization_id TEXT, project_id TEXT, site_id TEXT DEFAULT '', import_id TEXT,
    source_provider TEXT DEFAULT 'cloudflare', day TEXT, visitor_type TEXT, source TEXT, agent TEXT, category TEXT,
    confidence TEXT, verified INTEGER DEFAULT 1, host TEXT DEFAULT 'example.com', path TEXT, status INTEGER DEFAULT 200,
    requests INTEGER, sample_interval REAL DEFAULT 10, imported_at TEXT DEFAULT '');
`;

const WEB = { project_id: "project", imports: "imp1" };
const GEO = { project_id: "project", imports: "imp-geo" };

let pipe: SqlitePipe;

beforeAll(() => {
  pipe = createSqlitePipeDatabase(SCHEMA);
  pipe.db.exec(`
    INSERT INTO web_pages_daily VALUES
      ('2026-10-05','org','project','','example.com','/',200,10,4,5,2,1),
      ('2026-09-28','org','project','','example.com','/',200,3,2,2,1,0),
      ('2026-10-05','org','project','','example.com','/gone',404,9,9,0,0,0);
    INSERT INTO web_sources_daily VALUES
      ('2026-10-05','org','project','','example.com','ai','chatgpt','openai','','','',3,2),
      ('2026-10-05','org','project','','example.com','search','google','','','','',1,1),
      ('2026-10-05','org','project','','example.com','other','newsletter','','newsletter','email','oct',2,2);
    INSERT INTO web_audience_daily VALUES
      ('2026-10-05','org','project','','example.com','DE','desktop','Chrome','macOS',5,3),
      ('2026-09-28','org','project','','example.com','DE','desktop','Chrome','macOS',1,1);
    INSERT INTO geo_traffic_daily VALUES
      ('2026-10-05','org','project','','crawler','GPTBot',5,0,'["/","/about"]','2026-10-05 10:00:00','GPTBot','training-crawler','verified');
    INSERT INTO web_page_views (captured_at, organization_id, project_id, site_id, host, path, status, visitor_id, session_id,
      session_page_index, referrer_group, referrer_source, ai_product, utm_source, utm_medium, utm_campaign, country, device,
      browser, os, utm_term, utm_content) VALUES
      ('2026-10-05 10:00:00','org','project','','example.com','/',200,'v1','s1',1,'other','newsletter','','newsletter','email','oct','DE','desktop','Chrome','macOS','shoes','banner'),
      ('2026-10-05 10:05:00','org','project','','example.com','/blog',200,'v1','s1',2,'internal','','','newsletter','email','oct','DE','desktop','Chrome','macOS','shoes','banner'),
      ('2026-10-05 11:00:00','org','project','','example.com','/blog',200,'v2','s2',1,'other','newsletter','','newsletter','email','oct','DE','desktop','Chrome','macOS','boots',''),
      ('2026-09-28 11:00:00','org','project','','example.com','/blog',200,'v3','s3',1,'other','newsletter','','newsletter','email','oct','DE','desktop','Chrome','macOS','boots','');
    INSERT INTO geo_traffic_pages_by_host_daily VALUES
      ('2026-10-05','org','project','','crawler','GPTBot','example.com','/',2,'2026-10-05 10:00:00');
    INSERT INTO web_imported_daily (organization_id, project_id, import_id, grain, day, pageviews, visitors, visits, bounces) VALUES
      ('org','project','imp1','total','2026-10-02',100,40,50,20),
      ('org','project','imp1','total','2026-09-25',30,10,12,6),
      ('org','project','imp-running','total','2026-10-03',999,999,999,NULL),
      ('other-org','project','imp1','total','2026-10-03',5000,5000,5000,NULL),
      ('org','other-project','imp1','total','2026-10-03',7000,7000,7000,NULL);
    INSERT INTO web_imported_daily (organization_id, project_id, import_id, grain, day, path, pageviews, visitors, visits, bounces, entrances) VALUES
      ('org','project','imp1','page','2026-10-02','/',60,25,NULL,NULL,NULL),
      ('org','project','imp1','page','2026-10-02','/blog',40,20,NULL,NULL,NULL),
      ('org','project','imp1','entry_page','2026-10-02','/',45,NULL,30,10,30),
      ('org','project','imp1','entry_page','2026-10-02','/blog',25,NULL,20,10,20);
    INSERT INTO web_imported_daily (organization_id, project_id, import_id, grain, day, referrer_group, referrer_source, ai_product,
      utm_source, utm_medium, utm_campaign, utm_term, visitors, visits) VALUES
      ('org','project','imp1','source','2026-10-02','ai','chatgpt','openai','','','','',7,8),
      ('org','project','imp1','source','2026-10-02','search','google','','','','','',20,25),
      ('org','project','imp1','source','2026-10-02','other','newsletter','','newsletter','email','oct','shoes',5,6),
      ('org','project','imp1','source','2026-10-02','internal','','','','','','',50,50);
    INSERT INTO web_imported_daily (organization_id, project_id, import_id, grain, day, country, device, pageviews, visitors) VALUES
      ('org','project','imp1','country','2026-10-02','DE','',70,30),
      ('org','project','imp1','country','2026-10-02','US','',30,10),
      ('org','project','imp1','device','2026-10-02','','desktop',100,40);
    INSERT INTO web_imported_daily (organization_id, project_id, import_id, grain, day, browser, pageviews, visitors, visits) VALUES
      ('org','project','imp1','browser','2026-10-02','Firefox',12,NULL,9);
    INSERT INTO geo_imported_daily (organization_id, project_id, import_id, day, visitor_type, source, agent, category, confidence, path, requests) VALUES
      ('org','project','imp-geo','2026-10-03','crawler','GPTBot','GPTBot','training-crawler','verified','/',20),
      ('org','project','imp-geo','2026-10-03','crawler','GPTBot','GPTBot','training-crawler','verified','/docs',10),
      ('org','project','imp-geo','2026-09-26','crawler','ClaudeBot','ClaudeBot','training-crawler','verified','/',30),
      ('org','project','imp-other','2026-10-03','crawler','GPTBot','GPTBot','training-crawler','verified','/',900);
  `);
});

afterAll(() => pipe.db.close());

/** The given columns of each row, in order. */
const pick = (
  endpoint: SqlitePipeEndpoint,
  params: SqlitePipeParams,
  columns: string[]
) => pipe.run(endpoint, params).map((row) => columns.map((key) => row[key]));

test("imported nodes read metric columns through the table alias", () => {
  // ClickHouse resolves aliases globally: `sum(visitors) AS visitors` next to
  // another aggregate over `visitors` nests aggregates and fails to build.
  const metric =
    /(?<!AS )(?<![\w.])(?:visitors|visits|pageviews|bounces|entrances|requests|agent|category|confidence|ai_product)(?=\s*[,)])/;
  for (const endpoint of [
    webOverview,
    webTimeseries,
    webPages,
    webSources,
    webUtm,
    webAudience,
    webHosts,
    geoTrafficOverview,
    geoTrafficTimeseries,
    geoTrafficPages,
  ]) {
    for (const node of endpoint.options.nodes) {
      if (!/FROM (?:web|geo)_imported_daily AS i\b/.test(node.sql)) {
        continue;
      }
      const select = node.sql.split(/FROM (?:web|geo)_imported_daily/)[0] ?? "";
      expect(
        select.match(metric),
        `${endpoint._name}.${node._name}`
      ).toBeNull();
    }
  }
});

describe("web endpoints add completed imports", () => {
  test("overview sums native and imported totals, and native only without imports", () => {
    expect(pipe.run(webOverview, WEB)).toEqual([
      {
        views: 110,
        previous_views: 33,
        visitors: 44,
        previous_visitors: 12,
        sessions: 55,
        previous_sessions: 14,
        engaged_sessions: 32,
        ai_visitors: 8,
        previous_ai_visitors: 0,
      },
    ]);
    expect(pipe.run(webOverview, { ...WEB, imports: "" })).toEqual([
      expect.objectContaining({
        views: 10,
        previous_views: 3,
        visitors: 4,
        sessions: 5,
        ai_visitors: 1,
      }),
    ]);
  });

  test("overview for one path reads the page and entry-page grains", () => {
    expect(pipe.run(webOverview, { ...WEB, path: "/" })).toEqual([
      expect.objectContaining({
        views: 70,
        previous_views: 3,
        visitors: 29,
        sessions: 35,
        engaged_sessions: 22,
        ai_visitors: 1,
      }),
    ]);
  });

  test("timeseries adds imported days and excludes unlisted imports", () => {
    expect(pipe.run(webTimeseries, WEB)).toEqual([
      { day: "2026-10-02", views: 100, visitors: 40 },
      { day: "2026-10-05", views: 10, visitors: 4 },
    ]);
    expect(pipe.run(webTimeseries, { ...WEB, imports: "" })).toEqual([
      { day: "2026-10-05", views: 10, visitors: 4 },
    ]);
    expect(pipe.run(webTimeseries, { ...WEB, path: "/" })).toEqual([
      { day: "2026-10-02", views: 60, visitors: 25 },
      { day: "2026-10-05", views: 10, visitors: 4 },
    ]);
  });

  test("pages merge imported page views with native rows", () => {
    const columns = [
      "path",
      "views",
      "previous_views",
      "visitors",
      "landings",
      "ai_visitors",
    ];
    expect(pick(webPages, WEB, columns)).toEqual([
      ["/", 70, 3, 29, 35, 1],
      ["/blog", 40, 0, 20, 20, 0],
    ]);
    expect(pick(webPages, { ...WEB, not_found: 1 }, columns)).toEqual([
      ["/gone", 9, 0, 9, 0, 0],
    ]);
  });

  test("sources merge imported referrers and skip internal ones", () => {
    const columns = [
      "referrer_group",
      "referrer_source",
      "ai_product",
      "sessions",
      "previous_sessions",
      "visitors",
    ];
    expect(pick(webSources, WEB, columns)).toEqual([
      ["search", "google", "", 26, 0, 21],
      ["ai", "chatgpt", "openai", 11, 0, 9],
      ["other", "newsletter", "", 8, 0, 7],
    ]);
    // For one path only its own landings count; imported sources have no path.
    expect(pick(webSources, { ...WEB, path: "/" }, columns)).toEqual([
      ["other", "newsletter", "", 1, 0, 1],
    ]);
  });

  test("UTM reports count sessions per parameter, imports included", () => {
    const utm = (dimension: string, params: Record<string, string> = WEB) =>
      pipe.run(webUtm, { ...params, dimension });
    const newsletter = {
      sessions: 8,
      previous_sessions: 0,
      visitors: 7,
    };
    expect(utm("source")).toEqual([{ value: "newsletter", ...newsletter }]);
    expect(utm("medium")).toEqual([{ value: "email", ...newsletter }]);
    expect(utm("campaign")).toEqual([{ value: "oct", ...newsletter }]);
    // Without the import only the rollup's two sessions count.
    expect(utm("source", { ...WEB, imports: "" })).toEqual([
      { value: "newsletter", sessions: 2, previous_sessions: 0, visitors: 2 },
    ]);
  });

  test("UTM terms and content come from each session's first page view", () => {
    expect(pipe.run(webUtm, { ...WEB, dimension: "term" })).toEqual([
      { value: "shoes", sessions: 7, previous_sessions: 0, visitors: 6 },
      { value: "boots", sessions: 1, previous_sessions: 1, visitors: 1 },
    ]);
    // A view without utm_content is not a row; the second page of a session is not a landing.
    expect(pipe.run(webUtm, { ...WEB, dimension: "content" })).toEqual([
      { value: "banner", sessions: 1, previous_sessions: 0, visitors: 1 },
    ]);
    // For one path every parameter is read from the raw landings, without imports.
    expect(
      pipe.run(webUtm, { ...WEB, dimension: "source", path: "/blog" })
    ).toEqual([
      { value: "newsletter", sessions: 1, previous_sessions: 1, visitors: 1 },
    ]);
  });

  test("audience reads the imported grain of the requested dimension", () => {
    expect(pipe.run(webAudience, WEB)).toEqual([
      { value: "DE", visitors: 33, previous_visitors: 1, views: 75 },
      { value: "US", visitors: 10, previous_visitors: 0, views: 30 },
    ]);
    expect(pipe.run(webAudience, { ...WEB, dimension: "device" })).toEqual([
      { value: "desktop", visitors: 43, previous_visitors: 1, views: 105 },
    ]);
  });

  test("audience counts sessions as visitors when an import has no visitors", () => {
    expect(
      pipe.run(webAudience, { ...WEB, dimension: "browser" })
    ).toContainEqual({
      value: "Firefox",
      visitors: 9,
      previous_visitors: 0,
      views: 12,
    });
  });

  test("hosts add imported totals", () => {
    expect(pipe.run(webHosts, WEB)).toEqual([
      { host: "example.com", site_id: "", views: 119 },
    ]);
    expect(pipe.run(webHosts, { ...WEB, imports: "" })).toEqual([
      { host: "example.com", site_id: "", views: 19 },
    ]);
  });

  test("organization and project scope apply to imported rows", () => {
    const all = "imp1,imp-running";
    expect(
      pipe.run(webTimeseries, { ...WEB, imports: all }).map((row) => row.views)
    ).toEqual([100, 999, 10]);
    expect(
      pipe.run(webTimeseries, { project_id: "other-project", imports: "imp1" })
    ).toEqual([{ day: "2026-10-03", views: 7000, visitors: 7000 }]);
  });
});

describe("AI traffic endpoints add completed imports", () => {
  test("overview sums crawler visits per source and counts a page seen in both once", () => {
    expect(pipe.run(geoTrafficOverview, GEO)).toEqual([
      expect.objectContaining({
        source: "GPTBot",
        visits: 35,
        previous_visits: 0,
        paths: 3,
        last_seen_at: "2026-10-05 10:00:00",
      }),
      expect.objectContaining({
        source: "ClaudeBot",
        visits: 0,
        previous_visits: 30,
        agent: "ClaudeBot",
      }),
    ]);
    expect(pipe.run(geoTrafficOverview, { ...GEO, imports: "" })).toEqual([
      expect.objectContaining({ source: "GPTBot", visits: 5, paths: 2 }),
    ]);
    const [host] = pipe.run(geoTrafficOverview, {
      ...GEO,
      hosts: "example.com",
    });
    expect(host).toMatchObject({ source: "GPTBot", paths: 2 });
    const [skipped] = pipe.run(geoTrafficOverview, { ...GEO, with_paths: 0 });
    expect(skipped).toMatchObject({ paths: 0 });
  });

  test("timeseries adds imported days", () => {
    const columns = ["day", "visitor_type", "source", "visits"];
    expect(pick(geoTrafficTimeseries, GEO, columns)).toEqual([
      ["2026-10-03", "crawler", "GPTBot", 30],
      ["2026-10-05", "crawler", "GPTBot", 5],
    ]);
    expect(
      pipe.run(geoTrafficTimeseries, { ...GEO, imports: "" })
    ).toHaveLength(1);
  });

  test("pages merge imported crawler hits per path", () => {
    expect(
      pipe.run(geoTrafficPages, GEO).map((row) => [row.path, row.visits])
    ).toEqual([
      ["/", 22],
      ["/docs", 10],
    ]);
    expect(
      pipe.run(geoTrafficPages, { ...GEO, imports: "", visitor: "ai_referral" })
    ).toEqual([]);
  });
});
