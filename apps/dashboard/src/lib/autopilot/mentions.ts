import {
  createGitHubMentionUsageCollector,
  describeGitHubMentionBillingDenial,
  reserveGitHubMentionBilling,
} from "@notra/ai/billing/github-mention-billing";
import { getEvaluationClient } from "@notra/ai/evaluation/client";
import { getGitHubPublishToken } from "@notra/ai/integrations/github-publish-auth";
import type {
  GitHubMentionContext,
  GitHubMentionProcessResult,
} from "@notra/ai/types/github-mention";
import { consumeGitHubMentionRateLimit } from "@notra/ai/utils/github-mention-rate-limit";
import { buildGitHubMentionRateLimitReply } from "@notra/ai/utils/github-mention-reply";
import {
  addGitHubCommentReaction,
  postGitHubIssueComment,
} from "@notra/ai/utils/github-pr-comments";
import { createOctokit } from "@notra/ai/utils/octokit";
import { db } from "@notra/db/drizzle";
import { autopilotSettings, members } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

import {
  AUTOPILOT_BRANCH_PREFIX,
  AUTOPILOT_JEV_MIN_CONFIDENCE,
  AUTOPILOT_JEV_MODEL_ID,
  AUTOPILOT_MENTION_INTENTS,
} from "@/constants/autopilot";
import { settleAutopilotBilling } from "@/lib/autopilot/billing";
import {
  assessPullRequestForPost,
  proposeCommitPost,
  writeFindingPost,
} from "@/lib/autopilot/blog";
import {
  claimFinding,
  claimSuggestedFinding,
  dismissClaimedFinding,
  dismissFinding,
  dismissSuggestedFinding,
  findFindingByFingerprint,
} from "@/lib/autopilot/findings";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { addRule, extractRule } from "@/lib/autopilot/rules";
import {
  buildAutopilotRunContext,
  createItemAutopilotRun,
  finishAutopilotRun,
} from "@/lib/autopilot/run";
import type {
  AutopilotJobResult,
  AutopilotRunContext,
  MergedPullRequest,
} from "@/types/autopilot";
import type { AutopilotLogger } from "@/types/autopilot-runtime";
import { formatAutopilotPercent as percent } from "@/utils/autopilot-events";
import {
  commitFingerprint,
  describeAutopilotDraftLocation,
  toMergedPullRequest,
} from "@/utils/autopilot-github";
import { toErrorMessage } from "@/utils/error-message";

const MENTION_COMMENT_MAX_CHARS = 500;
const MENTION_PATTERN = /@notra\b[,:]?/gi;

/** Jev sorts the comment into assess, write or other; null when unsure or down. */
async function classifyMention(organizationId: string, comment: string) {
  const result = await getEvaluationClient().tryEvaluate({
    feature: "autopilot-mention",
    organizationId,
    modelId: AUTOPILOT_JEV_MODEL_ID,
    state: { comment: comment.slice(0, MENTION_COMMENT_MAX_CHARS) },
    questions: {
      intent: {
        type: "choice",
        instructions:
          "What does this GitHub comment to the Notra bot ask for? It may be in any language.",
        criteria: { ...AUTOPILOT_MENTION_INTENTS },
      },
    },
  });
  if (!result) {
    return null;
  }
  const { choice, probabilities } = result.answers.intent;
  const confidence = probabilities?.[choice] ?? result.confidence.intent ?? 0;
  const intent =
    confidence >= AUTOPILOT_JEV_MIN_CONFIDENCE &&
    (choice === "assess" || choice === "write" || choice === "decline")
      ? choice
      : null;
  return { intent, confidence, probabilities: probabilities ?? {} };
}

/**
 * Answers "@notra is this worth a post?" and "@notra write a post about this"
 * on product pull requests with Autopilot. Returns null to hand the mention to
 * the regular agent: Notra content PRs, other requests, Autopilot off.
 */
async function isWorkspaceAdmin(organizationId: string, userId: string) {
  const member = await db.query.members.findFirst({
    columns: { role: true },
    where: and(
      eq(members.organizationId, organizationId),
      eq(members.userId, userId)
    ),
  });
  return member?.role === "owner" || member?.role === "admin";
}

/** Writes a post for an @notra request; billed like any other mention. */
async function answerWrite(params: {
  context: GitHubMentionContext;
  ctx: AutopilotRunContext;
  log: AutopilotLogger;
  result: AutopilotJobResult;
  pull: MergedPullRequest;
  existing: Awaited<ReturnType<typeof findFindingByFingerprint>>;
}): Promise<{ reply: string; pullRequestUrl: string | null }> {
  const { context, ctx, log, pull, existing } = params;
  if (!ctx.repository) {
    await log.skip("No website repository connected");
    return {
      reply:
        "Connect a website repository in Notra Autopilot settings and I'll draft the post there.",
      pullRequestUrl: null,
    };
  }
  // Writing changes the website repository, so it takes the same role as in the dashboard.
  if (!(await isWorkspaceAdmin(context.organizationId, context.userId))) {
    await log.skip("Only workspace admins can ask for a post", {
      user: context.sender.login,
    });
    return {
      reply:
        "Only workspace admins can ask me to write posts. Ask an admin to reply `@notra write a post` here.",
      pullRequestUrl: null,
    };
  }
  const reservation = await reserveGitHubMentionBilling({
    organizationId: context.organizationId,
    mentionKey: context.deliveryId ?? String(context.comment.id),
  });
  if (!reservation.allowed) {
    await log.skip("No credits left for a mention", {
      reason: reservation.reason ?? null,
    });
    return {
      reply: describeGitHubMentionBillingDenial(reservation),
      pullRequestUrl: null,
    };
  }
  const usage = createGitHubMentionUsageCollector();
  let outcome: Awaited<ReturnType<typeof proposeCommitPost>> | null = null;
  try {
    if (existing?.status === "suggested" && existing.evidence.brief) {
      const claim = await claimSuggestedFinding(
        context.organizationId,
        existing.id,
        ctx.runId
      );
      outcome = claim
        ? await writeFindingPost({
            ctx,
            log,
            claim,
            brief: existing.evidence.brief,
            onFailure: "suggest",
            draftLimit: null,
            onUsage: (next) => usage.add(next),
          })
        : { status: "settled" };
    } else {
      outcome = await proposeCommitPost({
        ctx,
        log,
        result: params.result,
        pull,
        confidence: null,
        onUsage: (next) => usage.add(next),
      });
    }
  } finally {
    // Only an opened pull request is charged; a failed or settled write is free.
    await settleAutopilotBilling({
      reservation,
      usage: usage.get(),
      charge: outcome?.status === "proposed",
      log,
      properties: {
        repository: `${context.owner}/${context.repo}`,
        issue_number: context.issueNumber,
      },
    });
  }
  if (outcome?.status === "proposed") {
    return {
      reply: `Drafted a post about this change${describeAutopilotDraftLocation(outcome.url, false)}\n\nNothing is published until you merge it.`,
      pullRequestUrl: outcome.url,
    };
  }
  if (outcome?.status === "settled") {
    return {
      reply:
        "A post about this pull request is already being written or was dismissed, so I left it alone.",
      pullRequestUrl: null,
    };
  }
  return {
    reply:
      "I couldn't draft the post this time. The run log in Notra Autopilot shows what went wrong.",
    pullRequestUrl: null,
  };
}

/**
 * Answers "@notra is this worth a post?" and "@notra write a post about this"
 * on product pull requests with Autopilot. Returns null to hand the mention to
 * the regular agent: Notra and Autopilot content PRs, other requests,
 * Autopilot off.
 */
export async function handleAutopilotMention(
  context: GitHubMentionContext
): Promise<GitHubMentionProcessResult | null> {
  const pullRequest = context.pullRequest;
  if (
    context.publication ||
    !pullRequest ||
    // Autopilot's own post PRs: edits there belong to the regular agent.
    pullRequest.headRef.startsWith(`${AUTOPILOT_BRANCH_PREFIX}/`)
  ) {
    return null;
  }
  const [available, settings] = await Promise.all([
    isAutopilotEnabledForOrganization(context.organizationId),
    db.query.autopilotSettings.findFirst({
      columns: { enabled: true },
      where: eq(autopilotSettings.organizationId, context.organizationId),
    }),
  ]);
  if (!(available && settings?.enabled)) {
    return null;
  }
  const classified = await classifyMention(
    context.organizationId,
    context.comment.body
  );
  const intent = classified?.intent;
  if (!intent) {
    return null;
  }
  const token = await getGitHubPublishToken(context.integrationId, {
    organizationId: context.organizationId,
  });
  if (!token) {
    return { status: "failed", reason: "github_token_unavailable" };
  }
  const octokit = createOctokit(token);
  const kind = context.comment.review ? "review" : "issue";
  const react = (content: "eyes" | "+1" | "confused") =>
    addGitHubCommentReaction({
      octokit,
      owner: context.owner,
      repo: context.repo,
      commentId: context.comment.id,
      kind,
      content,
    }).catch(() => null);
  const replyWith = async (reply: string, ok: boolean) => {
    await postGitHubIssueComment({
      octokit,
      owner: context.owner,
      repo: context.repo,
      issueNumber: context.issueNumber,
      body: reply,
    });
    await react(ok ? "+1" : "confused");
  };

  const rateLimit = await consumeGitHubMentionRateLimit(context.organizationId);
  if (!rateLimit.allowed) {
    const reply = buildGitHubMentionRateLimitReply(rateLimit.resetAt);
    await replyWith(reply, false);
    return { status: "failed", reason: "rate_limited", reply };
  }
  await react("eyes");

  const runId = await createItemAutopilotRun(context.organizationId, "github");
  const result: AutopilotJobResult = { findingIds: [], insights: [] };
  let reply = "Something went wrong on my side. Try again in a few minutes.";
  let pullRequestUrl: string | null = null;
  let error: string | undefined;
  try {
    const ctx = await buildAutopilotRunContext(context.organizationId, runId);
    const log = createAutopilotLogger(ctx, "commits");
    const pull = toMergedPullRequest(`${context.owner}/${context.repo}`, {
      number: pullRequest.number,
      title: pullRequest.title,
      url: pullRequest.htmlUrl,
      body: pullRequest.body,
    });
    await log.info(
      `@${context.sender.login} asked on ${pull.repository}#${pull.number}`,
      { intent, comment: context.comment.body.slice(0, 200) },
      {
        model: AUTOPILOT_JEV_MODEL_ID,
        intents: AUTOPILOT_MENTION_INTENTS,
        probabilities: classified.probabilities,
        comment: context.comment.body,
      }
    );
    const existing = await findFindingByFingerprint(
      context.organizationId,
      commitFingerprint(pull)
    );
    if (intent === "decline") {
      reply = await answerDecline({ context, ctx, log, pull, existing });
    } else if (
      existing?.pullRequestUrl &&
      (existing.status === "proposed" || existing.status === "merged")
    ) {
      pullRequestUrl = existing.pullRequestUrl;
      reply = `There is already a post about this pull request${describeAutopilotDraftLocation(existing.pullRequestUrl, false)}`;
      await log.skip("A post about this pull request already exists", {
        url: existing.pullRequestUrl,
      });
    } else if (intent === "assess") {
      reply = await answerAssess({ ctx, log, pull });
    } else {
      ({ reply, pullRequestUrl } = await answerWrite({
        context,
        ctx,
        log,
        result,
        pull,
        existing,
      }));
    }
  } catch (failure) {
    error = toErrorMessage(failure, String(failure));
  } finally {
    await finishAutopilotRun({
      organizationId: context.organizationId,
      runId,
      results: [result],
      slackMessageTs: null,
      scheduled: false,
      error,
    });
  }
  await replyWith(
    reply,
    Boolean(pullRequestUrl) ||
      ((intent === "assess" || intent === "decline") && !error)
  );
  return { status: "replied", reply, pullRequestUrl };
}

/**
 * "@notra no": this pull request gets no post (a waiting draft is closed),
 * and when the message states a lasting preference an admin's words become
 * a rule every later decision reads.
 */
async function answerDecline(params: {
  context: GitHubMentionContext;
  ctx: AutopilotRunContext;
  log: AutopilotLogger;
  pull: MergedPullRequest;
  existing: Awaited<ReturnType<typeof findFindingByFingerprint>>;
}) {
  const { context, ctx, log, pull, existing } = params;
  const isAdmin = await isWorkspaceAdmin(
    context.organizationId,
    context.userId
  );
  if (
    existing &&
    existing.status !== "merged" &&
    existing.status !== "dismissed"
  ) {
    // Closing a draft or stopping a writer takes the same role as in the
    // dashboard; anyone linked may still turn down a mere suggestion.
    if (isAdmin) {
      await dismissFinding(context.organizationId, existing.id);
    } else if (
      !(
        existing.status === "suggested" &&
        (await dismissSuggestedFinding(context.organizationId, existing.id))
      )
    ) {
      await log.skip("Only workspace admins can stop a post being written", {
        user: context.sender.login,
        status: existing.status,
      });
      return "Only workspace admins can stop a post that is already being written or waiting for review. Ask an admin to reply `@notra no` here, or dismiss it in Notra Autopilot.";
    }
  } else if (!existing) {
    // Claimed and dismissed, so neither the merge nor the daily run offers it again.
    const claim = await claimFinding(context.organizationId, ctx.runId, {
      kind: "commits",
      fingerprint: commitFingerprint(pull),
      title: `Blog post: ${pull.title}`,
      summary: `${pull.repository}#${pull.number} ${pull.title}`,
      evidence: {
        pullRequests: [
          { number: pull.number, title: pull.title, url: pull.url },
        ],
      },
    });
    if (claim) {
      await dismissClaimedFinding(claim, "Declined on GitHub");
    }
  }
  await log.decision(`@${context.sender.login} declined a post about this`);
  if (!isAdmin) {
    return "Got it, I'll skip this one. Only workspace admins can turn this into a rule for similar changes.";
  }
  const message = context.comment.body.replace(MENTION_PATTERN, "").trim();
  const rule = await extractRule({
    organizationId: context.organizationId,
    message,
    subject: pull.title,
    log,
  });
  if (!rule) {
    return "Got it, I'll skip this one.";
  }
  const saved = await addRule({
    organizationId: context.organizationId,
    text: rule,
    source: "github",
    sourceUrl: context.comment.htmlUrl,
    createdBy: context.sender.login,
  });
  await log.action(`Remembered a rule: ${rule}`, {
    rule,
    status: saved.status,
  });
  if (saved.status === "full") {
    return `Got it, I'll skip this one. I couldn't remember "${rule}" because the workspace already has the maximum number of rules; remove some in Notra Autopilot settings.`;
  }
  if (saved.status === "duplicate") {
    return `Got it, I'll skip this one. I already remember: "${rule}".`;
  }
  return `Got it, I'll skip this one, and I'll remember: "${rule}". You can change this in Notra Autopilot settings.`;
}

async function answerAssess(params: {
  ctx: AutopilotRunContext;
  log: AutopilotLogger;
  pull: MergedPullRequest;
}) {
  const verdict = await assessPullRequestForPost({
    ...params,
    minConfidence: AUTOPILOT_JEV_MIN_CONFIDENCE,
  });
  if (!verdict) {
    return "I couldn't judge this one right now. Try again in a few minutes.";
  }
  // The website repository may be private; this reply is public on GitHub.
  return verdict.worth
    ? `**Worth a post** (${percent(verdict.confidence)} sure). This reads like a change your users would care about. Reply \`@notra write a post\` and I'll open a draft.`
    : `**Probably not worth a post.** It reads like an internal change rather than something users notice. If you disagree, reply \`@notra write a post anyway\`.`;
}
