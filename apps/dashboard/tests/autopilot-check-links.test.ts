import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  brandSettings,
  brandSitemapPages,
  brandSitemaps,
  organizations,
  projects,
} from "@notra/db/schema";

import { createAutopilotSandbox } from "./utils/autopilot-sandbox";
import { createWorkflowGraphRunner } from "./utils/workflow-graph-runner";

if (process.env.NOTRA_AUTOPILOT_CHECK_LINKS_TEST !== "1") {
  test("Check site links: a weekly broken-link workflow on sandbox PostgreSQL", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_AUTOPILOT_CHECK_LINKS_TEST: "1",
          DATABASE_URL: "",
        },
        timeout: 90_000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  }, 95_000);
} else {
  const ORG = "links-org";
  const sandbox = await createAutopilotSandbox();
  const db = sandbox.db;
  mock.module("@notra/db/drizzle", () => ({ db }));

  /** The public web as the step sees it: what each address answers. */
  const web = new Map<string, { status: number; body?: string }>();
  const requested: string[] = [];
  mock.module("@notra/ai/utils/public-fetch", () => ({
    fetchPublicUrl: async (input: string | URL) => {
      const url = String(input);
      requested.push(url);
      const page = web.get(url);
      if (!page) {
        throw new Error("getaddrinfo ENOTFOUND");
      }
      return new Response(page.body ?? "", { status: page.status });
    },
  }));
  const analytics = await import("@notra/analytics/tinybird/client");
  const notFoundQueries: unknown[] = [];
  mock.module("@notra/analytics/tinybird/client", () => ({
    ...analytics,
    queryWebPages: async (params: { not_found?: number }) => {
      notFoundQueries.push(params);
      return {
        data:
          params.not_found === 1
            ? [
                // Another site of the same project, which the check isn't
                // about, ranks above the checked site's only 404.
                ...Array.from({ length: 25 }, (_, index) => ({
                  host: "docs.acme.test",
                  path: `/v1/page-${index}`,
                  views: 100 - index,
                })),
                { host: "www.acme.test", path: "/careers", views: 6 },
              ].slice(0, (params as { limit?: number }).limit ?? 20)
            : [],
      };
    },
  }));
  const slack = await import("@notra/ai/integrations/slack-workspace");
  const posted: string[] = [];
  mock.module("@notra/ai/integrations/slack-workspace", () => ({
    ...slack,
    postSlackNotification: async (_organizationId: string, message: string) => {
      posted.push(message);
      return true;
    },
  }));

  const runGraph = await createWorkflowGraphRunner();
  const { saveAutopilotWorkflowInputSchema } =
    await import("../src/schemas/autopilot-workflows");
  const { buildAutopilotWorkflowGraph } =
    await import("../src/utils/autopilot-workflows");

  const now = new Date();
  await db.insert(organizations).values({
    id: ORG,
    name: "Links sandbox",
    slug: "links-sandbox",
    createdAt: now,
  });
  await db.insert(brandSettings).values({
    id: "links-brand",
    organizationId: ORG,
    // As people type it: no scheme.
    websiteUrl: "acme.test",
  });
  await db.insert(projects).values({
    id: "links-project",
    organizationId: ORG,
    name: "Acme",
    brandSettingsId: "links-brand",
  });

  const page = (links: string[]) =>
    links.map((href) => `<a href="${href}">link</a>`).join("\n");

  beforeEach(async () => {
    web.clear();
    requested.length = 0;
    posted.length = 0;
    notFoundQueries.length = 0;
    await sandbox.postgres.exec(
      'TRUNCATE "brand_sitemaps" CASCADE; TRUNCATE "workflow_runs" CASCADE;'
    );
  });
  afterAll(() => sandbox.postgres.close());

  const weekly = saveAutopilotWorkflowInputSchema.parse({
    name: "Weekly broken-link check",
    schedule: { frequency: "weekly", hour: 7, dayOfWeek: 1 },
    nodes: [
      { id: "trigger", type: "core.trigger", title: "Every Monday" },
      {
        id: "links",
        type: "autopilot.check-links",
        title: "Check the site's links",
        config: { maxPages: 10 },
      },
      {
        id: "found",
        type: "core.if",
        title: "Anything broken?",
        config: {
          rule: {
            subject: "{{nodes.links.output.brokenCount}}",
            operator: "gt",
            value: 0,
          },
        },
      },
      {
        id: "slack",
        type: "autopilot.post-to-slack",
        title: "Post the broken links",
        config: { message: "{{nodes.links.output.report}}" },
      },
    ],
    edges: [
      { source: "trigger", target: "links" },
      { source: "links", target: "found" },
      { source: "found", sourcePort: "true", target: "slack" },
    ],
  });
  const run = () =>
    runGraph({
      organizationId: ORG,
      definition: {
        key: "autopilot.custom.links",
        title: weekly.name,
        startedBy: "both",
        graph: buildAutopilotWorkflowGraph(weekly),
      },
      input: { trigger: "schedule" },
    });

  test("reads the sitemap's pages, checks every link once and posts what is broken", async () => {
    await db.insert(brandSitemaps).values({
      id: "links-sitemap",
      brandSettingsId: "links-brand",
      label: "acme.test",
      url: "https://acme.test/sitemap.xml",
      hostname: "acme.test",
    });
    await db.insert(brandSitemapPages).values(
      ["/pricing", "/blog/launch", "/docs", "https://other.test/not-ours"].map(
        (path, index) => ({
          id: `links-page-${index}`,
          sitemapId: "links-sitemap",
          url: path.startsWith("https") ? path : `https://acme.test${path}`,
          path,
          category: "crawled" as const,
          wordCount: 100 - index,
        })
      )
    );
    web.set("https://acme.test/", {
      status: 200,
      body: page(["/pricing", "/docs#install", "mailto:hi@acme.test"]),
    });
    web.set("https://acme.test/pricing", {
      status: 200,
      body: page(["/", "/old-plans", "https://partner.test/deal"]),
    });
    web.set("https://acme.test/blog/launch", {
      status: 200,
      body: page(["/old-plans", "https://bot-wall.test/", "/docs"]),
    });
    // The docs page itself is down this week, so its links aren't read.
    web.set("https://acme.test/docs", { status: 503 });
    web.set("https://acme.test/old-plans", { status: 404 });
    web.set("https://partner.test/deal", { status: 410 });
    web.set("https://bot-wall.test/", { status: 403 });

    const result = await run();
    expect(result.status).toBe("completed");
    const output = result.state.nodes.links?.output as Record<string, unknown>;
    expect(output).toMatchObject({
      site: "acme.test",
      pagesChecked: 3,
      linksChecked: 6,
      brokenCount: 2,
      unreachableCount: 1,
      missingPages: [{ path: "/careers", views: 6 }],
    });
    expect(output.broken).toEqual([
      {
        url: "https://acme.test/old-plans",
        status: 404,
        internal: true,
        foundOn: ["/pricing", "/blog/launch"],
      },
      {
        url: "https://partner.test/deal",
        status: 410,
        internal: false,
        foundOn: ["/pricing"],
      },
    ]);
    expect(output.unreachable).toEqual([
      {
        url: "https://acme.test/docs",
        internal: true,
        foundOn: ["/", "/blog/launch"],
      },
    ]);
    // A page on another site in the sitemap is never crawled as the brand's.
    expect(requested).not.toContain("https://other.test/not-ours");
    expect(notFoundQueries).toContainEqual(
      expect.objectContaining({
        not_found: 1,
        project_id: "links-project",
        hosts: "acme.test",
        limit: 200,
      })
    );

    expect(posted).toHaveLength(1);
    expect(posted[0]).toBe(
      [
        "Checked 6 links on 3 pages of acme.test: 2 broken links (1 to your own pages), 1 that didn't answer. Visitors opened 1 missing page in the last 7 days. 1 page didn't load.",
        "",
        "*Broken links*",
        "• https://acme.test/old-plans (404) on /pricing, /blog/launch",
        "• https://partner.test/deal (410) on /pricing",
        "",
        "*Missing pages visitors opened*",
        "• /careers (6 views)",
        "",
        "*Didn't answer (may be down or blocking checks)*",
        "• https://acme.test/docs on /, /blog/launch",
      ].join("\n")
    );
  });

  test("without a sitemap it reads the pages the homepage links to, and stays quiet when nothing is broken", async () => {
    web.set("https://acme.test/", {
      status: 200,
      body: page(["/about", "https://other.test/"]),
    });
    web.set("https://acme.test/about", {
      status: 200,
      body: page(["/", "/team"]),
    });
    web.set("https://acme.test/team", { status: 200 });
    web.set("https://other.test/", { status: 200 });

    const result = await run();
    expect(result.status).toBe("completed");
    expect(result.state.nodes.links?.output).toMatchObject({
      pagesChecked: 2,
      linksChecked: 4,
      brokenCount: 0,
    });
    // Other sites are checked as links but never read as the brand's pages.
    expect(requested.filter((url) => url === "https://other.test/")).toEqual([
      "https://other.test/",
    ]);
    expect(result.state.nodes.slack?.status ?? "skipped").not.toBe("success");
    expect(posted).toEqual([]);
  });

  test("a workspace without a website stops the step with the reason", async () => {
    await db.delete(projects);
    const result = await run();
    expect(result.state.nodes.links?.status).toBe("halted");
    expect(result.state.nodes.links?.reason).toBe(
      "This workspace has no project with a website to check"
    );
    expect(posted).toEqual([]);
  });
}
