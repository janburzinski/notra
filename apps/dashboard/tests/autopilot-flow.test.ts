import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { GitHubMentionContext } from "@notra/ai/types/github-mention";
import {
  autopilotFindings,
  autopilotRuns,
  autopilotSettings,
  members,
  organizations,
  slackIntegrations,
  users,
} from "@notra/db/schema";
import { eq } from "drizzle-orm";

import { createAutopilotSandbox } from "./utils/autopilot-sandbox";

if (process.env.NOTRA_AUTOPILOT_FLOW_TEST !== "1") {
  test("Autopilot sandbox: webhook → writer → PR → Slack, retries and credits", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_AUTOPILOT_FLOW_TEST: "1",
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
  const state = {
    flag: true,
    credits: true,
    confidence: 0.99,
    billingCrash: false,
    crash: false,
    disableWhileWriting: false,
    disableSettingsWhileWriting: false,
    linkedReaction: false,
    takeover: false,
    sourceClosed: false,
    cancelDuringWriting: false,
    slackFailure: false,
    renderHero: false,
    publicAssets: false,
    imageCollision: false,
    fallbackImageCollision: false,
    reviewersRefused: false,
  };
  const comments: string[] = [];
  const deliveries: string[] = [];
  const slackMessages: string[] = [];
  const opened: string[] = [];
  const writtenFiles: { path: string; contents?: string }[][] = [];
  const closed: number[] = [];
  const reviewers: string[][] = [];
  const charges: unknown[] = [];
  const holds: string[] = [];
  const release = mock(async () => undefined);
  const githubRequest = async (
    route: string,
    params?: Record<string, unknown>
  ) => {
    if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}") {
      return {
        data: {
          state: state.sourceClosed ? "closed" : "open",
          merged_at: null,
        },
      };
    }
    if (
      route === "PATCH /repos/{owner}/{repo}/pulls/{pull_number}" &&
      params?.state === "closed"
    ) {
      closed.push(Number(params.pull_number));
    }
    return { data: [{ content: "-1", user: { id: 42, type: "User" } }] };
  };

  mock.module("@notra/ai/utils/github-mention-auth", () => ({
    listOrganizationsForGitHubInstallation: async () => [
      { organizationId: "sandbox-org" },
    ],
    findGitHubIntegrationForMention: async () => ({
      id: "fixture-integration",
    }),
    resolveGitHubMentionAuth: async () =>
      state.linkedReaction ? { userId: "sandbox-user" } : null,
  }));
  mock.module("@/lib/autopilot/flag", () => ({
    isAutopilotEnabledForOrganization: async () => state.flag,
  }));
  mock.module("@/workflows/runtime", () => ({}));
  mock.module("@/lib/geo/configure", () => ({ geoCoreDashboardLayer: {} }));
  mock.module("@notra/ai/evaluation/client", () => ({
    getEvaluationClient: () => ({
      tryEvaluate: async () => ({
        answers: {
          intent: { choice: "write", probabilities: { write: 0.99 } },
          pick: {
            choice: "option_0",
            probabilities: {
              option_0: state.confidence,
              none: 1 - state.confidence,
            },
          },
        },
        confidence: { pick: state.confidence },
      }),
    }),
  }));
  mock.module("@notra/ai/billing/github-mention-billing", () => ({
    describeGitHubMentionBillingDenial: () => "No credits left",
    reserveGitHubMentionBilling: async (input: { mentionKey: string }) => {
      holds.push(input.mentionKey);
      if (state.billingCrash) {
        throw new Error("Credit service unavailable");
      }
      return { allowed: state.credits, lockId: input.mentionKey };
    },
    confirmGitHubMentionBilling: async (input: unknown) => {
      charges.push(input);
    },
    releaseGitHubMentionBilling: release,
    createGitHubMentionUsageCollector: () => {
      let usage: unknown = null;
      return {
        add: (next: unknown) => {
          usage = next;
        },
        get: () => usage,
      };
    },
  }));
  mock.module("@notra/ai/utils/github-pr-comments", () => ({
    addGitHubCommentReaction: async () => undefined,
    postGitHubIssueComment: async (input: { body: string }) => {
      comments.push(input.body);
      return {
        id: comments.length,
        htmlUrl: "https://github.com/sandbox/app/pull/1#comment",
      };
    },
  }));
  mock.module("@notra/ai/integrations/github-publish-auth", () => ({
    getGitHubPublishToken: async () => "sandbox-token",
  }));
  const octokitModule = await import("@notra/ai/utils/octokit");
  mock.module("@notra/ai/utils/octokit", () => ({
    ...octokitModule,
    createOctokit: () => ({ request: githubRequest }),
  }));
  mock.module("@notra/ai/utils/github-mention-rate-limit", () => ({
    consumeGitHubMentionRateLimit: async () => ({ allowed: true }),
  }));
  mock.module("@/lib/autopilot/writer", () => ({
    writeBlogPost: async (input: { onUsage?: (usage: unknown) => void }) => {
      if (state.cancelDuringWriting) {
        state.sourceClosed = true;
        await handleAutopilotPullRequestEvent(
          JSON.stringify({
            ...JSON.parse(event()),
            action: "closed",
            pull_request: {
              ...JSON.parse(event()).pull_request,
              merged: false,
            },
          })
        );
      }
      if (state.disableWhileWriting) {
        state.flag = false;
      }
      if (state.disableSettingsWhileWriting) {
        await db
          .update(autopilotSettings)
          .set({ enabled: false })
          .where(eq(autopilotSettings.organizationId, "sandbox-org"));
      }
      if (state.crash) {
        throw new Error("Sandbox writer stopped");
      }
      input.onUsage?.({
        modelId: "sandbox",
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      });
      return {
        title: "Sandbox exports",
        slug: "sandbox-exports",
        extension: "md",
        content: "---\ntitle: Sandbox exports\n---\nA sandbox announcement.",
        pullRequestBody: "Explains the sandbox change.",
      };
    },
  }));
  mock.module("@/lib/autopilot/hero-image", () => ({
    renderPostHeroImage: async () => {
      if (state.renderHero) {
        return "c2FuZGJveA==";
      }
      throw new Error("No external image service in the sandbox");
    },
  }));
  mock.module("@/lib/autopilot/github", () => ({
    getRepositoryOctokit: async () => ({ request: githubRequest }),
    getInstallationOctokit: async () => ({ request: githubRequest }),
    getBaseBranchSha: async () => "base-sha",
    listRepositoryPaths: async () =>
      state.publicAssets ? ["public/favicon.ico"] : [],
    readRepositoryFile: async () => null,
    repositoryPathExists: async (
      _octokit: unknown,
      _repo: unknown,
      path: string
    ) =>
      path.endsWith("/sandbox-exports.png")
        ? state.imageCollision
        : path.endsWith(".png") && state.fallbackImageCollision,
    openAutopilotPullRequest: async (input: {
      slug: string;
      files: { path: string; contents?: string }[];
    }) => {
      expect(input.files[0]?.path).toStartWith("content/blog/");
      opened.push(input.slug);
      writtenFiles.push(input.files);
      if (state.takeover) {
        const finding = await db.query.autopilotFindings.findFirst();
        if (!finding?.runId) {
          throw new Error("Expected the original writer's claim");
        }
        await db
          .update(autopilotFindings)
          .set({ claimedAt: new Date(0) })
          .where(eq(autopilotFindings.id, finding.id));
        const replacement = await claimFinding("sandbox-org", finding.runId, {
          kind: finding.kind,
          fingerprint: finding.fingerprint,
          title: finding.title,
          summary: finding.summary,
          evidence: finding.evidence,
        });
        if (!replacement) {
          throw new Error("Expected a takeover");
        }
        await markFindingProposed(replacement, {
          repository: "sandbox/website",
          number: 99,
          url: "https://github.com/sandbox/website/pull/99",
          branch: autopilotDraftBranchSlug("blog", replacement),
          headSha: "replacement-sha",
        });
      }
      return {
        number: opened.length,
        url: `https://github.com/sandbox/website/pull/${opened.length}`,
        branch: `notra/autopilot/${input.slug}`,
        headSha: "head-sha",
      };
    },
    closeAutopilotPullRequest: async (
      _octokit: unknown,
      _repo: unknown,
      pull: { number: number }
    ) => {
      closed.push(pull.number);
    },
    requestAutopilotReviewers: async (
      _octokit: unknown,
      _repo: unknown,
      _pullNumber: number,
      logins: string[]
    ) => {
      if (state.reviewersRefused) {
        throw new Error("Reviews may only be requested from collaborators");
      }
      reviewers.push(logins);
    },
  }));
  mock.module("@/lib/integrations/github/content-pull-request", () => ({
    isMergeMethodNotAllowed: () => false,
    getContentPullRequestState: async () => ({ status: "open" }),
    markContentPullRequestReady: async () => undefined,
    mergeContentPullRequest: async () => undefined,
  }));
  mock.module("@/lib/autopilot/slack", () => ({
    postAutopilotSlackMessage: (input: {
      clientMessageId?: string;
      destination?: { channelId: string };
    }) => {
      if (state.slackFailure) {
        throw new Error("Fixture Slack unavailable");
      }
      expect(input.destination?.channelId).toBe("C_SANDBOX");
      expect(input.clientMessageId).toMatch(/^[0-9a-f-]{36}$/);
      deliveries.push(input.clientMessageId ?? "missing");
      slackMessages.push(JSON.stringify(input));
      return Promise.resolve({
        ts: "1234567890.000001",
        channel: "C_SANDBOX",
        teamId: "T_SANDBOX",
      });
    },
  }));
  const { handleAutopilotPullRequestEvent } =
    await import("../src/lib/autopilot/pull-request-events");
  const { handleAutopilotMention } =
    await import("../src/lib/autopilot/mentions");
  const { buildAutopilotRunContext, deliverAutopilotBrief, runAutopilotJob } =
    await import("../src/lib/autopilot/run");
  const {
    dismissThumbsDownOffers,
    claimFinding,
    markFindingProposed,
    dismissFinding,
  } = await import("../src/lib/autopilot/findings");
  const { writeSuggestedPost } =
    await import("../src/lib/autopilot/suggestions");
  const { autopilotSuggestionWorkflow } =
    await import("../src/workflows/autopilot-suggestion");
  const { autopilotDraftBranchSlug } =
    await import("../src/utils/autopilot-branches");
  const now = new Date();
  await db.insert(organizations).values({
    id: "sandbox-org",
    name: "Autopilot sandbox",
    slug: "autopilot-sandbox",
    createdAt: now,
  });
  await db.insert(users).values({
    id: "sandbox-user",
    name: "Sandbox",
    email: "autopilot@example.invalid",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(members).values({
    id: "sandbox-owner",
    organizationId: "sandbox-org",
    userId: "sandbox-user",
    role: "owner",
    createdAt: now,
  });
  await db.insert(slackIntegrations).values({
    id: "sandbox-slack",
    organizationId: "sandbox-org",
    createdByUserId: "sandbox-user",
    displayName: "Sandbox",
    encryptedBotToken: "not-a-real-token",
    slackTeamId: "T_SANDBOX",
  });
  await db.insert(autopilotSettings).values({
    organizationId: "sandbox-org",
    enabled: true,
    repositoryOwner: "sandbox",
    repositoryName: "website",
    repositoryBranch: "main",
    slackIntegrationId: "sandbox-slack",
    slackChannelId: "C_SANDBOX",
  });
  afterAll(() => sandbox.postgres.close());
  beforeEach(async () => {
    state.flag = true;
    state.credits = true;
    state.confidence = 0.99;
    state.billingCrash = false;
    state.crash = false;
    state.disableWhileWriting = false;
    state.disableSettingsWhileWriting = false;
    holds.length = 0;
    state.linkedReaction = false;
    state.takeover = false;
    state.sourceClosed = false;
    state.cancelDuringWriting = false;
    state.slackFailure = false;
    state.renderHero = false;
    state.publicAssets = false;
    state.imageCollision = false;
    state.fallbackImageCollision = false;
    state.reviewersRefused = false;
    reviewers.length = 0;
    writtenFiles.length = 0;
    comments.length = 0;
    deliveries.length = 0;
    slackMessages.length = 0;
    opened.length = 0;
    closed.length = 0;
    charges.length = 0;
    release.mockClear();
    await sandbox.postgres.exec('TRUNCATE "autopilot_runs" CASCADE');
    await db
      .update(autopilotSettings)
      .set({ maxOpenPullRequests: 3, enabled: true })
      .where(eq(autopilotSettings.organizationId, "sandbox-org"));
  });
  const event = (number = 1, association = "MEMBER") =>
    JSON.stringify({
      action: "opened",
      installation: { id: 1 },
      repository: {
        id: 2,
        name: "app",
        full_name: "sandbox/app",
        owner: { login: "sandbox" },
        private: false,
      },
      pull_request: {
        number,
        title: "feat: add exports",
        body: "A sandbox feature",
        html_url: `https://github.com/sandbox/app/pull/${number}`,
        draft: false,
        head: { ref: "feature" },
        user: { type: "User", login: "sandbox-dev" },
        author_association: association,
      },
    });

  const mentionContext = (commentId: number): GitHubMentionContext => ({
    deliveryId: `mention-${commentId}`,
    installationId: "1",
    organizationId: "sandbox-org",
    userId: "sandbox-user",
    integrationId: "fixture-integration",
    owner: "sandbox",
    repo: "app",
    defaultBranch: "main",
    issueNumber: 1,
    comment: {
      id: commentId,
      body: "@notra write a post",
      htmlUrl: `https://github.com/sandbox/app/pull/1#issuecomment-${commentId}`,
      review: null,
    },
    sender: { id: 42, login: "sandbox-user", type: "User" },
    pullRequest: {
      number: 1,
      title: "feat: add exports",
      body: "Sandbox exports",
      htmlUrl: "https://github.com/sandbox/app/pull/1",
      headRef: "feature",
      headSha: "source-head",
      headRepoFullName: "sandbox/app",
      baseRef: "main",
      draft: false,
      authorLogin: "sandbox-dev",
    },
    destination: {
      mode: "reply_only",
      pullRequestNumber: null,
      headRef: null,
      headSha: null,
    },
    publication: null,
  });

  test("a failed automatic credit check releases its claim for an immediate event retry", async () => {
    state.billingCrash = true;
    await handleAutopilotPullRequestEvent(event());
    const finding = await db.query.autopilotFindings.findFirst();
    expect(finding?.status).toBe("failed");
    expect(finding?.claimToken).toBeNull();
    expect(finding?.evidence.failures ?? 0).toBe(0);
    expect((await db.query.autopilotRuns.findFirst())?.status).toBe("failed");
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
    expect(release).not.toHaveBeenCalled();
    const firstHold = holds.at(-1);
    state.billingCrash = false;
    await handleAutopilotPullRequestEvent(event());
    expect(opened).toHaveLength(1);
    expect(charges).toHaveLength(1);
    expect(holds.at(-1)).not.toBe(firstHold);
  });

  test("failed event retries preserve counted failures and stop at the limit", async () => {
    state.crash = true;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await handleAutopilotPullRequestEvent(event());
      expect(
        (await db.query.autopilotFindings.findFirst())?.evidence.failures
      ).toBe(attempt);
    }
    const reservations = holds.length;
    await handleAutopilotPullRequestEvent(event());
    expect(holds).toHaveLength(reservations);
    expect(reservations).toBe(3);
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
  });

  test("concurrent events for one source PR hold and settle only the winning claim", async () => {
    await Promise.all([
      handleAutopilotPullRequestEvent(event()),
      handleAutopilotPullRequestEvent(event()),
    ]);
    expect(opened).toHaveLength(1);
    expect(charges).toHaveLength(1);
    expect(holds).toHaveLength(1);
    expect(holds[0]).toStartWith("autopilot-draft:");
    expect(release).not.toHaveBeenCalled();
  });

  test("drafts ask the source author for review, and a refusal keeps the draft", async () => {
    expect((await handleAutopilotMention(mentionContext(1)))?.status).toBe(
      "replied"
    );
    await handleAutopilotPullRequestEvent(event(2));
    expect(reviewers).toEqual([["sandbox-dev"], ["sandbox-dev"]]);
    state.reviewersRefused = true;
    await handleAutopilotPullRequestEvent(event(3));
    expect(opened).toHaveLength(3);
    const findings = await db.query.autopilotFindings.findMany({
      columns: { status: true },
    });
    expect(findings.map((finding) => finding.status)).toEqual([
      "proposed",
      "proposed",
      "proposed",
    ]);
  });

  test("event thresholds still offer at 85 percent and write only from 95 percent", async () => {
    for (const confidence of [0.85, 0.94]) {
      state.confidence = confidence;
      await handleAutopilotPullRequestEvent(
        event(Math.round(confidence * 100))
      );
      expect(comments.at(-1)).toContain("Should I write a post");
      expect(opened).toHaveLength(0);
      expect(holds).toHaveLength(0);
    }
    state.confidence = 0.95;
    await handleAutopilotPullRequestEvent(event(95));
    expect(opened).toHaveLength(1);
    expect(charges).toHaveLength(1);
    expect(holds).toHaveLength(1);
    expect(comments.at(-1)).toContain("I drafted a post");
  });

  test("new and existing mention replies never disclose the private output repository", async () => {
    expect((await handleAutopilotMention(mentionContext(1)))?.status).toBe(
      "replied"
    );
    expect(opened).toHaveLength(1);
    expect(charges).toHaveLength(1);
    for (const status of ["proposed", "merged"] as const) {
      await db
        .update(autopilotFindings)
        .set({ status })
        .where(eq(autopilotFindings.organizationId, "sandbox-org"));
      expect(
        (
          await handleAutopilotMention(
            mentionContext(status === "proposed" ? 2 : 3)
          )
        )?.status
      ).toBe("replied");
    }
    expect(comments).toHaveLength(3);
    for (const comment of comments) {
      expect(comment).not.toContain("sandbox/website");
      expect(comment).not.toContain("https://github.com/sandbox/website");
      expect(comment).toContain("Notra Autopilot");
    }
    expect(opened).toHaveLength(1);
  });

  test("webhook admission rejects draft, bot, stranger and irrelevant events before enqueue", async () => {
    const { autopilotPullRequestEventSchema } =
      await import("../src/schemas/autopilot-github");
    const { autopilotPullRequestMoment } =
      await import("../src/utils/autopilot-github");
    const input = autopilotPullRequestEventSchema.parse(JSON.parse(event()));
    expect(autopilotPullRequestMoment(input)).toBe("ready");
    expect(
      autopilotPullRequestMoment({ ...input, action: "synchronize" })
    ).toBeNull();
    expect(
      autopilotPullRequestMoment({
        ...input,
        pull_request: { ...input.pull_request, draft: true },
      })
    ).toBeNull();
    expect(
      autopilotPullRequestMoment({
        ...input,
        pull_request: { ...input.pull_request, user: { type: "Bot" } },
      })
    ).toBeNull();
    expect(
      autopilotPullRequestMoment({
        ...input,
        pull_request: { ...input.pull_request, author_association: "NONE" },
      })
    ).toBeNull();
    expect(
      autopilotPullRequestMoment({
        ...input,
        pull_request: { ...input.pull_request, head: { ref: "notra/blog" } },
      })
    ).toBeNull();
    expect(
      autopilotPullRequestMoment({
        ...input,
        action: "closed",
        pull_request: { ...input.pull_request, merged: true },
      })
    ).toBe("merged");
    expect(
      autopilotPullRequestMoment({
        ...input,
        action: "closed",
        pull_request: { ...input.pull_request, merged: false },
      })
    ).toBe("closed");
  });

  for (const publicAssets of [true, false]) {
    test(`hero collisions use a fresh image and matching frontmatter with public assets: ${publicAssets}`, async () => {
      state.renderHero = true;
      state.publicAssets = publicAssets;
      state.imageCollision = true;
      await handleAutopilotPullRequestEvent(event());
      const finding = await db.query.autopilotFindings.findFirst();
      const slug = `sandbox-exports-${finding?.id}`;
      const imagePath = publicAssets
        ? `public/images/blog/${slug}.png`
        : `content/blog/${slug}.png`;
      const imageUrl = publicAssets
        ? `/images/blog/${slug}.png`
        : `./${slug}.png`;
      expect(writtenFiles[0]?.[1]?.path).toBe(imagePath);
      expect(writtenFiles[0]?.[0]?.contents).toContain(imageUrl);
      expect(writtenFiles[0]?.[0]?.path).toBe(
        "content/blog/sandbox-exports.md"
      );
      expect(charges).toHaveLength(1);
    });
  }

  test("an occupied fallback image cannot be overwritten or charged", async () => {
    state.renderHero = true;
    state.imageCollision = true;
    state.fallbackImageCollision = true;
    await handleAutopilotPullRequestEvent(event());
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
  });

  test("a replay produces one draft, one comment and one usage confirmation", async () => {
    await handleAutopilotPullRequestEvent(event());
    await handleAutopilotPullRequestEvent(event());
    expect(opened).toHaveLength(1);
    expect(comments).toHaveLength(1);
    expect(charges).toHaveLength(1);
    expect(comments[0]).not.toContain("sandbox/website");
    const finding = await db.query.autopilotFindings.findFirst();
    expect(finding?.status).toBe("proposed");
    expect((await db.query.autopilotRuns.findFirst())?.status).toBe(
      "completed"
    );
  });

  test("concurrent automatic writers reserve one slot while an explicit write can bypass the cap", async () => {
    await db
      .update(autopilotSettings)
      .set({ maxOpenPullRequests: 1 })
      .where(eq(autopilotSettings.organizationId, "sandbox-org"));
    await Promise.all([
      handleAutopilotPullRequestEvent(event(1)),
      handleAutopilotPullRequestEvent(event(2)),
    ]);
    expect(opened).toHaveLength(1);
    expect(charges).toHaveLength(1);
    const findings = await db.query.autopilotFindings.findMany();
    expect(
      findings.filter((finding) => finding.status === "proposed")
    ).toHaveLength(1);
    const idea = findings.find((finding) => finding.status === "suggested");
    if (!idea) {
      throw new Error("Expected the capped writer to leave an idea");
    }
    await autopilotSuggestionWorkflow({
      organizationId: "sandbox-org",
      findingId: idea.id,
    });
    expect(opened).toHaveLength(2);
    expect(charges).toHaveLength(2);
  });

  for (const duringWriting of [true, false]) {
    test(`a canceled source ${duringWriting ? "during writing" : "before the claim"} leaves no post or charge`, async () => {
      state.cancelDuringWriting = duringWriting;
      state.sourceClosed = !duringWriting;
      await handleAutopilotPullRequestEvent(event());
      expect(opened).toHaveLength(0);
      expect(charges).toHaveLength(0);
      expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
        "dismissed"
      );
      expect(release).toHaveBeenCalledTimes(1);
    });
  }

  test("dismissal reloads a draft recorded while it was reading the open claim", async () => {
    await db.insert(autopilotRuns).values({
      id: "cancel-run",
      organizationId: "sandbox-org",
      trigger: "github",
    });
    const claim = await claimFinding("sandbox-org", "cancel-run", {
      kind: "commits",
      fingerprint: "commits:sandbox/app#33",
      title: "Race",
      summary: "Race",
      evidence: {},
    });
    if (!claim) {
      throw new Error("Expected a claim");
    }
    const [dismissed, recorded] = await Promise.all([
      dismissFinding("sandbox-org", claim.finding.id),
      markFindingProposed(claim, {
        repository: "sandbox/website",
        number: 33,
        url: "https://github.com/sandbox/website/pull/33",
        branch: "notra/autopilot/race",
        headSha: "race-head",
      }),
    ]);
    expect(recorded).toBe(true);
    expect(dismissed.status).toBe("dismissed");
    expect(closed).toContain(33);
  });

  test("the daily brief includes item drafts and ideas once per state, not only its own results", async () => {
    await handleAutopilotPullRequestEvent(event(1));
    state.credits = false;
    await handleAutopilotPullRequestEvent(event(2));
    const findings = await db.query.autopilotFindings.findMany();
    const idea = findings.find((finding) => finding.status === "suggested");
    if (!idea) {
      throw new Error("Expected an idea");
    }
    const daily = async (id: string) => {
      await db
        .insert(autopilotRuns)
        .values({ id, organizationId: "sandbox-org", trigger: "manual" });
      const ctx = await buildAutopilotRunContext("sandbox-org", id);
      return deliverAutopilotBrief({ ctx, results: [], previousRunAt: null });
    };
    await db
      .update(autopilotSettings)
      .set({ slackChannelId: null })
      .where(eq(autopilotSettings.organizationId, "sandbox-org"));
    expect(await daily("brief-off")).toBeNull();
    expect(
      (await db.query.autopilotFindings.findFirst())?.evidence.briefed ?? []
    ).toHaveLength(0);
    await db
      .update(autopilotRuns)
      .set({ status: "completed" })
      .where(eq(autopilotRuns.id, "brief-off"));
    await db
      .update(autopilotSettings)
      .set({ slackChannelId: "C_SANDBOX" })
      .where(eq(autopilotSettings.organizationId, "sandbox-org"));
    expect(await daily("brief-one")).not.toBeNull();
    expect(slackMessages[0]).toContain("Review idea");
    expect(slackMessages[0]).toContain("Merge");
    for (const finding of await db.query.autopilotFindings.findMany()) {
      if (finding.status !== "suggested" && finding.status !== "proposed") {
        throw new Error("Expected an announced state");
      }
      expect(finding.evidence.briefed).toEqual([finding.status]);
    }
    await db
      .update(autopilotRuns)
      .set({ status: "completed" })
      .where(eq(autopilotRuns.id, "brief-one"));
    expect(await daily("brief-two")).toBeNull();
    expect(deliveries).toHaveLength(1);
    await db
      .update(autopilotRuns)
      .set({ status: "completed" })
      .where(eq(autopilotRuns.id, "brief-two"));
    state.credits = true;
    await autopilotSuggestionWorkflow({
      organizationId: "sandbox-org",
      findingId: idea.id,
    });
    expect(await daily("brief-three")).not.toBeNull();
    expect(deliveries).toHaveLength(2);
    const written = await db.query.autopilotFindings.findFirst({
      where: eq(autopilotFindings.id, idea.id),
    });
    expect(written?.evidence.briefed).toEqual(["suggested", "proposed"]);
  });

  test("a stranger and an empty credit balance cannot open drafts", async () => {
    await handleAutopilotPullRequestEvent(event(1, "NONE"));
    expect(await db.query.autopilotFindings.findMany()).toHaveLength(0);
    state.credits = false;
    await handleAutopilotPullRequestEvent(event());
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
    const idea = await db.query.autopilotFindings.findFirst();
    expect(idea?.status).toBe("suggested");
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
    await expect(
      autopilotSuggestionWorkflow({
        organizationId: "sandbox-org",
        findingId: idea.id,
      })
    ).rejects.toThrow("No credits left");
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "suggested"
    );
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
    expect(release).not.toHaveBeenCalled();
  });

  test("two queued suggestion workflows produce only one draft and charge", async () => {
    state.credits = false;
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
    state.credits = true;
    const payload = { organizationId: "sandbox-org", findingId: idea.id };
    const results = await Promise.allSettled([
      autopilotSuggestionWorkflow(payload),
      autopilotSuggestionWorkflow(payload),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(opened).toHaveLength(1);
    expect(charges).toHaveLength(1);
    expect(release).not.toHaveBeenCalled();
  });

  test("a revoked flag is rechecked by the queued worker before credits or writes", async () => {
    state.credits = false;
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
    state.flag = false;
    state.credits = true;
    await expect(
      autopilotSuggestionWorkflow({
        organizationId: "sandbox-org",
        findingId: idea.id,
      })
    ).rejects.toThrow("not available");
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
    expect(release).not.toHaveBeenCalled();
  });

  test("revoking the flag during generation prevents a PR and releases credits", async () => {
    state.credits = false;
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
    state.credits = true;
    state.disableWhileWriting = true;
    await expect(
      autopilotSuggestionWorkflow({
        organizationId: "sandbox-org",
        findingId: idea.id,
      })
    ).rejects.toThrow("not available");
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
    expect(release).toHaveBeenCalledTimes(1);
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "suggested"
    );
  });

  test("a failed queued writer returns the idea and marks its run failed", async () => {
    state.credits = false;
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
    state.credits = true;
    state.billingCrash = true;
    await expect(
      autopilotSuggestionWorkflow({
        organizationId: "sandbox-org",
        findingId: idea.id,
      })
    ).rejects.toThrow("Credit service unavailable");
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "suggested"
    );
    expect(release).not.toHaveBeenCalled();
    state.billingCrash = false;
    state.crash = true;
    await expect(
      autopilotSuggestionWorkflow({
        organizationId: "sandbox-org",
        findingId: idea.id,
      })
    ).rejects.toThrow("Sandbox writer stopped");
    const runs = await db.query.autopilotRuns.findMany();
    expect(
      runs.find(
        (run) =>
          run.trigger === "suggestion" &&
          run.errorMessage === "Sandbox writer stopped"
      )
    ).toMatchObject({
      status: "failed",
      errorMessage: "Sandbox writer stopped",
    });
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "suggested"
    );
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test("turning off settings during generation prevents a PR and releases credits", async () => {
    state.credits = false;
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
    state.credits = true;
    state.disableSettingsWhileWriting = true;
    await expect(
      autopilotSuggestionWorkflow({
        organizationId: "sandbox-org",
        findingId: idea.id,
      })
    ).rejects.toThrow("turned off");
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test("paused workspaces reject a suggestion before claiming or reserving credits", async () => {
    state.credits = false;
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
    await db
      .update(autopilotSettings)
      .set({ enabled: false })
      .where(eq(autopilotSettings.organizationId, "sandbox-org"));
    const previousHolds = holds.length;
    const { loadSuggestedPost } =
      await import("../src/lib/autopilot/suggestions");
    await expect(loadSuggestedPost("sandbox-org", idea.id)).rejects.toThrow(
      "Turn on Autopilot"
    );
    await expect(
      autopilotSuggestionWorkflow({
        organizationId: "sandbox-org",
        findingId: idea.id,
      })
    ).rejects.toThrow("Turn on Autopilot");
    expect(holds).toHaveLength(previousHolds);
    expect(opened).toHaveLength(0);
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "suggested"
    );
  });

  for (const status of ["failed", "running"] as const) {
    test(`a ${status === "failed" ? "canceled" : "stale"} queued run cannot claim or spend when it eventually starts`, async () => {
      state.credits = false;
      await handleAutopilotPullRequestEvent(event());
      const idea = await db.query.autopilotFindings.findFirst();
      if (!idea) {
        throw new Error("Expected an idea");
      }
      await db.insert(autopilotRuns).values({
        id: "queued-gone",
        organizationId: "sandbox-org",
        trigger: "suggestion",
        status,
        heartbeatAt: new Date(0),
      });
      const previousHolds = holds.length;
      state.credits = true;
      await expect(
        autopilotSuggestionWorkflow({
          organizationId: "sandbox-org",
          findingId: idea.id,
          runId: "queued-gone",
        })
      ).rejects.toThrow("no longer active");
      expect(holds).toHaveLength(previousHolds);
      expect(opened).toHaveLength(0);
      expect(charges).toHaveLength(0);
      expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
        "suggested"
      );
    });
  }

  test("a retry after releasing a draft hold gets a fresh billing key", async () => {
    state.credits = false;
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
    state.credits = true;
    state.crash = true;
    const payload = { organizationId: "sandbox-org", findingId: idea.id };
    await expect(autopilotSuggestionWorkflow(payload)).rejects.toThrow(
      "Sandbox writer stopped"
    );
    const firstHold = holds.at(-1);
    expect(release).toHaveBeenCalledTimes(1);
    state.crash = false;
    await autopilotSuggestionWorkflow(payload);
    const nextHold = holds.at(-1);
    expect(firstHold).toStartWith(`autopilot-draft:${idea.id}:`);
    expect(nextHold).toStartWith(`autopilot-draft:${idea.id}:`);
    expect(nextHold).not.toBe(firstHold);
    expect(opened).toHaveLength(1);
    expect(charges).toHaveLength(1);
  });

  test("an unspent writer failure releases the credit hold and settles its run", async () => {
    state.crash = true;
    await handleAutopilotPullRequestEvent(event());
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
    expect(release).toHaveBeenCalledTimes(1);
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "failed"
    );
    expect((await db.query.autopilotRuns.findFirst())?.status).not.toBe(
      "running"
    );
  });

  test("an open release post does not block another topic, but the workspace cap still applies", async () => {
    await db
      .update(autopilotSettings)
      .set({ maxOpenPullRequests: 2 })
      .where(eq(autopilotSettings.organizationId, "sandbox-org"));
    await handleAutopilotPullRequestEvent(event(1));
    await handleAutopilotPullRequestEvent(event(2));
    await handleAutopilotPullRequestEvent(event(1));
    expect(opened).toHaveLength(2);
    expect(charges).toHaveLength(2);
    await handleAutopilotPullRequestEvent(event(3));
    expect(opened).toHaveLength(2);
    expect(charges).toHaveLength(2);
    const findings = await db.query.autopilotFindings.findMany();
    expect(findings.map((finding) => finding.status).sort()).toEqual([
      "proposed",
      "proposed",
      "suggested",
    ]);
  });

  for (const kind of ["commits", "keywords"] as const) {
    test(`the daily ${kind} job writes a waiting idea despite an existing PR of the same kind`, async () => {
      await handleAutopilotPullRequestEvent(event(1));
      state.credits = false;
      await handleAutopilotPullRequestEvent(event(2));
      const findings = await db.query.autopilotFindings.findMany();
      const idea = findings.find((finding) => finding.status === "suggested");
      if (!idea) {
        throw new Error("Expected a waiting idea");
      }
      await db
        .update(autopilotFindings)
        .set({ kind })
        .where(eq(autopilotFindings.organizationId, "sandbox-org"));
      await db
        .update(autopilotFindings)
        .set({ createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) })
        .where(eq(autopilotFindings.id, idea.id));
      state.credits = true;
      await db.insert(autopilotRuns).values({
        id: "daily",
        organizationId: "sandbox-org",
        trigger: "cron",
      });
      const ctx = await buildAutopilotRunContext("sandbox-org", "daily");
      state.billingCrash = true;
      await runAutopilotJob(ctx, kind);
      const waiting = await db.query.autopilotFindings.findFirst({
        where: eq(autopilotFindings.id, idea.id),
      });
      expect(waiting?.status).toBe("suggested");
      expect(waiting?.claimToken).toBeNull();
      expect(waiting?.evidence.failures ?? 0).toBe(0);
      expect(opened).toHaveLength(1);
      expect(charges).toHaveLength(1);
      state.billingCrash = false;
      await db
        .update(autopilotRuns)
        .set({ status: "completed" })
        .where(eq(autopilotRuns.id, "daily"));
      await db.insert(autopilotRuns).values({
        id: "daily-retry",
        organizationId: "sandbox-org",
        trigger: "cron",
      });
      const retryCtx = await buildAutopilotRunContext(
        "sandbox-org",
        "daily-retry"
      );
      const result = await runAutopilotJob(retryCtx, kind);
      expect(result.findingIds).toContain(idea.id);
      expect(opened).toHaveLength(2);
      expect(charges).toHaveLength(2);
      expect(
        (await db.query.autopilotFindings.findMany()).every(
          (finding) => finding.status === "proposed"
        )
      ).toBe(true);
    });
  }

  test("the open-draft cap falls back to suggesting, and strangers cannot veto it", async () => {
    await db
      .update(autopilotSettings)
      .set({ maxOpenPullRequests: 1 })
      .where(eq(autopilotSettings.organizationId, "sandbox-org"));
    await handleAutopilotPullRequestEvent(event(1));
    await handleAutopilotPullRequestEvent(event(2));
    expect(opened).toHaveLength(1);
    const findings = await db.query.autopilotFindings.findMany();
    expect(findings.map((finding) => finding.status).sort()).toEqual([
      "proposed",
      "suggested",
    ]);
    expect(await dismissThumbsDownOffers("sandbox-org", new Date(0))).toEqual(
      []
    );
    expect(closed).toHaveLength(0);
    state.linkedReaction = true;
    expect(
      await dismissThumbsDownOffers("sandbox-org", new Date(0))
    ).toHaveLength(1);
    expect(closed).toHaveLength(0);
  });

  test("a failed Slack send marks nothing and the same brief can retry", async () => {
    await handleAutopilotPullRequestEvent(event());
    await db.insert(autopilotRuns).values({
      id: "slack-retry",
      organizationId: "sandbox-org",
      trigger: "manual",
    });
    const ctx = await buildAutopilotRunContext("sandbox-org", "slack-retry");
    state.slackFailure = true;
    expect(
      await deliverAutopilotBrief({ ctx, results: [], previousRunAt: null })
    ).toBeNull();
    expect(
      (await db.query.autopilotFindings.findFirst())?.evidence.briefed ?? []
    ).toHaveLength(0);
    expect(
      (
        await db.query.autopilotRuns.findFirst({
          where: eq(autopilotRuns.id, ctx.runId),
        })
      )?.slackMessageTs
    ).toBeNull();
    state.slackFailure = false;
    expect(
      await deliverAutopilotBrief({ ctx, results: [], previousRunAt: null })
    ).not.toBeNull();
    expect(
      (await db.query.autopilotFindings.findFirst())?.evidence.briefed
    ).toEqual(["proposed"]);
    expect(deliveries).toHaveLength(1);
  });

  test("a daily brief records its delivery immediately and a replay does not post again", async () => {
    await handleAutopilotPullRequestEvent(event());
    const finding = await db.query.autopilotFindings.findFirst();
    if (!finding) {
      throw new Error("Expected a proposed draft");
    }
    await db
      .insert(autopilotRuns)
      .values({ id: "daily", organizationId: "sandbox-org", trigger: "cron" });
    const ctx = await buildAutopilotRunContext("sandbox-org", "daily");
    const input = {
      ctx,
      results: [{ findingIds: [finding.id], insights: [] }],
      previousRunAt: null,
    };
    expect(await deliverAutopilotBrief(input)).toBe("1234567890.000001");
    expect(await deliverAutopilotBrief(input)).toBe("1234567890.000001");
    expect(deliveries).toHaveLength(1);
    expect(
      (
        await db.query.autopilotRuns.findFirst({
          where: eq(autopilotRuns.id, "daily"),
        })
      )?.slackMessageTs
    ).toBe("1234567890.000001");
  });

  test("an expired writer can be recovered and restarted through the actual suggestion flow", async () => {
    state.crash = true;
    await handleAutopilotPullRequestEvent(event());
    const finding = await db.query.autopilotFindings.findFirst();
    if (!finding?.runId) {
      throw new Error("Expected interrupted finding");
    }
    await db
      .update(autopilotFindings)
      .set({
        status: "open",
        claimToken: "interrupted",
        claimedAt: new Date(0),
      })
      .where(eq(autopilotFindings.id, finding.id));
    await db
      .update(autopilotRuns)
      .set({ status: "running", heartbeatAt: new Date(0) })
      .where(eq(autopilotRuns.id, finding.runId));
    state.crash = false;
    await writeSuggestedPost("sandbox-org", finding.id);
    expect(opened).toHaveLength(1);
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "proposed"
    );
    expect(
      (
        await db.query.autopilotRuns.findFirst({
          where: eq(autopilotRuns.id, finding.runId),
        })
      )?.status
    ).toBe("failed");
  });

  test("cleanup by a replaced writer closes only its own PR, never its successor's", async () => {
    state.takeover = true;
    await handleAutopilotPullRequestEvent(event());
    expect(closed).toEqual([1]);
    const finding = await db.query.autopilotFindings.findFirst();
    expect(finding?.status).toBe("proposed");
    expect(finding?.pullRequestNumber).toBe(99);
    expect(finding?.branch).not.toBe(opened[0]);
  });
}
