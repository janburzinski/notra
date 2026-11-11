import "@/workflows/runtime";
import { flushLogs } from "@notra/ai/evlog";
import type {
  GitHubMentionContext,
  GitHubMentionProcessResult,
} from "@notra/ai/types/github-mention";
import {
  claimGitHubMentionDelivery,
  completeGitHubMentionDelivery,
} from "@notra/ai/utils/github-mention-delivery";
import {
  buildAcceptedMentionWebhookLog,
  buildMentionResultWebhookLog,
} from "@notra/ai/utils/github-mention-log";
import { processGitHubMention } from "@notra/ai/utils/github-mention-process";

import { AUTOPILOT_BRANCH_PREFIX } from "@/constants/autopilot";
import { advanceFindingHeadSha } from "@/lib/autopilot/findings";
import { handleAutopilotMention } from "@/lib/autopilot/mentions";
import { writeMentionWebhookLog } from "@/lib/webhooks/github-mention-log";
import { startContentPublicationSyncRepair } from "@/lib/workflows/start";

export async function claimGitHubMentionStep(
  context: GitHubMentionContext,
  runId: string
) {
  "use step";
  if (!context.deliveryId) {
    throw new Error("GitHub mention delivery ID is required");
  }
  return await claimGitHubMentionDelivery(context.deliveryId, runId);
}

export async function processGitHubMentionStep(context: GitHubMentionContext) {
  "use step";
  await writeMentionWebhookLog(
    buildAcceptedMentionWebhookLog(context),
    context.deliveryId
  );
  // Content questions on product PRs go to Autopilot; everything else to the agent.
  const autopilot = await handleAutopilotMention(context);
  if (autopilot) {
    return autopilot;
  }
  if (context.comment.edited) {
    return { status: "ignored" as const, reason: "edited_feedback_only" };
  }
  const result = await processGitHubMention(
    context,
    startContentPublicationSyncRepair
  );
  const pull = context.pullRequest;
  if (
    result.status === "committed" &&
    result.commitSha &&
    pull &&
    context.destination.mode === "same_pull_request" &&
    pull.headRef.startsWith(AUTOPILOT_BRANCH_PREFIX)
  ) {
    await advanceFindingHeadSha({
      organizationId: context.organizationId,
      repository: `${context.owner}/${context.repo}`,
      pullRequestNumber: pull.number,
      branch: pull.headRef,
      fromSha: context.destination.headSha ?? pull.headSha,
      toSha: result.commitSha,
    }).catch(() => undefined);
  }
  return result;
}

processGitHubMentionStep.maxRetries = 0;

export async function completeGitHubMentionStep(
  context: GitHubMentionContext,
  runId: string
) {
  "use step";
  if (!context.deliveryId) {
    throw new Error("GitHub mention delivery ID is required");
  }
  await completeGitHubMentionDelivery(context.deliveryId, runId);
}

export async function logGitHubMentionResultStep(
  context: GitHubMentionContext,
  result: GitHubMentionProcessResult,
  durationMs: number
) {
  "use step";
  await writeMentionWebhookLog(
    buildMentionResultWebhookLog({ context, result, durationMs }),
    context.deliveryId
  );
  await flushLogs().catch(() => undefined);
}
