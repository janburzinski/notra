import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  autopilotFindings,
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
  test("Autopilot templates: refresh, comparisons, AI-readable pages, internal links and landing pages run end to end", () => {
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
    "content/blog/serving-models.md": [
      "---",
      "title: Serving models on GPUs",
      "---",
      "",
      "Serving models is mostly about gpu autoscaling and cost.",
      "",
      "## Scaling",
      "",
      "Turn on gpu autoscaling so idle replicas cost nothing. The H100 hourly price is easy to compare.",
      "",
      "Cold starts aside, the H100 hourly price dropped again last month.",
    ].join("\n"),
    "content/compare/emberline-vs-modal.md":
      "---\ntitle: Emberline vs Modal\n---\nA comparison.",
    "app/page.tsx": [
      'import { Hero } from "@/components/hero";',
      "",
      "export const metadata = {",
      '  title: "Emberline",',
      '  description: "Run models on GPUs.",',
      "};",
      "",
      "export default function Home() {",
      "  return (",
      '    <main className="mx-auto max-w-5xl">',
      '      <Hero title="Deploy models fast" />',
      "      <p>Emberline runs your models.</p>",
      '      <img src="/gpu.png" alt="GPU dashboard" />',
      "      <p hidden>Spring sale ends soon.</p>",
      '      <script>{\'gtag("config", "G-OLD")\'}</script>',
      "    </main>",
      "  );",
      "}",
    ].join("\n"),
    "pages/pricing.tsx":
      "export default function Pricing() {\n  return (\n    <Head>\n      <title>Pricing</title>\n    </Head>\n  );\n}",
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
  // Search Console, three months of query and page pairs.
  const searchConsole = {
    rows: [
      ["gpu autoscaling", "/blog/gpu-autoscaling", 8, 900],
      ["autoscale gpu inference", "/blog/gpu-autoscaling", 11, 300],
      ["h100 hourly price", "/pricing", 6, 400],
      ["cold starts", "/blog/cold-starts", 12, 250],
      ["emberline pricing", "/pricing", 3, 2000],
      ["serving models on gpus", "/blog/serving-models", 2, 80],
    ].map(([query, page, position, impressions]) => ({
      query: query as string,
      page: `https://emberline.dev${page}`,
      clicks: 1,
      position: position as number,
      impressions: impressions as number,
    })),
  };
  const gsc = {
    inspected: [] as string[],
    inspection: {
      verdict: "NEUTRAL",
      coverageState: "Discovered - currently not indexed" as string | null,
      lastCrawlAt: null as string | null,
    },
  };
  const realSearchConsole =
    await import("@notra/ai/integrations/google-search-console");
  mock.module("@notra/ai/integrations/google-search-console", () => ({
    ...realSearchConsole,
    getGscIntegration: async () => ({
      status: "connected",
      disconnectingAt: null,
    }),
    queryGscQueryPages: async () => searchConsole.rows,
    inspectGscUrl: async (
      _integration: unknown,
      params: { inspectionUrl: string }
    ) => {
      gsc.inspected.push(params.inspectionUrl);
      return gsc.inspection;
    },
  }));
  mock.module("@/lib/autopilot/flag", () => ({
    isAutopilotEnabledForOrganization: async () => true,
    autopilotFlagState: async () => "enabled",
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
    // Keeps every candidate except "cold starts" (c4), which reads as another sense.
    links: {
      decisions: ["c1", "c2", "c3", "c4"].map((id) => ({
        id,
        keep: id !== "c4",
        reason: "test",
      })),
    },
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
            "## Cold starts\n\nA scaled-to-zero endpoint takes a few seconds to start; keep one warm replica for latency-sensitive traffic. See https://emberline.dev/docs/cold-starts.\n\n## Setup",
        },
        {
          // Finds text the edit above added, redirected link included.
          action: "update",
          section: "Cold starts",
          find: "See https://emberline.dev/docs/cold-starts.",
          replace:
            "See https://emberline.dev/docs/cold-starts for setup steps.",
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
    // An illustrative figure no source has is rewritten, not a failed post.
    "no-figures": {
      edits: [
        {
          // Models copy the "- " the sentence was listed with.
          find: "- Teams that switch cut their bill by 12.5%.",
          replace: "Teams that switch often cut their bill.",
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
  const modelPrompts: { tag: string; prompt: string }[] = [];
  // A refresh of the serving post edits that post, not the autoscaling guide.
  const servingRefresh = {
    audit: { keep: ["Scaling"], update: [], add: ["Which platform"], cut: [] },
    edits: [
      {
        action: "add",
        section: "Which platform",
        find: "Serving models is mostly about gpu autoscaling and cost.",
        replace:
          "Serving models is mostly about gpu autoscaling and cost.\n\n## Which serverless GPU platform to use\n\nPick a platform that scales to zero, bills per second and starts a cold endpoint in seconds. Emberline does all three on H100s.",
      },
    ],
    pullRequestTitle: "Answer which serverless GPU platform to use",
    summary: "Answers the platform question AI answers name Modal for.",
  };
  mock.module("@/lib/autopilot/llm", () => ({
    generateAutopilotObject: async (input: { tag: string; prompt: string }) => {
      if (!(input.tag in MODEL_OUTPUT)) {
        throw new Error(`No model output for ${input.tag} in this test`);
      }
      modelPrompts.push({ tag: input.tag, prompt: input.prompt });
      if (
        input.tag === "refresh" &&
        input.prompt.includes("content/blog/serving-models.md")
      ) {
        return servingRefresh;
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
        content: `---\ntitle: ${input.brief.topic}\n---\nWho each is for — side by side. Runpod costs $9.99 per hour. Teams that switch cut their bill by 12.5%.`,
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
  const homepageText =
    "Deploy models fast. Emberline runs your models. Pricing Docs Blog";
  mock.module("@/lib/autopilot/pages", () => ({
    fetchRendered: async (url: string) => {
      if (url.replace(/\/$/, "") === SITE) {
        return { markdown: homepageText, text: homepageText };
      }
      // The pricing page shares its tagline with the homepage.
      const text = url.endsWith("/pricing")
        ? "H100 hourly price: $1.80. Emberline runs your models."
        : `${url} Modal cold starts take under two seconds with snapshots.`;
      return { markdown: text, text };
    },
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
    resolveLinks: async (urls: string[]) => ({
      dead: urls.filter((url) => url.includes("dead.example")),
      moved: new Map(
        urls
          .filter((url) => url.endsWith("/docs/cold-starts"))
          .map((url) => [url, url.replace("/docs/", "/docs/scaling/")])
      ),
    }),
    // Only the serving post is live, and its page reads like its file.
    // Only the homepage has an image description.
    fetchPageAttributes: async (url: string) =>
      url.replace(/\/$/, "") === SITE ? "GPU dashboard" : "",
    fetchPageText: async (url: string) =>
      url === `${SITE}/blog/serving-models`
        ? (repository["content/blog/serving-models.md"] ?? null)
        : null,
  }));
  const paddedRefusal: (string | null)[] = [];
  const landingRefusals: (string | null)[] = [];
  const landingPages: string[] = [];
  // The landing agent: a layout change is turned away, a copy rewrite is staged.
  const landingAgent = (params: {
    checkFile?: (file: {
      path: string;
      content: string;
      previous: string | null;
    }) => string | null;
    issueIds: string[];
  }) => {
    landingPages.push(params.issueIds[0] ?? "");
    const path = "app/page.tsx";
    const previous = repository[path] ?? null;
    const edit = (from: string, to: string) =>
      params.checkFile?.({
        path,
        previous,
        content: (previous ?? "").replace(from, to),
      }) ?? null;
    // Only the homepage's copy is in this repository.
    if (params.issueIds[0] !== SITE) {
      // The homepage's files: its hero isn't on this page, its tagline is
      // shared, and its metadata isn't this route's.
      const own = repository["pages/pricing.tsx"] ?? null;
      landingRefusals.push(
        edit("Deploy models fast", "GPU prices"),
        edit("Emberline runs your models.", "Emberline lists H100 prices."),
        edit("Run models on GPUs.", "H100 hourly prices."),
        // The page's own title, in a route named by its file.
        params.checkFile?.({
          path: "pages/pricing.tsx",
          previous: own,
          content: (own ?? "").replace(
            "Pricing<",
            "H100 and A100 GPU pricing<"
          ),
        }) ?? null
      );
      return {
        octokit: { request: async () => ({ data: {} }) },
        baseSha: "base-sha",
        paths: Object.keys(repository),
        files: [],
        skipped: [
          {
            issueId: params.issueIds[0] ?? "",
            reason: "The plans come from a CMS",
          },
        ],
        output: { pullRequestTitle: "", summary: "", notes: "" },
      };
    }
    const relayout = (previous ?? "").replace("max-w-5xl", "max-w-6xl");
    // Rewrapped onto its own line with other quotes, as models do: still only copy.
    const rewritten = (previous ?? "")
      .replace(
        '"Run models on GPUs.",',
        "\n    'Serverless GPU inference for open models.',"
      )
      .replace("Deploy models fast", "Serverless GPUs for open models")
      .replace(
        "Emberline runs your models.",
        "Emberline runs open models on H100s and scales them to zero."
      )
      // Image descriptions read in the page's HTML, not its body text.
      .replace('alt="GPU dashboard"', 'alt="Serverless GPU dashboard"');
    landingRefusals.push(
      params.checkFile?.({ path, previous, content: relayout }) ?? null,
      // A line break after return makes the page render nothing.
      params.checkFile?.({
        path,
        previous,
        content: rewritten.replace("return (", "return\n("),
      }) ?? null,
      // Script contents are code, never copy.
      params.checkFile?.({
        path,
        previous,
        content: rewritten.replace("G-OLD", "G-NEW"),
      }) ?? null,
      edit("Spring sale ends soon.", "Serverless GPUs, billed per second."),
      params.checkFile?.({ path, previous, content: rewritten }) ?? null
    );
    return {
      octokit: { request: async () => ({ data: {} }) },
      baseSha: "base-sha",
      paths: Object.keys(repository),
      files: [
        {
          path,
          content: rewritten,
          issueIds: params.issueIds,
          reason: "Answer the serverless GPU prompts",
        },
      ],
      skipped: [],
      output: {
        pullRequestTitle: "Say what Emberline runs on the homepage",
        summary: "The homepage now names serverless GPUs and open models.",
        notes: "- The hero names the category AI answers ask about",
      },
    };
  };
  mock.module("@/lib/autopilot/repository-agent", () => ({
    runRepositoryAgent: async (params: {
      tag: string;
      checkFile?: (file: {
        path: string;
        content: string;
        previous: string | null;
      }) => string | null;
      issueIds: string[];
    }) => {
      if (params.tag === "landing-agent") {
        return landingAgent(params);
      }
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
    gscSiteUrl: "sc-domain:emberline.dev",
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
  const platform = "Which serverless GPU platform should I use?";
  const answers = [
    // The homepage was cited a month ago and isn't now.
    { prompt: platform, daysAgo: 50, sources: [`${SITE}/`] },
    { prompt: platform, daysAgo: 44, sources: [SITE] },
    { prompt: platform, daysAgo: 5, sources: ["https://modal.com"] },
    { prompt: platform, daysAgo: 3, sources: ["https://modal.com"] },
    { prompt: platform, daysAgo: 1, sources: ["https://modal.com/pricing"] },
    { prompt: autoscale, daysAgo: 50, sources: [POST] },
    { prompt: autoscale, daysAgo: 45, sources: [`${POST}/`] },
    { prompt: autoscale, daysAgo: 40, sources: ["https://modal.com/docs"] },
    { prompt: autoscale, daysAgo: 6, sources: ["https://modal.com/docs/cold"] },
    { prompt: autoscale, daysAgo: 4, sources: ["https://modal.com/docs/cold"] },
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
    promptId:
      { [autoscale]: "autoscale", [platform]: "platform" }[row.prompt] ??
      "alternatives",
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
      links: false,
      landing: false,
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
    landingRefusals.length = 0;
    landingPages.length = 0;
    modelPrompts.length = 0;
    gsc.inspected.length = 0;
    web.homeStatus = 200;
  });

  const mergedPost = (values: {
    id: string;
    filePath: string;
    mergedDaysAgo: number;
    evidence?: Record<string, unknown>;
  }) =>
    db.insert(autopilotFindings).values({
      id: values.id,
      organizationId: ORG,
      kind: "keywords",
      fingerprint: `keywords:${values.id}`,
      title: `Blog post: ${values.id}`,
      summary: "Merged",
      status: "merged",
      repository: "emberline/site",
      pullRequestNumber: 40,
      mergedAt: new Date(now.getTime() - values.mergedDaysAgo * DAY),
      evidence: {
        filePath: values.filePath,
        target: { kind: "prompt", promptId: "platform", before: 0 },
        ...values.evidence,
      },
    });

  const readFinding = async (id: string) => {
    const row = await db.query.autopilotFindings.findFirst({
      where: eq(autopilotFindings.id, id),
    });
    if (!row) {
      throw new Error(`No finding ${id}`);
    }
    return row;
  };

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
    // A link that redirects within its site points at where it lands.
    expect(content).toContain(
      "See https://emberline.dev/docs/scaling/cold-starts for setup steps."
    );
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
    // A decimal figure is found in its sentence and rewritten, and the fact
    // check lists only what is left, so nothing holds the page for a person.
    expect(page).not.toContain("12.5%");
    expect(page).toContain("Teams that switch often cut their bill.");
    expect(opened[0]?.body).toContain("### Fact check");
    expect(opened[0]?.body).not.toContain("Figures no source contains");
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

  test("links: posts get links to pages ranking for their words", async () => {
    await enable({ links: true });
    expect((await run(AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.links)).status).toBe(
      "completed"
    );
    expect(opened).toHaveLength(1);
    const before = repository["content/blog/serving-models.md"] ?? "";
    const after = opened[0]?.files[0]?.contents ?? "";
    // The intro stays as is; one link per line; the rejected candidate is left out.
    expect(after).toContain(
      "Turn on [gpu autoscaling](/blog/gpu-autoscaling) so idle replicas cost nothing."
    );
    expect(after).toContain(
      "Cold starts aside, the [H100 hourly price](/pricing) dropped again last month."
    );
    expect(after.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")).toBe(before);

    // One links pull request waits for review at a time.
    await run(AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.links);
    expect(opened).toHaveLength(1);
  });

  test("landing: a homepage AI stopped citing gets a copy-only rewrite", async () => {
    await enable({ landing: true });
    expect((await run(AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.landing)).status).toBe(
      "completed"
    );
    // Layout, a line break after return and script contents are code; hidden
    // text isn't on the page. Only the copy rewrite passes.
    const [relayout, lineBreak, script, hidden, rewrite] = landingRefusals;
    for (const refusal of [relayout, lineBreak, script]) {
      expect(refusal).toContain("Only visible text may change");
    }
    expect(hidden).toContain("isn't on https://emberline.dev");
    expect(rewrite).toBeNull();
    expect(opened).toHaveLength(1);
    expect(opened[0]?.slug.startsWith("landing-")).toBe(true);
    expect(opened[0]?.files.map((file) => file.path)).toEqual(["app/page.tsx"]);
    const content = opened[0]?.files[0]?.contents ?? "";
    expect(content).toContain(
      '<Hero title="Serverless GPUs for open models" />'
    );
    expect(content).toContain('className="mx-auto max-w-5xl"');
    expect(opened[0]?.body).toContain(
      "| `app/page.tsx` | Deploy models fast | Serverless GPUs for open models |"
    );
    expect(opened[0]?.body).toContain(platform);
    const finding = await db.query.autopilotFindings.findFirst({
      where: eq(autopilotFindings.kind, "landing"),
    });
    expect(finding?.evidence.landing?.changes).toHaveLength(4);
    expect(finding?.evidence.target).toEqual({
      kind: "citations",
      url: SITE,
      promptIds: ["platform"],
      before: 0,
    });

    // One landing update waits for review at a time.
    await run(AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.landing);
    expect(opened).toHaveLength(1);
  });

  test("landing: with the homepage settled, a page ranking 4 to 20 in Google is next", async () => {
    await enable({ landing: true });
    await db.insert(autopilotFindings).values({
      id: "settled-home",
      organizationId: ORG,
      kind: "landing",
      fingerprint: "landing:emberline.dev",
      title: "Update the copy of emberline.dev",
      summary: "Dismissed",
      status: "dismissed",
    });
    expect((await run(AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.landing)).status).toBe(
      "completed"
    );
    expect(landingPages).toEqual([`${SITE}/pricing`]);
    const [offPage, shared, metadata, ownTitle] = landingRefusals;
    expect(offPage).toContain("isn't on");
    expect(shared).toContain("also shows on the homepage");
    expect(metadata).toContain(
      "isn't in https://emberline.dev/pricing's own route"
    );
    expect(ownTitle).toBeNull();
    expect(opened).toHaveLength(0);
    const finding = await db.query.autopilotFindings.findFirst({
      where: eq(autopilotFindings.fingerprint, "landing:emberline.dev/pricing"),
    });
    // The copy lives in a CMS: settled without a pull request, with the reason.
    expect(finding?.status).toBe("dismissed");
    expect(finding?.errorMessage).toBe("The plans come from a CMS");
    expect(finding?.evidence.landing?.signal).toBe("search");
    expect(finding?.evidence.target).toEqual({
      kind: "search",
      query: "h100 hourly price",
      before: 6,
    });
  });

  test("daily run: every enabled template acts once, and a bot wall reaches the brief", async () => {
    await enable({
      refresh: true,
      comparisons: true,
      rendering: true,
      links: true,
      landing: true,
    });
    web.homeStatus = 403;
    const result = await run(AUTOPILOT_DAILY_WORKFLOW.key);
    expect(result.status).toBe("completed");
    expect(opened.map((pull) => pull.slug.split("-")[0]).sort()).toEqual([
      "blog",
      "landing",
      "links",
      "refresh",
      "rendering",
    ]);
    expect(result.row?.summary?.insights?.join(" ")).toContain(
      "AI crawlers get 403"
    );
  });

  test("refresh: an Autopilot post that did not win its prompt gets one more try", async () => {
    await enable({ refresh: true });
    // The guide that lost citations was handled already.
    await db.insert(autopilotFindings).values({
      id: "settled-guide",
      organizationId: ORG,
      kind: "refresh",
      fingerprint: "refresh:emberline.dev/blog/gpu-autoscaling",
      title: "Refresh the guide",
      summary: "Dismissed",
      status: "dismissed",
    });
    // Merged before pages were followed: its URL comes from the sitemap.
    await db
      .insert(brandSitemapPages)
      .values({
        id: "sandbox-serving",
        sitemapId: "sandbox-sitemap",
        url: `${SITE}/blog/serving-models`,
        path: "/blog/serving-models",
        category: "crawled",
      })
      .onConflictDoNothing();
    await mergedPost({
      id: "platform-post",
      filePath: "content/blog/serving-models.md",
      mergedDaysAgo: 60,
    });
    // Too young for the scans to tell.
    await mergedPost({
      id: "young-post",
      filePath: "content/blog/hello.md",
      mergedDaysAgo: 20,
      evidence: {
        live: { url: `${SITE}/blog/hello`, at: now.toISOString() },
      },
    });
    expect((await run(AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.refresh)).status).toBe(
      "completed"
    );
    expect(opened).toHaveLength(1);
    expect(opened[0]?.files[0]?.path).toBe("content/blog/serving-models.md");
    expect(opened[0]?.files[0]?.contents).toContain(
      "## Which serverless GPU platform to use"
    );
    const prompt =
      modelPrompts.find((call) => call.tag === "refresh")?.prompt ?? "";
    expect(prompt).toContain("Written 60 days ago to win the AI answer");
    expect(prompt).toContain("https://modal.com");
    expect(opened[0]?.body).toContain(
      "Autopilot wrote this post 60 days ago to win the AI answer below"
    );
    expect(opened[0]?.body).toContain("**Prompt it was written for**");
    const refresh = await db.query.autopilotFindings.findFirst({
      where: eq(autopilotFindings.kind, "refresh"),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
    expect((await readFinding("platform-post")).evidence.live?.url).toBe(
      `${SITE}/blog/serving-models`
    );
    expect(refresh?.evidence.underperforming).toEqual({
      findingId: "platform-post",
      mergedDaysAgo: 60,
    });
    expect(refresh?.evidence.target).toEqual({
      kind: "prompt",
      promptId: "platform",
      before: 0,
    });

    // One more try, never a second: closed, it stays closed.
    await db
      .update(autopilotFindings)
      .set({ status: "dismissed", dismissedAt: now })
      .where(eq(autopilotFindings.id, refresh?.id ?? ""));
    await run(AUTOPILOT_TEMPLATE_WORKFLOW_KEYS.refresh);
    expect(opened).toHaveLength(1);
  });

  test("published pages: followed until Google indexed them, and the brief hears what is stuck", async () => {
    await enable({});
    const { buildAutopilotRunContext } =
      await import("../src/lib/autopilot/run");
    const { followPublishedPages } = await import("../src/lib/autopilot/live");
    await db
      .insert(brandSitemapPages)
      .values({
        id: "sandbox-serving",
        sitemapId: "sandbox-sitemap",
        url: `${SITE}/blog/serving-models`,
        path: "/blog/serving-models",
        category: "crawled",
      })
      .onConflictDoNothing();
    await mergedPost({
      id: "serving-post",
      filePath: "content/blog/serving-models.md",
      mergedDaysAgo: 4,
    });
    await mergedPost({
      id: "missing-post",
      filePath: "content/blog/never-deployed.md",
      mergedDaysAgo: 4,
    });
    const runs = ["follow-1", "follow-2", "follow-3", "follow-4", "follow-5"];
    await db.insert(autopilotRuns).values(
      runs.map((id) => ({
        id,
        organizationId: ORG,
        trigger: "manual" as const,
        status: "completed" as const,
      }))
    );
    const base = await buildAutopilotRunContext(ORG, "follow-1");
    const inRun = (index: number) => ({ ...base, runId: runs[index] ?? "" });

    const first = await followPublishedPages(inRun(0), now);
    expect((await readFinding("serving-post")).evidence.live?.url).toBe(
      `${SITE}/blog/serving-models`
    );
    expect(gsc.inspected).toEqual([`${SITE}/blog/serving-models`]);
    expect((await readFinding("serving-post")).evidence.indexing).toMatchObject(
      { verdict: "NEUTRAL" }
    );
    // Not live after the grace period: named once, never again.
    expect(first).toEqual([
      `"missing-post" was merged 4 days ago but its page isn't in the sitemap of emberline.dev yet.`,
    ]);
    // A retry of the same run says it again instead of losing it.
    expect(await followPublishedPages(inRun(0), now)).toEqual(first);
    expect(gsc.inspected).toHaveLength(1);
    const later = new Date(now.getTime() + 15 * DAY);
    const second = await followPublishedPages(inRun(1), later);
    expect(second.join(" ")).not.toContain("missing-post");
    expect(second).toEqual([
      `Google hasn't indexed "serving-post" 15 days after it went live (Discovered - currently not indexed). Link to it from a page Google already ranks or request indexing in Search Console.`,
    ]);
    // Checked again only after the interval, and the late note is said once.
    expect(await followPublishedPages(inRun(2), later)).toEqual([]);
    expect(gsc.inspected).toHaveLength(2);

    gsc.inspection = {
      verdict: "PASS",
      coverageState: "Submitted and indexed",
      lastCrawlAt: null,
    };
    const indexedAt = new Date(later.getTime() + 3 * DAY);
    expect(await followPublishedPages(inRun(3), indexedAt)).toEqual([
      `Google indexed "serving-post" (${SITE}/blog/serving-models).`,
    ]);
    // Indexed pages are done.
    await followPublishedPages(
      inRun(4),
      new Date(indexedAt.getTime() + 3 * DAY)
    );
    expect(gsc.inspected).toHaveLength(3);
  });
}
