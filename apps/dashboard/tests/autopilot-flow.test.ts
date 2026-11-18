import { afterAll, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import type { AutopilotPlannerOutput } from "@notra/ai/types/autopilot-planner";
import type {
  GitHubMentionContext,
  GitHubMentionThreadComment,
} from "@notra/ai/types/github-mention";
import {
  parsePlannerState,
  renderPlannerState,
} from "@notra/ai/utils/autopilot-planner";
import {
  artifactRevisions,
  artifacts,
  autopilotBriefs,
  brandSettings,
  geoMentionChecks,
  geoScans,
  projects,
  autopilotFindings,
  autopilotRuns,
  autopilotSettings,
  members,
  organizations,
  slackIntegrations,
  users,
} from "@notra/db/schema";
import type {
  GeoAiSearchGapRow,
  GeoPromptGapRow,
} from "@notra/geo-core/types/geo";
import { MEMORY_PATHS } from "@notra/memory/constants/memory";
import { setMemoryStore } from "@notra/memory/memory";
import { setRepoStore } from "@notra/memory/repos";
import { createInMemoryStore } from "@notra/memory/stores/in-memory";
import { createInMemoryRepos } from "@notra/memory/stores/in-memory-repos";
import { renderRecords } from "@notra/memory/utils/records";
import { resolveReferences } from "@notra/workflows/utils/references";
import { and, eq, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";

import type { AutopilotRunObservation } from "../src/types/autopilot";
import type { AutopilotPlanDecision } from "../src/types/autopilot-runtime";
import { createAutopilotSandbox } from "./utils/autopilot-sandbox";
import { createWorkflowGraphRunner } from "./utils/workflow-graph-runner";

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
    postContent: null as string | null,
    flag: true,
    credits: true,
    confidence: 0.99,
    billingCrash: false,
    crash: false,
    disableWhileWriting: false,
    disableSettingsWhileWriting: false,
    linkedReaction: false,
    reactionContent: "-1",
    feedbackFailure: false,
    mentionIntent: "write",
    feedbackRule: "",
    blockWrite: false,
    memoryFailure: false,
    memoryCommitFailure: false,
    act: 0.9,
    plan: null as AutopilotPlannerOutput | null,
    /** Prompt gaps the keywords job reads, i.e. what people ask about. */
    gaps: [] as GeoPromptGapRow[],
    /** Searches AI engines ran without finding the brand. */
    aiSearchGaps: [] as GeoAiSearchGapRow[],
    plannerPrompt: "",
    ambiguousFeedback: false,
    feedbackPrompt: "",
    takeover: false,
    sourceClosed: false,
    cancelDuringWriting: false,
    slackFailure: false,
    renderHero: false,
    publicAssets: false,
    imageCollision: false,
    fallbackImageCollision: false,
    reviewersRefused: false,
    /** GitHub refuses any request naming one of these, as it does for non-collaborators. */
    refusedReviewers: [] as string[],
    closedPulls: [] as {
      number: number;
      title: string;
      login: string;
      type?: string;
      headRef?: string;
    }[],
    changedFiles: {} as Record<number, string[]>,
  };
  const comments: string[] = [];
  const feedback: unknown[] = [];
  const classificationInputs: unknown[] = [];
  const ruleWrites: unknown[] = [];
  const feedbackAcknowledgments: string[] = [];
  const threadComments: GitHubMentionThreadComment[] = [];
  const deliveries: string[] = [];
  const slackMessages: string[] = [];
  const slackReplies: string[] = [];
  const slackCalls: { method: string; body: unknown }[] = [];
  const opened: string[] = [];
  const openedBodies: string[] = [];
  const writtenFiles: { path: string; contents?: string }[][] = [];
  const closed: number[] = [];
  const reviewers: string[][] = [];
  const charges: unknown[] = [];
  const holds: string[] = [];
  const writerCalls: string[] = [];
  /** What the writer was asked for: the brief and the questions it may target. */
  const writerInputs: {
    brief: { topic: string; angle: string; evidence: string };
    questions?: readonly string[] | null;
  }[] = [];
  const actionEvaluations: unknown[] = [];
  // The workspace memory is a real in-memory repository; only failures are injected.
  const memory = createInMemoryStore();
  const artifactRepos = createInMemoryRepos();
  setRepoStore(artifactRepos);
  const memoryCommits: { message: string; paths: string[] }[] = [];
  const unavailable = () => {
    if (state.memoryFailure) {
      throw new Error("Memory unavailable");
    }
  };
  setMemoryStore({
    ...memory,
    head: async (organizationId) => {
      unavailable();
      return memory.head(organizationId);
    },
    read: async (organizationId, path, ref) => {
      unavailable();
      return memory.read(organizationId, path, ref);
    },
    commit: async (organizationId, input) => {
      if (state.memoryCommitFailure) {
        throw new Error("Memory commit failed");
      }
      const sha = await memory.commit(organizationId, input);
      memoryCommits.push({
        message: input.message,
        paths: Object.keys(input.files),
      });
      if (MEMORY_PATHS.rules in input.files) {
        ruleWrites.push(input.files[MEMORY_PATHS.rules]);
      }
      return sha;
    },
  });
  const readMemory = async (path: string) => {
    const head = await memory.head("sandbox-org");
    return head ? memory.read("sandbox-org", path, head) : null;
  };
  /** Writes like a person editing the repository: no recorded commit. */
  const seedMemory = async (files: Record<string, string>) => {
    await memory.commit("sandbox-org", {
      expectedHeadSha: await memory.head("sandbox-org"),
      message: "Seed",
      files,
    });
  };
  const seedStandingRule = (text: string) =>
    seedMemory({
      [MEMORY_PATHS.rules]: renderRecords({
        title: "Rules",
        intro: "Standing rules for Autopilot.",
        records: [
          {
            id: "standing-rule",
            title: text,
            body: "",
            meta: {
              source: "dashboard",
              createdBy: "admin",
              createdAt: new Date().toISOString(),
            },
          },
        ],
      }),
    });
  const release = mock(async () => undefined);
  const readReactions = mock(async () => ({
    data: state.reactionContent
      ? [{ content: state.reactionContent, user: { id: 42, type: "User" } }]
      : [],
  }));
  const githubRequest = async (
    route: string,
    params?: Record<string, unknown>
  ) => {
    if (route === "GET /repos/{owner}/{repo}/pulls/{pull_number}/files") {
      const files =
        params?.page === 1
          ? (state.changedFiles[Number(params.pull_number)] ?? [])
          : [];
      return { data: files.map((filename) => ({ filename })) };
    }
    if (route === "GET /repos/{owner}/{repo}/pulls") {
      return {
        data: state.closedPulls.map((pull) => ({
          number: pull.number,
          title: pull.title,
          body: "A sandbox release",
          html_url: `https://github.com/sandbox/app/pull/${pull.number}`,
          merged_at: new Date().toISOString(),
          head: { ref: pull.headRef ?? "feature" },
          user: { login: pull.login, type: pull.type ?? "User" },
        })),
      };
    }
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
    if (route === "GET /repos/{owner}/{repo}/issues/comments/{comment_id}") {
      return { data: { body: "Offer" } };
    }
    if (route === "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}") {
      feedbackAcknowledgments.push(String(params?.body));
      return { data: {} };
    }
    return readReactions();
  };

  // Feedback is recorded here so its failures and replacements stay observable.
  mock.module("@/lib/autopilot/memory", () => ({
    renderFeedback: () => "",
    deleteAutopilotMemory: async () => undefined,
    loadTopicObservationIds: async () => ({
      ready: new Set<string>(),
      closed: new Set<string>(),
      known: new Set<string>(),
    }),
    rememberFeedback: async (input: unknown) => {
      if (state.feedbackFailure) {
        throw new Error("Memory unavailable");
      }
      feedback.push(input);
    },
  }));
  mock.module("@/lib/autopilot/llm", () => ({
    generateAutopilotObject: async (input: { tag: string; prompt: string }) => {
      if (input.tag === "planner") {
        state.plannerPrompt = input.prompt;
        if (!state.plan) {
          throw new Error("No planner output in this test");
        }
        return state.plan;
      }
      if (input.tag === "fact-check") {
        // Quotes the brief where it names Rival; the other claim has no source.
        const quote = input.prompt.includes("while Rival show up")
          ? "while Rival show up"
          : "";
        return {
          claims: [
            {
              claim: "AI answers name Rival for exports",
              about: "competitor",
              supported: true,
              source: "brief",
              quote,
              fix: null,
            },
            {
              claim: "Rival exports to every format",
              about: "competitor",
              supported: false,
              source: "",
              quote: "",
              fix: { find: " Rival exports to every format.", replace: "" },
            },
            {
              claim: "Sandbox exports in one click",
              about: "brand",
              supported: false,
              source: "",
              quote: "",
              fix: null,
            },
          ],
        };
      }
      if (input.tag === "brief") {
        // The writer of the brief page: leads with the first pending item and
        // also names one id it was never given, which must be dropped.
        const ids = [...input.prompt.matchAll(/- id: (\S+)/g)].map(
          (match) => match[1] ?? ""
        );
        return {
          headline: "Two calls to make today",
          summary: "One pull request and one idea are waiting.",
          lead: ids[0] ? { findingId: ids[0], why: "It is ready now." } : null,
          sections: [
            {
              title: "Everything else",
              body: "The rest of the day.",
              findingIds: [...ids, "not-in-the-input"],
            },
          ],
          headings: {
            waiting: "Wartet auf dich",
            alsoWaiting: "Wartet außerdem",
            merged: "Gemergt",
            worthKnowing: "",
          },
        };
      }
      state.feedbackPrompt = input.prompt;
      return input.tag === "write-rules"
        ? { allowed: !state.blockWrite }
        : {
            reply:
              "Would you prefer less implementation detail for this audience?",
            learning: state.ambiguousFeedback
              ? null
              : "This suggestion is too technical for the intended audience",
            rule: state.feedbackRule || null,
            removeRuleId: null,
          };
    },
  }));

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
    canResetAutopilotOnboarding: async () => false,
    isAutopilotEnabledForOrganization: async () => state.flag,
    isAutopilotOffForOrganization: async () => !state.flag,
    autopilotAccessState: async () => (state.flag ? "enabled" : "disabled"),
  }));
  const githubIntegration = await import("@notra/ai/integrations/github");
  mock.module("@notra/ai/integrations/github", () => ({
    ...githubIntegration,
    listGitHubAppRepositoriesEffect: () =>
      Effect.succeed([
        {
          owner: "sandbox",
          name: "app",
          fullName: "sandbox/app",
          defaultBranch: "main",
          private: false,
        },
      ]),
  }));
  mock.module("@/workflows/runtime", () => ({}));
  mock.module("@/lib/geo/configure", () => ({
    geoCoreDashboardLayer: Layer.empty,
  }));
  mock.module("@notra/geo-core/geo/gaps", () => ({
    loadGeoContentGaps: () =>
      Effect.succeed({
        promptGaps: state.gaps,
        searchGaps: [],
        aiSearchGaps: state.aiSearchGaps,
      }),
  }));
  mock.module("@notra/ai/evaluation/client", () => ({
    getEvaluationClient: () => ({
      tryEvaluate: async (input: { feature?: string }) => {
        if (input.feature === "autopilot-action") {
          actionEvaluations.push(input);
          return {
            answers: {
              act: {
                choice: state.act >= 0.5 ? "open" : "wait",
                probabilities: { open: state.act, wait: 1 - state.act },
              },
            },
            confidence: { act: state.act },
          };
        }
        classificationInputs.push(input);
        return {
          answers: {
            intent: {
              choice: state.mentionIntent,
              probabilities: { [state.mentionIntent]: 0.99 },
            },
            pick: {
              choice: "option_0",
              probabilities: {
                option_0: state.confidence,
                none: 1 - state.confidence,
              },
            },
          },
          confidence: { pick: state.confidence },
        };
      },
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
    listGitHubIssueComments: async () => threadComments,
    listGitHubReviewComments: async () => threadComments,
    replyToGitHubReviewThread: async () => ({
      id: 1,
      htmlUrl: "https://github.com/sandbox/app/pull/1#comment",
    }),
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
    writeBlogPost: async (input: {
      onUsage?: (usage: unknown) => void;
      brief: { topic: string; angle: string; evidence: string };
      questions?: readonly string[] | null;
    }) => {
      writerCalls.push("write");
      writerInputs.push({ brief: input.brief, questions: input.questions });
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
        content:
          state.postContent ??
          "---\ntitle: Sandbox exports\n---\nA sandbox announcement.",
        pullRequestBody: "Explains the sandbox change.",
      };
    },
  }));
  mock.module("@/lib/autopilot/hero-image", () => ({
    renderPostHeroImage: async () => {
      if (state.renderHero) {
        return {
          pngBase64: "c2FuZGJveA==",
          templateSource: "cached",
          warnings: [],
        };
      }
      throw new Error("No external image service in the sandbox");
    },
  }));
  mock.module("@/lib/autopilot/github", () => ({
    AutopilotRepositoryAccessError: class extends Error {},
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
      body: string;
      files: { path: string; contents?: string }[];
    }) => {
      expect(input.files[0]?.path).toStartWith("content/blog/");
      opened.push(input.slug);
      openedBodies.push(input.body);
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
      logins: string[],
      teams: string[] = []
    ) => {
      const requested = [...logins, ...teams.map((team) => `team:${team}`)];
      if (
        state.reviewersRefused ||
        requested.some((name) => state.refusedReviewers.includes(name))
      ) {
        throw new Error("Reviews may only be requested from collaborators");
      }
      reviewers.push(requested);
    },
  }));
  mock.module("@/lib/integrations/github/content-pull-request", () => ({
    isMergeMethodNotAllowed: () => false,
    isBaseBranchModified: () => false,
    getContentPullRequestState: async () => ({ status: "open" }),
    markContentPullRequestReady: async () => undefined,
    mergeContentPullRequest: async () => undefined,
  }));
  mock.module("@/lib/autopilot/slack", () => ({
    postAutopilotSlackMessage: (input: {
      clientMessageId?: string;
      destination?: { channelId: string };
      threadTs?: string;
    }) => {
      if (state.slackFailure) {
        throw new Error("Fixture Slack unavailable");
      }
      expect(input.destination?.channelId).toBe("C_SANDBOX");
      if (input.threadTs) {
        slackReplies.push(JSON.stringify(input));
      } else {
        expect(input.clientMessageId).toMatch(/^[0-9a-f-]{36}$/);
        deliveries.push(input.clientMessageId ?? "missing");
        slackMessages.push(JSON.stringify(input));
      }
      return Promise.resolve({
        ts: input.threadTs
          ? `1234567890.1${String(slackReplies.length).padStart(5, "0")}`
          : "1234567890.000001",
        channel: "C_SANDBOX",
        teamId: "T_SANDBOX",
      });
    },
    callAutopilotSlack: (input: { method: string; body: unknown }) => {
      slackCalls.push(input);
      return Promise.resolve();
    },
  }));
  const { handleAutopilotPullRequestEvent } =
    await import("../src/lib/autopilot/pull-request-events");
  const { handleAutopilotMention } =
    await import("../src/lib/autopilot/mentions");
  const { applyFeedbackInOrder } =
    await import("../src/lib/autopilot/feedback");
  const { buildAutopilotRunContext, deliverAutopilotBrief, runAutopilotJob } =
    await import("../src/lib/autopilot/run");
  const runGraph = await createWorkflowGraphRunner();
  const { AUTOPILOT_DAILY_WORKFLOW, workflowDefinitions } =
    await import("../src/lib/workflow-engine/definitions/autopilot");
  const { workflowBlockRegistry } =
    await import("../src/lib/workflow-engine/blocks");
  const { decideAutopilotPlan, rememberAutopilotPlan } =
    await import("../src/lib/autopilot/planner");
  const {
    syncOfferReactionFeedback,
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
  const { keywordFingerprint } = await import("../src/utils/autopilot-blog");
  const { listRecentPullRequestAuthors } =
    await import("../src/lib/autopilot/authors");
  const { autopilotAuthorPresets, toAutopilotCommitFilters } =
    await import("../src/utils/autopilot-commit-filters");
  const { updateAutopilotSettings } =
    await import("../src/lib/autopilot/settings");
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
    jobs: {
      readiness: false,
      keywords: true,
      commits: true,
      prompts: false,
      competitors: true,
      refresh: false,
      comparisons: false,
      rendering: false,
      links: false,
      landing: false,
    },
  });
  afterAll(() => sandbox.postgres.close());
  beforeEach(async () => {
    state.postContent = null;
    openedBodies.length = 0;
    state.gaps = [];
    state.aiSearchGaps = [];
    state.flag = true;
    state.credits = true;
    state.confidence = 0.99;
    state.billingCrash = false;
    state.crash = false;
    state.disableWhileWriting = false;
    state.disableSettingsWhileWriting = false;
    holds.length = 0;
    state.linkedReaction = false;
    state.reactionContent = "-1";
    state.feedbackFailure = false;
    state.mentionIntent = "write";
    state.feedbackRule = "";
    state.blockWrite = false;
    state.memoryFailure = false;
    state.memoryCommitFailure = false;
    state.act = 0.9;
    state.plan = null;
    state.plannerPrompt = "";
    state.ambiguousFeedback = false;
    state.feedbackPrompt = "";
    await memory.deleteRepo("sandbox-org");
    memoryCommits.length = 0;
    writerCalls.length = 0;
    writerInputs.length = 0;
    actionEvaluations.length = 0;
    threadComments.length = 0;
    ruleWrites.length = 0;
    feedback.length = 0;
    classificationInputs.length = 0;
    readReactions.mockClear();
    feedbackAcknowledgments.length = 0;
    state.takeover = false;
    state.sourceClosed = false;
    state.cancelDuringWriting = false;
    state.slackFailure = false;
    state.renderHero = false;
    state.publicAssets = false;
    state.imageCollision = false;
    state.fallbackImageCollision = false;
    state.reviewersRefused = false;
    state.refusedReviewers = [];
    state.closedPulls = [];
    state.changedFiles = {};
    reviewers.length = 0;
    writtenFiles.length = 0;
    comments.length = 0;
    deliveries.length = 0;
    slackMessages.length = 0;
    slackReplies.length = 0;
    slackCalls.length = 0;
    opened.length = 0;
    closed.length = 0;
    charges.length = 0;
    release.mockClear();
    await sandbox.postgres.exec('TRUNCATE "autopilot_runs" CASCADE');
    await db
      .update(members)
      .set({ role: "owner" })
      .where(eq(members.organizationId, "sandbox-org"));
    await db
      .update(autopilotSettings)
      .set({
        maxOpenPullRequests: 3,
        enabled: true,
        commitFilters: sql`DEFAULT`,
        reviewers: sql`DEFAULT`,
      })
      .where(eq(autopilotSettings.organizationId, "sandbox-org"));
  });
  const event = (number = 1, association = "MEMBER", login = "sandbox-dev") =>
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
        user: { type: "User", login },
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

  /** An admin's `@notra write a post` on a source pull request: the explicit request. */
  const askToWrite = (number = 1, commentId = number * 1000) => {
    const context = mentionContext(commentId);
    context.issueNumber = number;
    if (context.pullRequest) {
      context.pullRequest = {
        ...context.pullRequest,
        number,
        htmlUrl: `https://github.com/sandbox/app/pull/${number}`,
      };
    }
    return handleAutopilotMention(context);
  };

  const DAY_MS = 24 * 60 * 60 * 1000;
  const fingerprint = (number: number) => `commits:sandbox/app#${number}`;
  /** The content gap behind a seeded topic: people ask about it, the brand is missing. */
  const gapPrompt = (title: string) =>
    `how to use ${title.toLowerCase()} in a b2b app`;
  const gapFingerprint = (title: string) =>
    keywordFingerprint(gapPrompt(title));
  const gapRow = (title: string): GeoPromptGapRow => ({
    id: `gap-${title.toLowerCase()}`,
    prompt: gapPrompt(title),
    title,
    engines: ["chatgpt", "perplexity"],
    mentionedEngines: [],
    competitors: ["Rival"],
    discoveredCompetitors: [],
    searchQueries: [],
    ownMentionRate: 0,
    engineCoverage: 2,
    opportunity: 1,
    won: false,
    brief: null,
  });

  /** What the planner model answers: every observation linked into one topic. */
  const plannerOutput = (
    observationIds: string[],
    options: {
      slug?: string;
      title?: string;
      action?: "none" | "write_post";
      summary?: string;
      exception?: string;
    } = {}
  ): AutopilotPlannerOutput => {
    const slug = options.slug ?? "exports";
    const title = options.title ?? "Exports";
    const action = options.action ?? "write_post";
    return {
      assignments: observationIds.map((observationId) => ({
        observationId,
        topicSlug: slug,
        newTopicTitle: title,
      })),
      topics: [
        {
          slug,
          status: "ready",
          summary: options.summary ?? `${title} keep coming up`,
          openQuestions: [],
          nextStep: "",
        },
      ],
      action: {
        type: action,
        topicSlug: action === "none" ? null : slug,
        reason: `${title} shipped and users ask about it`,
        brief:
          action === "none"
            ? null
            : { topic: title, angle: `What ${title} changes for users` },
        exception: options.exception ?? null,
      },
    };
  };

  /**
   * A topic an earlier run linked to a content gap, so the merged pull request
   * that ships its answer is the second independent signal that makes it ripe.
   */
  const seedTopic = async (slug: string, title: string, number: number) => {
    // The gap is still open, so the keywords job sees it again this run.
    state.gaps = [...state.gaps, gapRow(title)];
    const current = parsePlannerState(await readMemory(MEMORY_PATHS.planner));
    const seenAt = new Date(Date.now() - DAY_MS).toISOString();
    await seedMemory({
      [MEMORY_PATHS.planner]: renderPlannerState({
        ...current,
        topics: [
          ...current.topics,
          {
            slug,
            title,
            status: "watching",
            summary: "",
            openQuestions: [],
            nextStep: "",
            signals: [
              {
                observationId: gapFingerprint(title),
                source: "keywords",
                title,
                detail: `AI answers about ${title} miss the brand`,
                runId: `earlier-${slug}`,
                seenAt,
              },
            ],
            findingId: null,
            pullRequestUrl: null,
            updatedAt: seenAt,
          },
        ],
      }),
    });
  };

  /**
   * One scheduled run: the commits job observes the merged pull requests and
   * the planner step plans on them. The model's answer is the only fake.
   */
  const dailyRun = async (
    id: string,
    pulls: { number: number; title: string }[],
    output: (observationIds: string[]) => AutopilotPlannerOutput = (ids) =>
      plannerOutput(ids)
  ) => {
    await db
      .update(autopilotRuns)
      .set({ status: "completed" })
      .where(
        and(
          eq(autopilotRuns.organizationId, "sandbox-org"),
          eq(autopilotRuns.status, "running")
        )
      );
    state.closedPulls = pulls.map((pull) => ({
      ...pull,
      login: "sandbox-dev",
    }));
    await db
      .insert(autopilotRuns)
      .values({ id, organizationId: "sandbox-org", trigger: "cron" });
    let observations: AutopilotRunObservation[] = [];
    const run = await runGraph({
      organizationId: "sandbox-org",
      definition: AUTOPILOT_DAILY_WORKFLOW,
      definitions: Object.values(workflowDefinitions),
      input: { autopilotRunId: id, previousRunAt: null },
      onBlock: (request) => {
        if (request.node.id === "plan") {
          observations = (request.config.observations as unknown[])
            .flat()
            .filter(Boolean) as AutopilotRunObservation[];
          state.plan = output(
            observations.map((observation) => observation.id)
          );
        }
      },
    });
    const findingIds = ["write", "idea"].flatMap((nodeId) => {
      const findingId = (
        run.state.nodes[nodeId]?.output as { findingId?: string } | undefined
      )?.findingId;
      return findingId ? [findingId] : [];
    });
    return { run, observations, result: { findingIds } };
  };
  const plannerState = async () =>
    parsePlannerState(await readMemory(MEMORY_PATHS.planner));
  const runMessages = async (runId: string) =>
    (
      await db.query.autopilotRunEvents.findMany({
        where: (row, { eq: equals }) => equals(row.runId, runId),
      })
    ).map((row) => `${row.level}: ${row.message}`);
  const exportsPull = { number: 40, title: "feat: add exports" };
  const exportsFollowUp = { number: 42, title: "feat: export reports to CSV" };
  const importsPull = { number: 41, title: "feat: add imports" };

  test("events only offer, never write", async () => {
    state.confidence = 0.84;
    await handleAutopilotPullRequestEvent(event(84));
    expect(comments).toHaveLength(0);
    expect(await db.query.autopilotFindings.findMany()).toHaveLength(0);
    expect(await db.query.autopilotRuns.findMany()).toHaveLength(0);
    for (const confidence of [0.85, 0.99]) {
      state.confidence = confidence;
      await handleAutopilotPullRequestEvent(
        event(Math.round(confidence * 100))
      );
      expect(comments.at(-1)).toContain("Should I write a post");
      expect(comments.at(-1)).toContain("I won't write it without a reply");
    }
    expect(comments).toHaveLength(2);
    expect(opened).toHaveLength(0);
    expect(writerCalls).toHaveLength(0);
    expect(holds).toHaveLength(0);
    expect(charges).toHaveLength(0);
    const findings = await db.query.autopilotFindings.findMany();
    expect(findings.map((finding) => finding.status)).toEqual([
      "suggested",
      "suggested",
    ]);
    expect(findings.every((finding) => finding.evidence.offerComment)).toBe(
      true
    );
  });

  test("failed explicit writes count failures and stop at the limit", async () => {
    state.crash = true;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await askToWrite(1, attempt);
      expect(
        (await db.query.autopilotFindings.findFirst())?.evidence.failures
      ).toBe(attempt);
    }
    await askToWrite(1, 4);
    expect(writerCalls).toHaveLength(3);
    expect(
      (await db.query.autopilotFindings.findFirst())?.evidence.failures
    ).toBe(3);
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
    // Every mention's hold is given back; nothing is charged for a failure.
    expect(release).toHaveBeenCalledTimes(4);
  });

  test("concurrent events for one source PR leave one idea and one offer", async () => {
    await Promise.all([
      handleAutopilotPullRequestEvent(event()),
      handleAutopilotPullRequestEvent(event()),
    ]);
    expect(await db.query.autopilotFindings.findMany()).toHaveLength(1);
    expect(comments).toHaveLength(1);
    expect(opened).toHaveLength(0);
    expect(holds).toHaveLength(0);
  });

  test("drafts ask the source author for review, and a refusal keeps the draft", async () => {
    expect((await handleAutopilotMention(mentionContext(1)))?.status).toBe(
      "replied"
    );
    await askToWrite(2);
    expect(reviewers).toEqual([["sandbox-dev"], ["sandbox-dev"]]);
    state.reviewersRefused = true;
    await askToWrite(3);
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

  test("drafts ask the workspace's reviewers first and the source author only once", async () => {
    await updateAutopilotSettings("sandbox-org", {
      reviewers: ["@Maria", "sandbox/docs", "other-org/docs", "Sandbox-Dev"],
    });
    expect(
      (
        await db.query.autopilotSettings.findFirst({
          columns: { reviewers: true },
        })
      )?.reviewers
    ).toEqual(["maria", "sandbox/docs", "other-org/docs", "sandbox-dev"]);
    expect((await handleAutopilotMention(mentionContext(1)))?.status).toBe(
      "replied"
    );
    // other-org/docs is not a team of the website's organization.
    expect(reviewers).toEqual([["maria", "sandbox-dev", "team:docs"]]);

    // One name GitHub refuses doesn't cost the others their request, and a
    // refused workspace reviewer who wrote the source is still asked as author.
    reviewers.length = 0;
    state.refusedReviewers = ["ghost"];
    await updateAutopilotSettings("sandbox-org", {
      reviewers: ["maria", "ghost", "sandbox/docs"],
    });
    await askToWrite(2);
    expect(reviewers).toEqual([["maria"], ["team:docs"], ["sandbox-dev"]]);

    reviewers.length = 0;
    state.refusedReviewers = ["sandbox-dev"];
    await updateAutopilotSettings("sandbox-org", {
      reviewers: ["sandbox-dev"],
    });
    await askToWrite(3);
    expect(reviewers).toEqual([]);

    state.reviewersRefused = true;
    await askToWrite(4);
    const findings = await db.query.autopilotFindings.findMany({
      columns: { status: true },
    });
    expect(findings.map((finding) => finding.status)).toEqual([
      "proposed",
      "proposed",
      "proposed",
      "proposed",
    ]);
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
    ).toBe("ready");
    expect(
      autopilotPullRequestMoment({
        ...input,
        pull_request: {
          ...input.pull_request,
          user: { type: "Bot", login: "notra[bot]" },
        },
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

  test("release filters drop excluded authors and changes outside the paths before Jev or the planner", async () => {
    const settings = await db.query.autopilotSettings.findFirst({
      columns: { commitFilters: true },
    });
    // The well-known bots are on the list by default, as visible entries.
    expect(settings?.commitFilters.excludedAuthors).toEqual([
      "dependabot[bot]",
      "renovate[bot]",
      "github-actions[bot]",
    ]);
    const filters = {
      excludedAuthors: [
        ...(settings?.commitFilters.excludedAuthors ?? []),
        "excluded-dev",
      ],
      paths: { "sandbox/app": ["apps/web"] },
      repositories: [] as string[],
    };
    const setFilters = (repositories: string[]) =>
      db
        .update(autopilotSettings)
        .set({ commitFilters: { ...filters, repositories } })
        .where(eq(autopilotSettings.organizationId, "sandbox-org"));
    await setFilters([]);
    state.changedFiles = {
      8: ["docs/readme.md"],
      9: ["docs/readme.md", "apps/web/src/page.tsx"],
      21: ["apps/api/src/index.ts"],
      22: ["apps/web/src/exports.tsx"],
    };

    // The webhook: filtered pull requests cost no Jev call and no run.
    await handleAutopilotPullRequestEvent(event(7, "MEMBER", "Excluded-Dev"));
    await handleAutopilotPullRequestEvent(event(8));
    expect(classificationInputs).toHaveLength(0);
    expect(await db.query.autopilotRuns.findMany()).toHaveLength(0);
    await handleAutopilotPullRequestEvent(event(9));
    expect(classificationInputs).toHaveLength(1);
    expect(comments).toHaveLength(1);
    // A pick of repositories leaves every other one out, even a change
    // under the paths.
    state.changedFiles[10] = ["apps/web/src/picked.tsx"];
    await setFilters(["sandbox/other"]);
    await handleAutopilotPullRequestEvent(event(10));
    expect(classificationInputs).toHaveLength(1);
    await setFilters([]);

    // The daily job: the same filters, logged as skips in the run.
    classificationInputs.length = 0;
    state.closedPulls = [
      { number: 20, title: "feat: excluded", login: "excluded-dev" },
      { number: 21, title: "feat: api only", login: "sandbox-dev" },
      { number: 22, title: "feat: web exports", login: "sandbox-dev" },
      { number: 23, title: "feat: app bot", login: "helper[bot]", type: "Bot" },
      {
        number: 26,
        title: "feat: bot release",
        login: "dependabot[bot]",
        type: "Bot",
      },
      {
        number: 27,
        title: "feat: own draft",
        login: "sandbox-dev",
        headRef: "notra/autopilot/blog",
      },
    ];
    state.changedFiles[23] = ["apps/web/src/bot.ts"];
    await db.insert(autopilotRuns).values({
      id: "daily-filters",
      organizationId: "sandbox-org",
      trigger: "cron",
    });
    const ctx = await buildAutopilotRunContext("sandbox-org", "daily-filters");
    const observed = await runAutopilotJob(ctx, "commits");
    const events = await db.query.autopilotRunEvents.findMany({
      where: (row, { eq: equals }) => equals(row.runId, "daily-filters"),
    });
    expect(
      events
        .filter((row) => row.level === "skip")
        .map((row) => row.message)
        .toSorted()
    ).toEqual([
      "Skipped sandbox/app#20: author excluded-dev is excluded",
      "Skipped sandbox/app#21: no changed files under apps/web",
      "Skipped sandbox/app#26: author dependabot[bot] is excluded",
    ]);
    // The job only observes; the planner judges. A bot nobody listed is
    // observed like anyone, Notra's own drafts never are.
    expect(classificationInputs).toHaveLength(0);
    expect(
      (observed.observations ?? [])
        .map((observation) => observation.id)
        .toSorted()
    ).toEqual([fingerprint(22), fingerprint(23)]);
    expect(await db.query.autopilotFindings.findMany()).toHaveLength(1);

    // Skip-list suggestions: recent authors and bots, chores counted.
    state.closedPulls.push(
      { number: 24, title: "chore: bump deps", login: "Deps-Person" },
      { number: 25, title: "ci: cache", login: "deps-person" }
    );
    const authors = await listRecentPullRequestAuthors(
      "sandbox-org",
      toAutopilotCommitFilters(null)
    );
    expect(authors.find((author) => author.login === "helper[bot]")?.bot).toBe(
      true
    );
    expect(authors.map((author) => author.login)).not.toContain("notra[bot]");
    expect(authors.find((author) => author.login === "deps-person")).toEqual({
      login: "deps-person",
      bot: false,
      pullRequests: 2,
      chores: 2,
    });
    // Repository bots first, then chore-heavy people; listed ones drop out.
    expect(
      autopilotAuthorPresets(authors, ["dependabot[bot]", "excluded-dev"])
    ).toEqual(["helper[bot]", "deps-person"]);
    // Without bots of its own, the well-known ones are offered.
    expect(
      autopilotAuthorPresets(
        authors.filter((author) => !author.bot),
        ["renovate[bot]"]
      )
    ).toEqual(["dependabot[bot]", "github-actions[bot]", "deps-person"]);
  });

  for (const publicAssets of [true, false]) {
    test(`hero collisions use a fresh image and matching frontmatter with public assets: ${publicAssets}`, async () => {
      state.renderHero = true;
      state.publicAssets = publicAssets;
      state.imageCollision = true;
      await askToWrite();
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
    await askToWrite();
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
  });

  test("replays produce one offer, then one draft and one usage confirmation", async () => {
    await handleAutopilotPullRequestEvent(event());
    await handleAutopilotPullRequestEvent(event());
    expect(comments).toHaveLength(1);
    expect(holds).toHaveLength(0);
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "suggested"
    );
    // The same mention delivered twice writes once.
    await askToWrite(1, 7);
    await askToWrite(1, 7);
    expect(opened).toHaveLength(1);
    expect(charges).toHaveLength(1);
    for (const comment of comments) {
      expect(comment).not.toContain("sandbox/website");
    }
    const finding = await db.query.autopilotFindings.findFirst();
    expect(finding?.status).toBe("proposed");
    expect(
      (await db.query.autopilotRuns.findMany()).every(
        (run) => run.status === "completed"
      )
    ).toBe(true);
  });

  for (const duringWriting of [true, false]) {
    test(`a canceled source ${duringWriting ? "during writing" : "before the claim"} leaves no post or charge`, async () => {
      state.cancelDuringWriting = duringWriting;
      state.sourceClosed = !duringWriting;
      await askToWrite();
      expect(opened).toHaveLength(0);
      expect(charges).toHaveLength(0);
      expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
        "dismissed"
      );
      expect(release).toHaveBeenCalledTimes(1);
    });
  }

  test("a renewed idea is briefed again; a retried failure is not", async () => {
    await db.insert(autopilotRuns).values({
      id: "renew-run",
      organizationId: "sandbox-org",
      trigger: "manual",
    });
    const proposal = {
      kind: "keywords" as const,
      fingerprint: "keywords:renewed idea",
      title: "Renewed",
      summary: "Renewed",
      evidence: {},
    };
    const first = await claimFinding("sandbox-org", "renew-run", proposal);
    if (!first) {
      throw new Error("Expected a claim");
    }
    const reclaim = async (status: "expired" | "failed") => {
      await db
        .update(autopilotFindings)
        .set({
          status,
          claimToken: null,
          evidence: { briefed: ["suggested"] },
        })
        .where(eq(autopilotFindings.id, first.finding.id));
      const claim = await claimFinding("sandbox-org", "renew-run", proposal);
      if (!claim) {
        throw new Error("Expected a renewed claim");
      }
      return claim.finding.evidence.briefed;
    };
    expect(await reclaim("failed")).toEqual(["suggested"]);
    expect(await reclaim("expired")).toBeUndefined();
  });

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
    await askToWrite(1);
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
      return deliverAutopilotBrief({ ctx, insights: [], previousRunAt: null });
    };
    await db
      .update(autopilotSettings)
      .set({ slackChannelId: null })
      .where(eq(autopilotSettings.organizationId, "sandbox-org"));
    expect(await daily("brief-off")).toBeNull();
    expect(
      (await db.query.autopilotFindings.findFirst())?.evidence.briefed ?? []
    ).toHaveLength(0);
    // Without Slack nothing links to a page, so none is written.
    expect(await db.query.autopilotBriefs.findMany()).toHaveLength(0);
    await db
      .update(autopilotRuns)
      .set({ status: "completed" })
      .where(eq(autopilotRuns.id, "brief-off"));
    await db
      .update(autopilotSettings)
      .set({ slackChannelId: "C_SANDBOX" })
      .where(eq(autopilotSettings.organizationId, "sandbox-org"));
    expect(await daily("brief-one")).not.toBeNull();
    expect(slackMessages[0]).toContain("1 ready to merge · 1 idea");
    const page = await db.query.autopilotBriefs.findFirst({
      where: eq(autopilotBriefs.runId, "brief-one"),
    });
    if (!page?.content.lead) {
      throw new Error("Expected a brief page with a lead item");
    }
    // The brief is read as an artifact, and Slack links there.
    if (!page.artifactId) {
      throw new Error("Expected the brief to be saved as an artifact");
    }
    expect(slackMessages[0]).toContain(`/artifact/${page.artifactId}`);
    const artifact = await db.query.artifacts.findFirst({
      where: eq(artifacts.id, page.artifactId),
    });
    expect(artifact?.source).toBe("autopilot");
    // Headings come translated with the words; an empty one stays English.
    expect(page.content.headings).toMatchObject({
      waiting: "Wartet auf dich",
      worthKnowing: "Worth knowing",
    });
    // The lead item opens the artifact on its own, without a callout above it.
    expect(artifact?.content.blocks[0]).toEqual({
      type: "autopilot",
      findingIds: [page.content.lead.findingId],
    });
    expect(JSON.stringify(artifact?.content)).not.toContain('"callout"');
    // Its file is the first commit of its own repository.
    const revision = await db.query.artifactRevisions.findFirst({
      where: eq(artifactRevisions.artifactId, page.artifactId),
    });
    const [commit] = artifactRepos.commits(`notra-artifact-${page.artifactId}`);
    expect(revision?.sha).toBe(commit?.sha);
    expect(commit?.files.get("artifact.md")).toContain("```autopilot");
    expect(slackMessages[0]).toContain("Two calls to make today");
    expect(page.content.writtenBy).toBe("agent");
    expect(page.content.findingIds).toHaveLength(2);
    // The lead is not repeated in a section, and unknown ids are dropped.
    expect(page.content.sections[0]?.findingIds).toEqual(
      page.content.findingIds.filter(
        (id) => id !== page.content.lead?.findingId
      )
    );
    expect(page.slackMessageTs).toBe("1234567890.000001");
    expect(slackReplies).toHaveLength(2);
    expect(slackReplies.join()).toContain("React 👍 to merge");
    expect(slackReplies.join()).toContain("React 👍 to write it");
    expect(
      slackCalls.filter((call) => call.method === "reactions.add")
    ).toHaveLength(4);
    for (const finding of await db.query.autopilotFindings.findMany()) {
      if (finding.status !== "suggested" && finding.status !== "proposed") {
        throw new Error("Expected an announced state");
      }
      expect(finding.evidence.briefed).toEqual([finding.status]);
      expect(finding.evidence.slackMessage).toMatchObject({
        channel: "C_SANDBOX",
        threadTs: "1234567890.000001",
      });
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
    await autopilotSuggestionWorkflow({
      organizationId: "sandbox-org",
      findingId: idea.id,
    });
    // The written PR is announced in the idea's thread, not in a new brief.
    expect(slackReplies.at(-1)).toContain("React 👍 to merge");
    expect(await daily("brief-three")).toBeNull();
    expect(deliveries).toHaveLength(1);
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
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
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
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
    state.flag = false;
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
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
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
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
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
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
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
    await handleAutopilotPullRequestEvent(event());
    const idea = await db.query.autopilotFindings.findFirst();
    if (!idea) {
      throw new Error("Expected a suggestion");
    }
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
    await askToWrite();
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

  test("the planner waits on one weak observation, and pull requests alone make an idea, not a PR", async () => {
    const day1 = await dailyRun("planner-day-1", [exportsPull]);
    expect(day1.observations.map((row) => row.id)).toEqual([fingerprint(40)]);
    expect(opened).toHaveLength(0);
    expect(await db.query.autopilotFindings.findMany()).toHaveLength(0);
    const watched = await plannerState();
    expect(watched.lastRunId).toBe("planner-day-1");
    expect(watched.topics).toEqual([
      expect.objectContaining({
        slug: "exports",
        title: "Exports",
        findingId: null,
        signals: [expect.objectContaining({ observationId: fingerprint(40) })],
      }),
    ]);
    expect(await readMemory(MEMORY_PATHS.planner)).toContain(
      "Exports keep coming up"
    );
    expect(await runMessages("planner-day-1")).toContainEqual(
      'decision: Not acting on "Exports" yet'
    );

    // The same pull request seen again is still one signal.
    state.act = 0.9;
    await dailyRun("planner-day-2", [exportsPull]);
    expect(opened).toHaveLength(0);
    // A second pull request about the same feature is the independent signal,
    // but nobody asked about exports: it waits as an idea for a click.
    const day3 = await dailyRun("planner-day-3", [
      exportsPull,
      exportsFollowUp,
    ]);
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
    const finding = await db.query.autopilotFindings.findFirst();
    expect(finding).toMatchObject({
      fingerprint: fingerprint(42),
      status: "suggested",
      runId: "planner-day-3",
    });
    expect(await runMessages("planner-day-3")).toContainEqual(
      'decision: Saved "Exports" as an idea: nobody is asking about it yet'
    );
    expect(finding?.evidence.confidence).toBe(0.9);
    expect(finding?.evidence.topic).toMatchObject({
      slug: "exports",
      signals: 2,
    });
    expect(day3.result.findingIds).toEqual(finding ? [finding.id] : []);
    const acted = await plannerState();
    expect(acted.lastRunId).toBe("planner-day-3");
    expect(acted.topics[0]).toMatchObject({
      status: "ready",
      findingId: finding?.id,
    });
    // One signal per observation: the pull request seen on three days is one.
    expect(acted.topics[0]?.signals).toHaveLength(2);
    // Autonomous runs only ever write their own notes, one commit per run.
    const planned = memoryCommits.filter(
      (commit) => !commit.message.startsWith("Dream:")
    );
    expect(planned.map((commit) => commit.message)).toEqual([
      "Autopilot run planner-day-1",
      "Autopilot run planner-day-2",
      "Autopilot run planner-day-3",
    ]);
    expect(
      planned.every((commit) => commit.paths.join() === "planner.md")
    ).toBe(true);
  });

  test("the planner sees how an earlier merged post on this site did, with its file read from the pull request once", async () => {
    await db.insert(autopilotFindings).values({
      id: "earlier-post",
      organizationId: "sandbox-org",
      kind: "commits",
      fingerprint: "commits:sandbox/website#77",
      title: "How CSV exports work",
      summary: "A post about CSV exports",
      status: "merged",
      repository: "sandbox/website",
      pullRequestNumber: 77,
      mergedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      evidence: { topic: { slug: "exports", title: "Exports", signals: 2 } },
    });
    // A post on the site Autopilot wrote to before says nothing about this one.
    await db.insert(autopilotFindings).values({
      id: "old-site-post",
      organizationId: "sandbox-org",
      kind: "commits",
      fingerprint: "commits:sandbox/old-website#5",
      title: "How CSV imports work",
      summary: "A post on the old site",
      status: "merged",
      repository: "sandbox/old-website",
      pullRequestNumber: 5,
      mergedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      evidence: { filePath: "content/blog/csv-imports.mdx" },
    });
    state.changedFiles[77] = [
      "public/blog/csv-exports.png",
      "content/blog/csv-exports.mdx",
    ];
    await dailyRun("planner-results", [exportsPull]);
    const prompt = JSON.parse(state.plannerPrompt) as {
      results: Record<string, unknown>[];
    };
    // No site sends traffic in the sandbox: unknown, never zero.
    expect(prompt.results).toEqual([
      expect.objectContaining({
        title: "How CSV exports work",
        kind: "post",
        topicSlug: "exports",
        page: "csv-exports",
        mergedDaysAgo: 20,
        aiAnswerFetches: null,
        humanViews: null,
      }),
    ]);
    const stored = await db.query.autopilotFindings.findFirst({
      where: eq(autopilotFindings.id, "earlier-post"),
    });
    expect(stored?.evidence.filePath).toBe("content/blog/csv-exports.mdx");
    expect(await runMessages("planner-results")).toContainEqual(
      "decision: Read how 1 earlier post did"
    );
  });

  test("a gap and the pull request that ships its answer are written from the gap, with the pull request as facts", async () => {
    await seedTopic("exports", "Exports", 40);
    const { observations } = await dailyRun("planner-gap-first", [exportsPull]);
    // The pull request came last, yet the post is for the question.
    expect(observations.map((row) => row.id)).toEqual([
      gapFingerprint("Exports"),
      fingerprint(40),
    ]);
    expect(opened).toHaveLength(1);
    const finding = await db.query.autopilotFindings.findFirst();
    expect(finding).toMatchObject({
      kind: "keywords",
      fingerprint: gapFingerprint("Exports"),
    });
    expect(finding?.evidence.target).toMatchObject({ kind: "prompt" });
    expect(finding?.evidence.pullRequests).toEqual([
      expect.objectContaining({ number: 40, title: exportsPull.title }),
    ]);
    const brief = writerInputs.at(-1)?.brief;
    expect(brief?.evidence.startsWith("AI engines answer")).toBe(true);
    expect(brief?.evidence).toContain("What the product does now");
    expect(brief?.evidence).toContain(exportsPull.title);
    // A post for a gap already has its question; no list to pick from.
    expect(writerInputs.at(-1)?.questions).toBeNull();
  });

  test("where answers and searches are tracked, pull requests alone make no post and no idea", async () => {
    state.closedPulls = [exportsPull, exportsFollowUp].map((pull) => ({
      ...pull,
      login: "sandbox-dev",
    }));
    await db.insert(autopilotRuns).values({
      id: "planner-tracked",
      organizationId: "sandbox-org",
      trigger: "cron",
    });
    const ctx = {
      ...(await buildAutopilotRunContext("sandbox-org", "planner-tracked")),
      projectId: "sandbox-project",
    };
    const observations =
      (await runAutopilotJob(ctx, "commits")).observations ?? [];
    expect(observations).toHaveLength(2);
    state.plan = plannerOutput(observations.map((row) => row.id));
    const decision = await decideAutopilotPlan(ctx, observations);
    expect(decision.outcome).toBe("wait");
    expect(state.plannerPrompt).toContain('"demandTracked":true');
    expect(await runMessages("planner-tracked")).toContainEqual(
      'decision: Not acting on "Exports" yet'
    );
    expect(await db.query.autopilotFindings.findMany()).toHaveLength(0);
    expect(opened).toHaveLength(0);
  });

  test("a gap the brand stayed missing from across scans days apart opens a PR on its own; one scan waits", async () => {
    // Its own project, removed afterwards: daily runs elsewhere in this file
    // fall back to the workspace's only project.
    await db.insert(brandSettings).values({
      id: "sustained-brand",
      organizationId: "sandbox-org",
      name: "Sustained",
      websiteUrl: "https://sandbox.dev",
    });
    await db.insert(projects).values({
      id: "sustained-project",
      organizationId: "sandbox-org",
      name: "Sustained",
      brandSettingsId: "sustained-brand",
    });
    try {
      const gap = gapRow("Exports");
      state.gaps = [gap];
      const scanned = async (
        scanId: string,
        daysAgo: number,
        mentioned = false
      ) => {
        await db.insert(geoScans).values({
          id: scanId,
          organizationId: "sandbox-org",
          projectId: "sustained-project",
          status: "completed",
        });
        await db.insert(geoMentionChecks).values({
          id: `${scanId}-check`,
          organizationId: "sandbox-org",
          projectId: "sustained-project",
          scanId,
          engine: "chatgpt",
          promptId: gap.id,
          prompt: gap.prompt,
          answer: "",
          mentioned,
          competitors: ["Rival"],
          grounding: { queries: [], sources: [] },
          sources: [],
          capturedAt: new Date(Date.now() - daysAgo * DAY_MS),
        });
      };
      const plan = async (runId: string) => {
        await db.insert(autopilotRuns).values({
          id: runId,
          organizationId: "sandbox-org",
          trigger: "cron",
        });
        const ctx = {
          ...(await buildAutopilotRunContext("sandbox-org", runId)),
          projectId: "sustained-project",
        };
        const observations =
          (await runAutopilotJob(ctx, "keywords")).observations ?? [];
        state.plan = plannerOutput(observations.map((row) => row.id));
        const decision = await decideAutopilotPlan(ctx, observations);
        await db
          .update(autopilotRuns)
          .set({ status: "completed" })
          .where(eq(autopilotRuns.id, runId));
        return { observations, decision };
      };

      // One scan: the gap may be noise, so a single signal still waits.
      await scanned("sustained-scan-1", 6);
      const once = await plan("sustained-once");
      expect(once.observations[0]?.sustained).toBeUndefined();
      expect(once.decision.outcome).toBe("wait");

      // Missing again five days later, but the scan is still running: some
      // engines may not have answered yet, so it doesn't count.
      await scanned("sustained-scan-2", 1);
      await db
        .update(geoScans)
        .set({ status: "running" })
        .where(eq(geoScans.id, "sustained-scan-2"));
      const running = await plan("sustained-running");
      expect(running.observations[0]?.sustained).toBeUndefined();
      expect(running.decision.outcome).toBe("wait");

      // Finished: lasting demand on its own.
      await db
        .update(geoScans)
        .set({ status: "completed" })
        .where(eq(geoScans.id, "sustained-scan-2"));
      const twice = await plan("sustained-twice");
      expect(twice.observations[0]).toMatchObject({ sustained: true });
      expect(twice.observations[0]?.detail).toContain(
        "Missing in 2 scans over 5 days."
      );
      expect(twice.decision.outcome).toBe("open");
      if (twice.decision.outcome === "open") {
        expect(twice.decision.proposal.evidence.gate).toContainEqual(
          expect.objectContaining({ name: "signals", ok: true })
        );
      }

      // Named in the latest scan: the gap is closing, so it waits again.
      await scanned("sustained-scan-3", 0, true);
      const closing = await plan("sustained-closing");
      expect(closing.observations[0]?.sustained).toBeUndefined();
      expect(closing.decision.outcome).toBe("wait");
    } finally {
      await db.delete(projects).where(eq(projects.id, "sustained-project"));
      await db
        .delete(brandSettings)
        .where(eq(brandSettings.id, "sustained-brand"));
    }
  });

  test("an AI search gap becomes a keyword idea measured on the prompt whose answers ran the search", async () => {
    await db.insert(brandSettings).values({
      id: "sandbox-brand",
      organizationId: "sandbox-org",
      websiteUrl: "https://sandbox.dev",
    });
    await db.insert(projects).values({
      id: "sandbox-project",
      organizationId: "sandbox-org",
      name: "Sandbox",
      brandSettingsId: "sandbox-brand",
    });
    await db.insert(geoScans).values({
      id: "scan-1",
      organizationId: "sandbox-org",
      projectId: "sandbox-project",
      status: "completed",
    });
    // Three of four recent answers to the custom prompt miss the brand.
    await db.insert(geoMentionChecks).values(
      [false, false, false, true].map((mentioned, index) => ({
        id: `check-${index}`,
        organizationId: "sandbox-org",
        projectId: "sandbox-project",
        scanId: "scan-1",
        engine: ["chatgpt", "perplexity", "gemini", "claude"][index] ?? "",
        promptId: "custom-prompt-csv",
        prompt: "how do I export reports to csv",
        answer: "",
        mentioned,
        competitors: ["Rival"],
        grounding: { queries: ["export reports csv"], sources: [] },
        sources: [],
        capturedAt: new Date(Date.now() - DAY_MS),
      }))
    );
    const gap: GeoAiSearchGapRow = {
      id: "ai-search-csv",
      query: "export reports csv",
      variants: [],
      prompts: ["how do I export reports to csv"],
      // The first prompt has no recent answers to compare with.
      promptIds: ["prompt-gone", "prompt-csv"],
      engines: ["chatgpt"],
      searches: 3,
      ownMentionRate: 0.25,
      competitors: ["Rival"],
      discoveredCompetitors: [],
      opportunity: 1,
      brief: null,
      // A page on the site already covers the search, so the idea updates it.
      recommendation: {
        action: "update",
        reason: "Existing page covers 80% of this query cluster.",
        targets: [
          {
            kind: "page",
            id: "page-exports",
            url: "https://sandbox.dev/docs/exports",
            title: "Exports",
            score: 0.8,
          },
        ],
      },
    };
    state.aiSearchGaps = [
      gap,
      {
        ...gap,
        id: "ai-search-briefed",
        query: "csv exports",
        brief: {
          briefId: "brief-1",
          status: "draft",
          postId: null,
          workingTitle: null,
          publishedAt: null,
          baseline: null,
          rescanned: false,
        },
      },
    ];
    await db.insert(autopilotRuns).values({
      id: "keywords-ai-search",
      organizationId: "sandbox-org",
      trigger: "cron",
    });
    const ctx = {
      ...(await buildAutopilotRunContext("sandbox-org", "keywords-ai-search")),
      projectId: "sandbox-project",
    };
    const observations =
      (await runAutopilotJob(ctx, "keywords")).observations ?? [];
    expect(observations.map((row) => row.title)).toEqual([
      "export reports csv",
    ]);
    const [observation] = observations;
    expect(observation?.detail).toBe(
      'AI engines searched for "export reports csv" 3 times without finding you (25% of those answers mention you), while Rival show up. They searched it to answer "how do I export reports to csv".'
    );
    expect(observation?.proposal.evidence.target).toEqual({
      kind: "prompt",
      promptId: "prompt-csv",
      before: 0.25,
    });
    expect(observation?.updatePage).toEqual({
      url: "https://sandbox.dev/docs/exports",
      title: "Exports",
    });
  });

  test("a post someone asks for about a pull request gets the tracked questions to target", async () => {
    state.gaps = [gapRow("Exports")];
    await askToWrite(1);
    expect(opened).toHaveLength(1);
    expect(writerInputs.at(-1)?.questions).toEqual([
      expect.stringContaining(`"${gapPrompt("Exports")}"`),
    ]);
  });

  test("a clean track record opens a second ripe topic in the same week", async () => {
    await seedTopic("exports", "Exports", 40);
    await dailyRun("planner-budget-open-1", [exportsPull]);
    await seedTopic("imports", "Imports", 41);
    await dailyRun("planner-budget-open-2", [exportsPull, importsPull], (ids) =>
      plannerOutput(ids, { slug: "imports", title: "Imports" })
    );
    expect(opened).toHaveLength(2);
  });

  test("posts people closed shrink the budget: a second ripe topic becomes an idea, an explicit write still goes through", async () => {
    await db.insert(autopilotFindings).values(
      [1, 2].map((number) => ({
        id: `closed-finding-${number}`,
        organizationId: "sandbox-org",
        kind: "keywords" as const,
        fingerprint: `keywords:closed-${number}`,
        title: `Closed post ${number}`,
        summary: "Closed by a person",
        status: "dismissed" as const,
        pullRequestNumber: 900 + number,
        dismissedAt: new Date(),
        evidence: {
          topic: { slug: `closed-${number}`, title: "Closed", signals: 2 },
        },
      }))
    );
    await seedTopic("exports", "Exports", 40);
    await dailyRun("planner-budget-1", [exportsPull]);
    expect(opened).toHaveLength(1);
    await seedTopic("imports", "Imports", 41);
    await dailyRun("planner-budget-2", [exportsPull, importsPull], (ids) =>
      plannerOutput(ids, { slug: "imports", title: "Imports" })
    );
    expect(opened).toHaveLength(1);
    const idea = await db.query.autopilotFindings.findFirst({
      where: eq(autopilotFindings.fingerprint, gapFingerprint("Imports")),
    });
    expect(idea?.status).toBe("suggested");
    expect(
      (await plannerState()).topics.find((topic) => topic.slug === "imports")
    ).toMatchObject({ status: "ready", findingId: idea?.id });
    expect(await runMessages("planner-budget-2")).toContainEqual(
      'decision: Saved "Imports" as an idea: no room for an automatic pull request'
    );
    if (!idea) {
      throw new Error("Expected an idea");
    }
    await autopilotSuggestionWorkflow({
      organizationId: "sandbox-org",
      findingId: idea.id,
    });
    expect(opened).toHaveLength(2);
  });

  test("a post that names a competitor keeps what a source backs and loses the rest, without waiting for a person", async () => {
    state.postContent =
      "---\ntitle: Sandbox exports\n---\nAI answers name Rival for exports. Rival exports to every format. Sandbox exports in one click.";
    await seedTopic("exports", "Exports", 40);
    await dailyRun("planner-competitor-check", [exportsPull]);
    expect(opened).toHaveLength(1);
    const post =
      writtenFiles[0]?.find((file) => file.path.endsWith(".md"))?.contents ??
      "";
    expect(post).toContain("AI answers name Rival for exports.");
    expect(post).not.toContain("Rival exports to every format");
    // Brand claims are not this check's business.
    expect(post).toContain("Sandbox exports in one click.");
    const body = openedBodies[0] ?? "";
    expect(body).toContain("### Fact check");
    expect(body).toContain("1 of 2 claims are quoted from a source");
    expect(body).not.toContain("Names competitors");
  });

  test("a full draft limit keeps a ripe topic as an idea", async () => {
    await db
      .update(autopilotSettings)
      .set({ maxOpenPullRequests: 1 })
      .where(eq(autopilotSettings.organizationId, "sandbox-org"));
    // An explicit request bypasses the cap and does not use the autonomous budget.
    await askToWrite(1);
    expect(opened).toHaveLength(1);
    await seedTopic("exports", "Exports", 40);
    await dailyRun("planner-capped", [exportsPull]);
    expect(opened).toHaveLength(1);
    expect(
      (
        await db.query.autopilotFindings.findFirst({
          where: eq(autopilotFindings.fingerprint, gapFingerprint("Exports")),
        })
      )?.status
    ).toBe("suggested");
  });

  test("the planner's own call on one gap opens a PR when Jev backs it", async () => {
    const exception = "Every engine leaves the brand out of a core question";
    state.gaps = [gapRow("Exports")];
    await dailyRun("planner-own-call", [], (ids) =>
      plannerOutput(ids, { exception })
    );
    expect(opened).toHaveLength(1);
    const finding = await db.query.autopilotFindings.findFirst();
    expect(finding).toMatchObject({
      kind: "keywords",
      fingerprint: gapFingerprint("Exports"),
    });
    expect(finding?.evidence.exception).toBe(exception);
    expect(finding?.evidence.gate).toContainEqual(
      expect.objectContaining({ name: "signals", ok: false, waived: true })
    );
    expect(await runMessages("planner-own-call")).toContainEqual(
      `decision: Writing "Exports", its own call: ${exception}`
    );
  });

  test("the planner's own call stays an idea when Jev is unsure", async () => {
    const exception = "Every engine leaves the brand out of a core question";
    state.act = 0.7;
    state.gaps = [gapRow("Exports")];
    await dailyRun("planner-own-call-unsure", [], (ids) =>
      plannerOutput(ids, { exception })
    );
    expect(opened).toHaveLength(0);
    expect(charges).toHaveLength(0);
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "suggested"
    );
    expect(await runMessages("planner-own-call-unsure")).toContainEqual(
      `decision: Saved "Exports" as an idea: Jev was not sure enough about its own call (${exception})`
    );
  });

  test("a topic people ask about that Jev is unsure of is kept as an idea, not dropped", async () => {
    state.act = 0.7;
    await seedTopic("exports", "Exports", 40);
    await dailyRun("planner-unsure", [exportsPull]);
    expect(opened).toHaveLength(0);
    expect(
      (
        await db.query.autopilotFindings.findFirst({
          where: eq(autopilotFindings.fingerprint, gapFingerprint("Exports")),
        })
      )?.status
    ).toBe("suggested");
    expect(await runMessages("planner-unsure")).toContainEqual(
      'decision: Saved "Exports" as an idea: not sure enough for an automatic pull request'
    );
  });

  const replayBlock = async (
    run: Awaited<ReturnType<typeof dailyRun>>["run"],
    nodeId: string
  ) => {
    const node = Object.values(workflowDefinitions)
      .flatMap((definition) => definition.graph.nodes)
      .find((candidate) => candidate.id === nodeId);
    const block = node ? workflowBlockRegistry.get(node.type) : undefined;
    if (!(node && block)) {
      throw new Error(`No step ${nodeId}`);
    }
    return block.runStep(0, {
      organizationId: "sandbox-org",
      runId: run.runId,
      node: { ...node, kind: block.kind },
      config: resolveReferences(node.config ?? {}, run.scope),
      lastAttempt: false,
      idempotencyKey: `${run.runId}:${nodeId}`,
      state: {},
    });
  };

  test("replayed planning steps open no second PR and write no second commit", async () => {
    await seedTopic("exports", "Exports", 40);
    const { run, observations } = await dailyRun("planner-replay", [
      exportsPull,
    ]);
    expect(opened).toHaveLength(1);
    const commits = memory.commits("sandbox-org").length;
    const ctx = await buildAutopilotRunContext("sandbox-org", "planner-replay");
    const plan = run.state.nodes.plan?.output as AutopilotPlanDecision;
    expect(plan.outcome).toBe("open");
    expect((await decideAutopilotPlan(ctx, observations)).outcome).toBe("skip");
    expect((await replayBlock(run, "write")).status).toBe("halted");
    expect(
      await rememberAutopilotPlan({ ctx, decision: plan, acted: null })
    ).toBe(false);
    expect(opened).toHaveLength(1);
    expect(holds).toHaveLength(1);
    expect(memory.commits("sandbox-org")).toHaveLength(commits);

    // A run that decided to wait is replay-safe through its planner state.
    state.act = 0.5;
    await seedTopic("imports", "Imports", 41);
    const waiting = await dailyRun(
      "planner-replay-wait",
      [importsPull],
      (ids) => plannerOutput(ids, { slug: "imports", title: "Imports" })
    );
    expect(waiting.run.state.nodes.plan?.output).toMatchObject({
      outcome: "wait",
    });
    expect(waiting.run.state.nodes.route?.port).toBe("otherwise");
    const afterWait = memory.commits("sandbox-org").length;
    const waitingCtx = await buildAutopilotRunContext(
      "sandbox-org",
      "planner-replay-wait"
    );
    expect(
      (await decideAutopilotPlan(waitingCtx, waiting.observations)).outcome
    ).toBe("skip");
    expect(memory.commits("sandbox-org")).toHaveLength(afterWait);
    expect(actionEvaluations).toHaveLength(2);
    expect(await runMessages("planner-replay-wait")).toContainEqual(
      "skip: This run already planned"
    );
  });

  test("a failed memory commit after the PR is logged and never redoes the action", async () => {
    await seedTopic("exports", "Exports", 40);
    const before = await readMemory(MEMORY_PATHS.planner);
    state.memoryCommitFailure = true;
    const { run } = await dailyRun("planner-lost-notes", [exportsPull]);
    expect(opened).toHaveLength(1);
    expect(await runMessages("planner-lost-notes")).toContainEqual(
      "error: Could not update the workspace memory"
    );
    expect(await readMemory(MEMORY_PATHS.planner)).toBe(before);
    expect(run.state.nodes.brief?.status).toBe("success");
    state.memoryCommitFailure = false;
    expect(opened).toHaveLength(1);
    expect(charges).toHaveLength(1);
    // The next day the stale notes still think the topic is waiting. Another
    // pull request on the same topic sees the open draft and is not written,
    // nor even kept as an idea.
    await dailyRun("planner-next-day", [
      exportsPull,
      { number: 42, title: "feat: export to CSV" },
    ]);
    expect(opened).toHaveLength(1);
    expect(
      (await db.query.autopilotFindings.findMany()).map(
        (row) => row.fingerprint
      )
    ).toEqual([gapFingerprint("Exports")]);
  });

  test("a failed credit check for a planned draft releases its claim and the next run retries", async () => {
    await seedTopic("exports", "Exports", 40);
    state.billingCrash = true;
    await dailyRun("planner-billing-down", [exportsPull]);
    const failed = await db.query.autopilotFindings.findFirst();
    expect(failed?.status).toBe("failed");
    expect(failed?.claimToken).toBeNull();
    expect(failed?.evidence.failures ?? 0).toBe(0);
    expect(opened).toHaveLength(0);
    expect(release).not.toHaveBeenCalled();
    expect(await runMessages("planner-billing-down")).toContainEqual(
      "error: Could not check the credit balance"
    );
    const firstHold = holds.at(-1);
    state.billingCrash = false;
    await dailyRun("planner-billing-back", [exportsPull]);
    expect(opened).toHaveLength(1);
    expect(charges).toHaveLength(1);
    expect(holds.at(-1)).not.toBe(firstHold);
  });

  test("strangers cannot veto an offer; a linked member's thumbs down dismisses it without closing anything", async () => {
    await handleAutopilotPullRequestEvent(event(1));
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "suggested"
    );
    expect(await syncOfferReactionFeedback("sandbox-org", new Date(0))).toEqual(
      []
    );
    expect(closed).toHaveLength(0);
    state.linkedReaction = true;
    expect(
      await syncOfferReactionFeedback("sandbox-org", new Date(0))
    ).toHaveLength(1);
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "dismissed"
    );
    expect(closed).toHaveLength(0);
    expect(opened).toHaveLength(0);
  });

  test("positive reactions learn and acknowledge once without authorizing a draft; retractions replace feedback", async () => {
    state.confidence = 0.9;
    await handleAutopilotPullRequestEvent(event());
    state.linkedReaction = true;
    state.reactionContent = "+1";
    await syncOfferReactionFeedback("sandbox-org", new Date(0));
    await syncOfferReactionFeedback("sandbox-org", new Date(0));
    expect(opened).toHaveLength(0);
    expect(feedback).toHaveLength(1);
    expect(feedbackAcknowledgments).toHaveLength(1);
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "suggested"
    );
    state.reactionContent = "";
    await syncOfferReactionFeedback("sandbox-org", new Date(0));
    expect(feedback).toHaveLength(2);
    expect(opened).toHaveLength(0);
  });

  test("failed memory after a negative vote retries even after dismissal, without a false acknowledgment", async () => {
    state.confidence = 0.9;
    await handleAutopilotPullRequestEvent(event());
    state.linkedReaction = true;
    state.feedbackFailure = true;
    await expect(
      syncOfferReactionFeedback("sandbox-org", new Date(0))
    ).rejects.toThrow("Could not process feedback");
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "dismissed"
    );
    expect(feedbackAcknowledgments).toHaveLength(0);
    state.feedbackFailure = false;
    // Pending failures must remain discoverable after the normal lookback.
    await syncOfferReactionFeedback("sandbox-org", new Date(Date.now() + 1));
    expect(feedback).toHaveLength(1);
    expect(feedbackAcknowledgments).toHaveLength(1);
    expect(closed).toHaveLength(0);
  });

  test("overlapping reaction syncs lock before GitHub reads and finish with the latest snapshot", async () => {
    state.confidence = 0.9;
    await handleAutopilotPullRequestEvent(event());
    state.linkedReaction = true;
    let startedReading = () => {};
    const reading = new Promise<void>((resolve) => {
      startedReading = resolve;
    });
    let resumeReading = () => {};
    const resume = new Promise<void>((resolve) => {
      resumeReading = resolve;
    });
    readReactions.mockImplementationOnce(async () => {
      const snapshot = [{ content: "-1", user: { id: 42, type: "User" } }];
      startedReading();
      await resume;
      return { data: snapshot };
    });
    const transaction = spyOn(db, "transaction");
    const first = syncOfferReactionFeedback("sandbox-org", new Date(0));
    await reading;
    state.reactionContent = "";
    const second = syncOfferReactionFeedback("sandbox-org", new Date(0));
    try {
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(readReactions).toHaveBeenCalledTimes(1);
    } finally {
      resumeReading();
      await Promise.all([first, second]);
      expect(transaction).toHaveBeenCalledTimes(2);
      transaction.mockRestore();
    }
    expect(readReactions).toHaveBeenCalledTimes(2);
    expect(feedback).toHaveLength(2);
    expect(feedback.at(-1)).toEqual(
      expect.objectContaining({
        text: expect.stringContaining("Current member reactions: []"),
      })
    );
    const finding = await db.query.autopilotFindings.findFirst();
    expect(finding?.status).toBe("dismissed"); // Retraction does not reopen an already processed dismissal.
    expect(finding?.evidence).toEqual(
      expect.objectContaining({
        feedbackReceipt: createHash("sha256").update("[]").digest("hex"),
        feedbackPending: false,
      })
    );
    await Promise.all([
      syncOfferReactionFeedback("sandbox-org", new Date(0)),
      syncOfferReactionFeedback("sandbox-org", new Date(0)),
    ]);
    expect(feedback).toHaveLength(2);
    expect(feedbackAcknowledgments).toHaveLength(2);
    expect(feedbackAcknowledgments.at(-1)).toBe("Offer");
    expect(opened).toHaveLength(0);
  });

  test("directed editorial follow-up learns context without writing or saving a hard rule", async () => {
    state.confidence = 0.9;
    await handleAutopilotPullRequestEvent(event());
    state.mentionIntent = "feedback";
    const context = mentionContext(200);
    context.comment.body = "@notra too technical";
    const response = await handleAutopilotMention(context);
    expect(response?.reply).toContain("contextual feedback");
    expect(feedback).toHaveLength(1);
    expect(opened).toHaveLength(0);
  });

  for (const kind of ["issue", "review"] as const) {
    test(`${kind} feedback prompts share the newest five directed comments in chronological order`, async () => {
      state.confidence = 0.9;
      await handleAutopilotPullRequestEvent(event());
      state.mentionIntent = "feedback";
      const finding = await db.query.autopilotFindings.findFirst();
      const own: GitHubMentionThreadComment = {
        id: 10,
        kind,
        createdAt: "2026-10-21T00:00:00Z",
        threadRootId: kind === "review" ? 1000 : null,
        authorLogin: "sandbox-user",
        authorIsBot: false,
        authorIsTrusted: true,
        body: "@notra older preference",
      };
      const directed = Array.from({ length: 8 }, (_, index) => ({
        ...own,
        id: 10 + index,
        body: `@notra correction ${index}`,
      }));
      threadComments.push(
        { ...own, id: 0, body: "@notra before the offer" },
        ...directed,
        { ...own, id: 30, authorLogin: "another-member" },
        { ...own, id: 31, authorIsBot: true },
        { ...own, id: 32, body: "undirected chatter" },
        { ...own, id: 60, body: "@notra future comment" }
      );
      if (kind === "review") {
        threadComments.push({ ...own, id: 33, threadRootId: 1001 });
        threadComments.reverse(); // GitHub's review endpoint returns newest first.
      }
      const originalOrder = threadComments.map((comment) => comment.id);
      const context = mentionContext(50);
      context.comment.body = "@notra now use the latest correction";
      if (kind === "review") {
        context.comment.review = {
          path: "file.ts",
          line: 1,
          startLine: null,
          commitSha: null,
          diffHunk: null,
          rootCommentId: 1000,
        };
      }
      expect((await handleAutopilotMention(context))?.status).toBe("replied");
      const expected = directed.slice(-5).map((comment) => comment.body);
      expect(JSON.parse(state.feedbackPrompt).priorDirectedComments).toEqual(
        expected
      );
      expect(classificationInputs.at(-1)).toEqual(
        expect.objectContaining({
          state: expect.objectContaining({
            subject: JSON.stringify({
              title: context.pullRequest?.title,
              offer: finding?.evidence.brief,
              prior: expected,
            }),
          }),
        })
      );
      expect(threadComments.map((comment) => comment.id)).toEqual(
        originalOrder
      );
      feedback.length = 0;
      context.comment.edited = true;
      expect(await handleAutopilotMention(context)).toEqual({
        status: "ignored",
        reason: "superseded_feedback_edit",
      });
      expect(feedback).toHaveLength(0);
      expect(opened).toHaveLength(0);
    });
  }

  test("review threads keep independent feedback documents", async () => {
    state.confidence = 0.9;
    await handleAutopilotPullRequestEvent(event());
    state.mentionIntent = "feedback";
    for (const rootCommentId of [100, 200]) {
      const context = mentionContext(rootCommentId + 1);
      context.comment.review = {
        path: "file.ts",
        line: 1,
        startLine: null,
        commitSha: null,
        diffHunk: null,
        rootCommentId,
      };
      await handleAutopilotMention(context);
    }
    expect(feedback).toHaveLength(2);
    expect(
      new Set(feedback.map((row) => (row as { id: string }).id)).size
    ).toBe(2);
  });

  test("delayed comments and older edits cannot overwrite a newer feedback receipt", async () => {
    state.confidence = 0.9;
    await handleAutopilotPullRequestEvent(event());
    const finding = await db.query.autopilotFindings.findFirst();
    if (!finding) {
      throw new Error("Missing finding");
    }
    const applied: number[] = [];
    const write = (id: number, updatedAt: string, fail = false) => {
      const context = mentionContext(id);
      context.comment.updatedAt = updatedAt;
      return applyFeedbackInOrder({
        context,
        findingId: finding.id,
        apply: async () => {
          if (fail) {
            throw new Error("Remote write failed");
          }
          applied.push(id);
        },
      });
    };
    expect(await write(302, "2026-10-21T07:00:00Z")).toBe(true);
    expect(await write(301, "2026-10-21T07:01:00Z")).toBe(false);
    expect(await write(302, "2026-10-21T06:59:00Z")).toBe(false);
    expect(await write(302, "2026-10-21T07:02:00Z")).toBe(true);
    await expect(write(303, "2026-10-21T07:03:00Z", true)).rejects.toThrow();
    expect(await write(303, "2026-10-21T07:03:00Z")).toBe(true);
    expect(applied).toEqual([302, 302, 303]);
  });

  test("members can give contextual feedback but cannot save standing rules or authorize writing", async () => {
    state.confidence = 0.9;
    await handleAutopilotPullRequestEvent(event());
    await db
      .update(members)
      .set({ role: "member" })
      .where(eq(members.organizationId, "sandbox-org"));
    state.mentionIntent = "feedback";
    state.feedbackRule = "Always avoid implementation details";
    const context = mentionContext(201);
    context.comment.body = "@notra always avoid implementation details";
    expect((await handleAutopilotMention(context))?.reply).toContain(
      "Only workspace admins"
    );
    expect(feedback).toHaveLength(1);
    expect(ruleWrites).toHaveLength(0);
    state.mentionIntent = "write";
    expect(
      (await handleAutopilotMention(mentionContext(202)))?.reply
    ).toContain("Only workspace admins");
    expect(opened).toHaveLength(0);
  });

  test("an admin can explicitly save a lasting rule; edited feedback never starts a writer", async () => {
    state.confidence = 0.9;
    await handleAutopilotPullRequestEvent(event());
    state.mentionIntent = "feedback";
    state.feedbackRule = "Always explain the user benefit";
    expect(
      (await handleAutopilotMention(mentionContext(203)))?.reply
    ).toContain("Standing rule saved");
    expect(ruleWrites).toHaveLength(1);
    state.feedbackRule = "";
    state.mentionIntent = "write";
    const edited = mentionContext(204);
    edited.comment.edited = true;
    await handleAutopilotMention(edited);
    expect(opened).toHaveLength(0);
  });

  test("waiting or explicitly requested drafts recheck current hard rules and fail closed on memory errors", async () => {
    state.confidence = 0.9;
    await handleAutopilotPullRequestEvent(event());
    await seedStandingRule("Never write about exports");
    state.blockWrite = true;
    await handleAutopilotMention(mentionContext(205));
    expect(opened).toHaveLength(0);
    expect((await db.query.autopilotFindings.findFirst())?.status).toBe(
      "suggested"
    );
    state.memoryFailure = true;
    await handleAutopilotMention(mentionContext(206));
    expect(opened).toHaveLength(0);
  });

  test("feedback context excludes other people, bots and undirected chatter; ambiguity is not learned", async () => {
    state.confidence = 0.9;
    await handleAutopilotPullRequestEvent(event());
    const own = {
      id: 5,
      kind: "issue" as const,
      createdAt: new Date().toISOString(),
      threadRootId: null,
      authorLogin: "sandbox-user",
      authorIsBot: false,
      authorIsTrusted: true,
      body: "@notra this is for new users",
    };
    threadComments.push(
      own,
      {
        ...own,
        id: 6,
        authorLogin: "someone-else",
        body: "@notra never talk about exports",
      },
      { ...own, id: 7, authorIsBot: true },
      { ...own, id: 8, body: "unrelated participant chatter" }
    );
    state.mentionIntent = "feedback";
    const context = mentionContext(210);
    context.comment.body = "@notra too technical";
    await handleAutopilotMention(context);
    expect(JSON.parse(state.feedbackPrompt).priorDirectedComments).toEqual([
      own.body,
    ]);
    expect(JSON.parse(state.feedbackPrompt).subject).toContain("exports");
    state.ambiguousFeedback = true;
    feedback.length = 0;
    const ambiguous = mentionContext(211);
    ambiguous.comment.body = "@notra not like that";
    await handleAutopilotMention(ambiguous);
    expect(feedback).toHaveLength(0);
    expect(ruleWrites).toHaveLength(0);
    expect(opened).toHaveLength(0);
  });

  test("a failed Slack send marks nothing and the same brief can retry", async () => {
    await askToWrite();
    await db.insert(autopilotRuns).values({
      id: "slack-retry",
      organizationId: "sandbox-org",
      trigger: "manual",
    });
    const ctx = await buildAutopilotRunContext("sandbox-org", "slack-retry");
    state.slackFailure = true;
    expect(
      await deliverAutopilotBrief({ ctx, insights: [], previousRunAt: null })
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
      await deliverAutopilotBrief({ ctx, insights: [], previousRunAt: null })
    ).not.toBeNull();
    // The retry reuses the page the failed attempt wrote.
    expect(
      await db.query.autopilotBriefs.findMany({
        where: eq(autopilotBriefs.runId, ctx.runId),
      })
    ).toHaveLength(1);
    expect(
      (await db.query.autopilotFindings.findFirst())?.evidence.briefed
    ).toEqual(["proposed"]);
    expect(deliveries).toHaveLength(1);
  });

  test("a daily brief records its delivery immediately and a replay does not post again", async () => {
    await askToWrite();
    const finding = await db.query.autopilotFindings.findFirst();
    if (!finding) {
      throw new Error("Expected a proposed draft");
    }
    await db
      .insert(autopilotRuns)
      .values({ id: "daily", organizationId: "sandbox-org", trigger: "cron" });
    const ctx = await buildAutopilotRunContext("sandbox-org", "daily");
    const input = { ctx, insights: [], previousRunAt: null };
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
    await askToWrite();
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
    await askToWrite();
    expect(closed).toEqual([1]);
    const finding = await db.query.autopilotFindings.findFirst();
    expect(finding?.status).toBe("proposed");
    expect(finding?.pullRequestNumber).toBe(99);
    expect(finding?.branch).not.toBe(opened[0]);
  });
}
