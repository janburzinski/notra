import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  autopilotRuns,
  autopilotSettings,
  brandSettings,
  brandSitemapPages,
  brandSitemaps,
  geoCompetitors,
  geoMentionChecks,
  geoScans,
  geoSettings,
  organizations,
  projects,
} from "@notra/db/schema";
import { setMemoryStore } from "@notra/memory/memory";
import { createInMemoryStore } from "@notra/memory/stores/in-memory";
import { eq } from "drizzle-orm";
import { Effect, Layer } from "effect";

import { createAutopilotSandbox } from "./utils/autopilot-sandbox";
import { createWorkflowGraphRunner } from "./utils/workflow-graph-runner";

if (process.env.NOTRA_AUTOPILOT_TEMPLATE_FLOW_TEST !== "1") {
  test("Autopilot templates: refresh, comparisons and AI-readable pages run end to end", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_AUTOPILOT_TEMPLATE_FLOW_TEST: "1",
          DATABASE_URL: "",
        },
        timeout: 90_000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  }, 95_000);
} else {
  const sandbox = await createAutopilotSandbox();
  const db = sandbox.db;
  mock.module("@notra/db/drizzle", () => ({ db }));
  setMemoryStore(createInMemoryStore());

  const DAY = 24 * 60 * 60 * 1000;
  const ORG = "sandbox-org";
  const PROJECT = "sandbox-project";
  const SITE = "https://emberline.dev";
  const POST = `${SITE}/blog/gpu-autoscaling`;

  // The website repository, as GitHub would serve it.
  const repository: Record<string, string> = {
    "content/blog/gpu-autoscaling.md": [
      "---",
      "title: How to autoscale GPU inference",
      "updated: 2024-03-01",
      "---",
      "",
      "# How to autoscale GPU inference",
      "",
      "Autoscaling GPUs keeps costs down when traffic is spiky.",
      "",
      "## Pricing",
      "",
      "In 2024 an A100 costs $2.40 per hour on Emberline.",
      "",
      "## Setup",
      "",
      "Install the CLI and run `ember deploy`.",
    ].join("\n"),
    "content/blog/hello.md": "---\ntitle: Hello\n---\nHello.",
    "content/compare/emberline-vs-modal.md":
      "---\ntitle: Emberline vs Modal\n---\nA comparison.",
    "app/pricing/page.tsx":
      "\"use client\";\nexport default function Pricing() {\n  const [plans, setPlans] = useState([]);\n  useEffect(() => { fetch('/plans.json').then((r) => r.json()).then(setPlans); }, []);\n  return <Plans plans={plans} />;\n}",
  };
  const opened: {
    slug: string;
    body: string;
    files: { path: string; contents?: string }[];
  }[] = [];
  mock.module("@/lib/autopilot/github", () => ({
    AutopilotRepositoryAccessError: class extends Error {},
    getRepositoryOctokit: async () => ({ request: async () => ({ data: [] }) }),
    getInstallationOctokit: async () => null,
    getBaseBranchSha: async () => "base-sha",
    listRepositoryPaths: async () => Object.keys(repository),
    readRepositoryFile: async (
      _octokit: unknown,
      _repo: unknown,
      path: string
    ) => repository[path] ?? null,
    repositoryPathExists: async (
      _octokit: unknown,
      _repo: unknown,
      path: string
    ) => path in repository,
    openAutopilotPullRequest: async (input: (typeof opened)[number]) => {
      opened.push(input);
      return {
        number: opened.length,
        url: `https://github.com/emberline/site/pull/${opened.length}`,
        branch: `notra/autopilot/${input.slug}`,
        headSha: `head-${opened.length}`,
      };
    },
    closeAutopilotPullRequest: async () => undefined,
    requestAutopilotReviewers: async () => undefined,
  }));
  mock.module("@/lib/integrations/github/content-pull-request", () => ({
    isMergeMethodNotAllowed: () => false,
    getContentPullRequestState: async () => ({
      status: "open",
      mergedAt: null,
    }),
    markContentPullRequestReady: async () => undefined,
    mergeContentPullRequest: async () => undefined,
  }));
  mock.module("@/lib/autopilot/flag", () => ({
    isAutopilotEnabledForOrganization: async () => true,
  }));
  mock.module("@/lib/geo/configure", () => ({
    geoCoreDashboardLayer: Layer.empty,
  }));
  mock.module("@notra/geo-core/geo/gaps", () => ({
    loadGeoContentGaps: () =>
      Effect.succeed({ promptGaps: [], searchGaps: [], aiSearchGaps: [] }),
  }));
  mock.module("@notra/ai/billing/github-mention-billing", () => ({
    describeGitHubMentionBillingDenial: () => "No credits left",
    reserveGitHubMentionBilling: async (input: { mentionKey: string }) => ({
      allowed: true,
      lockId: input.mentionKey,
    }),
    confirmGitHubMentionBilling: async () => 3,
    releaseGitHubMentionBilling: async () => undefined,
    createGitHubMentionUsageCollector: () => ({
      add: () => undefined,
      get: () => null,
    }),
  }));

  // The model, as each template asks it.
  const MODEL_OUTPUT: Record<string, unknown> = {
    refresh: {
      audit: {
        keep: ["Intro", "Setup"],
        update: ["Pricing: 2024 prices"],
        add: ["Cold starts"],
        cut: [],
      },
      edits: [
        {
          action: "update",
          section: "Pricing",
          find: "In 2024 an A100 costs $2.40 per hour on Emberline.",
          replace:
            "As of November 2026 an H100 costs $1.80 per hour on Emberline, billed per second. See https://emberline.dev/pricing for current rates.",
        },
        {
          action: "add",
          section: "Cold starts",
          find: "## Setup",
          replace:
            "## Cold starts\n\nA scaled-to-zero endpoint takes a few seconds to start; keep one warm replica for latency-sensitive traffic.\n\n## Setup",
        },
        {
          action: "add",
          section: "Benchmarks",
          find: "Autoscaling GPUs keeps costs down when traffic is spiky.",
          replace:
            "Autoscaling GPUs keeps costs down when traffic is spiky. See https://dead.example/benchmarks for numbers.",
        },
      ],
      pullRequestTitle:
        "Refresh GPU autoscaling guide: cold starts, 2026 prices",
      summary:
        "Answers the cold-start questions AI answers now cite Modal for.",
    },
    "write-rules": { allowed: true },
    "fact-check": {
      claims: [
        {
          claim: "Runpod is named in alternatives questions",
          about: "competitor",
          supported: true,
          source: "brief",
          quote: "Best alternatives to Runpod for serverless inference",
          fix: null,
        },
        {
          // The checker says supported, but its quote is made up.
          claim: "Runpod costs $9.99 per hour",
          about: "competitor",
          supported: true,
          source: "brief",
          quote: "Runpod costs $9.99 per hour on demand",
          fix: { find: " Runpod costs $9.99 per hour.", replace: "" },
        },
      ],
    },
    "no-dashes": {
      edits: [
        {
          find: "Who each is for — side by side.",
          replace: "Who each is for, side by side.",
        },
      ],
    },
  };
  mock.module("@/lib/autopilot/llm", () => ({
    generateAutopilotObject: async (input: { tag: string }) => {
      if (!(input.tag in MODEL_OUTPUT)) {
        throw new Error(`No model output for ${input.tag} in this test`);
      }
      return MODEL_OUTPUT[input.tag];
    },
  }));
  const writerBriefs: { topic: string }[] = [];
  mock.module("@/lib/autopilot/writer", () => ({
    writeBlogPost: async (input: { brief: { topic: string } }) => {
      writerBriefs.push(input.brief);
      return {
        title: input.brief.topic,
        slug: "runpod-alternatives",
        extension: "md",
        content: `---\ntitle: ${input.brief.topic}\n---\nWho each is for — side by side. Runpod costs $9.99 per hour.`,
        pullRequestBody: `Compares options for ${input.brief.topic}.`,
      };
    },
  }));
  mock.module("@/lib/autopilot/hero-image", () => ({
    renderPostHeroImage: async () => {
      throw new Error("No image service in the sandbox");
    },
  }));

  // The web, as an AI crawler and a browser see it.
  const pricingText =
    "Run an H100 for $1.80 per hour with per-second billing and no minimum. Reserve capacity for a month and pay thirty percent less than on demand. Every plan includes autoscaling to zero and private networking at no extra cost. ".repeat(
      4
    );
  const web = { homeStatus: 200 };
  mock.module("@/lib/autopilot/pages", () => ({
    fetchRendered: async (url: string) => ({
      markdown: `# ${url}\nModal cold starts take under two seconds with snapshots.`,
      text: `${url} Modal cold starts take under two seconds with snapshots.`,
    }),
    fetchPageForCrawlers: async (url: string) => ({
      url,
      status: url.replace(/\/$/, "") === SITE ? web.homeStatus : 200,
      // Only the pricing page loads its plans in the browser.
      rawText: url.endsWith("/pricing")
        ? "Pricing Loading plans Emberline home docs blog"
        : pricingText,
      renderedText: pricingText,
      challenged: false,
    }),
    findDeadLinks: async (urls: string[]) =>
      urls.filter((url) => url.includes("dead.example")),
  }));
  const paddedRefusal: (string | null)[] = [];
  mock.module("@/lib/autopilot/repository-agent", () => ({
    runRepositoryAgent: async (params: {
      checkFile?: (file: {
        path: string;
        content: string;
        previous: string | null;
      }) => string | null;
      issueIds: string[];
    }) => {
      const path = "app/pricing/page.tsx";
      const previous = repository[path] ?? null;
      // An agent that pads the page with new copy is turned away.
      paddedRefusal.push(
        params.checkFile?.({
          path,
          previous,
          content: `${previous}\n<p>Emberline is the fastest and most loved GPU cloud for every team on the planet today.</p>\n<p>Thousands of engineers trust Emberline to serve their models with industry leading uptime.</p>`,
        }) ?? null
      );
      return {
        octokit: { request: async () => ({ data: {} }) },
        baseSha: "base-sha",
        paths: Object.keys(repository),
        files: [
          {
            path,
            content:
              "import plans from '../../data/plans.json';\nexport default function Pricing() {\n  return <Plans plans={plans} />;\n}",
            issueIds: params.issueIds,
            reason: "Render plans at build time",
          },
        ],
        skipped: [],
        output: {
          framework: "Next.js App Router",
          cause: "Plans were fetched in the browser after the page loaded",
          pullRequestTitle: "Render pricing on the server for AI crawlers",
          pullRequestBody:
            "- `app/pricing/page.tsx`: import plans at build time",
        },
      };
    },
  }));

  const runGraph = await createWorkflowGraphRunner();
  const { AUTOPILOT_DAILY_WORKFLOW, workflowDefinitions } =
    await import("../src/lib/workflow-engine/definitions/autopilot");
  const { AUTOPILOT_TEMPLATE_WORKFLOW_KEYS } =
    await import("../src/constants/workflow-engine");

  // A workspace whose guide AI stopped citing, and who loses to Runpod.
  const now = new Date();
  await db
    .insert(organizations)
    .values({ id: ORG, name: "Emberline", slug: "emberline", createdAt: now });
  await db.insert(brandSettings).values({
    id: "sandbox-brand",
    organizationId: ORG,
    websiteUrl: SITE,
    companyName: "Emberline",
    companyDescription: "Serverless GPU inference platform",
  });
  await db.insert(projects).values({
    id: PROJECT,
    organizationId: ORG,
    name: "Emberline",
    brandSettingsId: "sandbox-brand",
  });
  await db.insert(geoSettings).values({
    id: "sandbox-geo",
    organizationId: ORG,
    projectId: PROJECT,
    companyName: "Emberline",
  });
  await db.insert(brandSitemaps).values({
    id: "sandbox-sitemap",
    brandSettingsId: "sandbox-brand",
    label: "Emberline",
    url: `${SITE}/sitemap.xml`,
    hostname: "emberline.dev",
  });
  await db.insert(brandSitemapPages).values({
    id: "sandbox-pricing",
    sitemapId: "sandbox-sitemap",
    url: `${SITE}/pricing`,
    path: "/pricing",
    category: "crawled",
  });
  await db.insert(geoCompetitors).values({
    id: "runpod",
    organizationId: ORG,
    projectId: PROJECT,
    name: "Runpod",
    domain: "runpod.io",
  });
  const autoscale = "How do I autoscale GPU inference?";
  const answers = [
    { prompt: autoscale, daysAgo: 50, sources: [POST] },
    { prompt: autoscale, daysAgo: 45, sources: [`${POST}/`] },
    { prompt: autoscale, daysAgo: 40, sources: ["https://modal.com/docs"] },
    { prompt: autoscale, daysAgo: 6, sources: ["https://modal.com/docs/cold"] },
    { prompt: autoscale, daysAgo: 2, sources: ["https://modal.com/docs/cold"] },
    {
      prompt: "Best alternatives to Runpod for serverless inference",
      daysAgo: 3,
      sources: ["https://runpod.io/pricing"],
      competitors: ["Runpod", "Modal"],
    },
  ].map((row, index) => ({
    id: `check-${index}`,
    organizationId: ORG,
    projectId: PROJECT,
    scanId: `scan-${index}`,
    engine: "openai/chatgpt",
    promptId: row.prompt === autoscale ? "autoscale" : "alternatives",
    prompt: row.prompt,
    answer: "An answer",
    excerpt: `${row.competitors?.join(", ") ?? ""} come up for this.`,
    mentioned: false,
    competitors: row.competitors ?? [],
    grounding: {
      queries: ["gpu autoscaling cold start"],
      sources: row.sources.map((url) => ({
        url,
        title: url,
        domain: new URL(url).hostname,
      })),
    },
    capturedAt: new Date(now.getTime() - row.daysAgo * DAY),
  }));
  await db.insert(geoScans).values(
    answers.map((row) => ({
      id: row.scanId,
      organizationId: ORG,
      projectId: PROJECT,
      status: "completed" as const,
    }))
  );
  await db.insert(geoMentionChecks).values(answers);

  const enable = (jobs: Record<string, boolean>) => {
    const all = {
      readiness: false,
      keywords: false,
      commits: false,
      prompts: false,
      competitors: false,
      refresh: false,
      comparisons: false,
      rendering: false,
      ...jobs,
    };
    return db
      .insert(autopilotSettings)
      .values({
        organizationId: ORG,
        enabled: true,
        projectId: PROJECT,
        repositoryOwner: "emberline",
        repositoryName: "site",
        repositoryBranch: "main",
        maxOpenPullRequests: 5,
        jobs: all,
      })
      .onConflictDoUpdate({
        target: autopilotSettings.organizationId,
        set: { jobs: all },
      });
  };
  let runs = 0;
  const run = async (workflowKey: string) => {
    const id = `run-${(runs += 1)}`;
    await db
      .insert(autopilotRuns)
      .values({ id, organizationId: ORG, trigger: "manual", workflowKey });
    const definition = workflowDefinitions[workflowKey];
    if (!definition) {
      throw new Error(`No workflow ${workflowKey}`);
    }
    const result = await runGraph({
      organizationId: ORG,
      definition,
      definitions: Object.values(workflowDefinitions),
      input: { autopilotRunId: id, previousRunAt: null },
    });
    const row = await db.query.autopilotRuns.findFirst({
      where: eq(autopilotRuns.id, id),
    });
    return { status: result.status, row };
  };

  afterAll(() => sandbox.postgres.close());
  beforeEach(async () => {
    await sandbox.postgres.exec(
      'TRUNCATE "autopilot_findings" CASCADE; TRUNCATE "autopilot_runs" CASCADE;'
    );
    opened.length = 0;
    writerBriefs.length = 0;
    paddedRefusal.length = 0;
    web.homeStatus = 200;
  });

  test("refresh: a page AI stopped citing gets targeted edits", async () => {
    await enable({ refresh: true });
    expect((await run(AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.refresh)).status).toBe(
      "completed"
    );
    expect(opened).toHaveLength(1);
    const content = opened[0]?.files[0]?.contents ?? "";
    expect(opened[0]?.files[0]?.path).toBe("content/blog/gpu-autoscaling.md");
    expect(content).toContain("As of November 2026 an H100 costs $1.80");
    expect(content).toContain("## Cold starts");
    // The edit with a dead link is dropped; the date is set by code.
    expect(content).not.toContain("dead.example");
    expect(content).toContain(`updated: ${now.toISOString().slice(0, 10)}`);

    // One refresh waits for review at a time.
    await run(AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.refresh);
    expect(opened).toHaveLength(1);
  });

  test("comparisons: the competitor in lost questions gets a fact-checked page", async () => {
    await enable({ comparisons: true });
    expect(
      (await run(AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.comparisons)).status
    ).toBe("completed");
    // Modal already has a comparison page in the repository; Runpod doesn't.
    expect(writerBriefs[0]?.topic).toBe("Runpod alternatives");
    expect(opened[0]?.files[0]?.path).toBe(
      "content/compare/runpod-alternatives.md"
    );
    const page = opened[0]?.files[0]?.contents ?? "";
    // The claim with a made-up quote is cut, and the dash is rewritten.
    expect(page).not.toContain("$9.99");
    expect(page).not.toMatch(/[–—]/);
    expect(page).toContain("Who each is for, side by side.");
  });

  test("rendering: content only the browser shows moves into the server render", async () => {
    await enable({ rendering: true });
    expect((await run(AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.rendering)).status).toBe(
      "completed"
    );
    expect(paddedRefusal[0]).toContain("words of copy the page never showed");
    expect(opened[0]?.files.map((file) => file.path)).toEqual([
      "app/pricing/page.tsx",
    ]);
  });

  test("daily run: every enabled template acts once, and a bot wall reaches the brief", async () => {
    await enable({ refresh: true, comparisons: true, rendering: true });
    web.homeStatus = 403;
    const result = await run(AUTOPILOT_DAILY_WORKFLOW.key);
    expect(result.status).toBe("completed");
    expect(opened.map((pull) => pull.slug.split("-")[0]).sort()).toEqual([
      "blog",
      "refresh",
      "rendering",
    ]);
    expect(result.row?.summary?.insights?.join(" ")).toContain(
      "AI crawlers get 403"
    );
  });
}
