import {
  AUTOPILOT_ACTION_JEV_MODEL_ID,
  AUTOPILOT_AUTONOMOUS_PR_BUDGET,
  AUTOPILOT_DAY_MS,
  AUTOPILOT_DISMISSED_TOPIC_REOPEN_DAYS,
  AUTOPILOT_DONE_TOPIC_REOPEN_DAYS,
  AUTOPILOT_PLANNER_MAX_OUTPUT_TOKENS,
  AUTOPILOT_PLANNER_MODEL_ID,
  AUTOPILOT_PLANNER_RETRY_REASONING,
  AUTOPILOT_PLANNER_TIMEOUT_MS,
} from "@notra/ai/constants/autopilot-planner";
import { getEvaluationClient } from "@notra/ai/evaluation/client";
import { planAutopilotRun } from "@notra/ai/jobs/autopilot-planner";
import type {
  AutopilotGateResult,
  AutopilotPlannedAction,
  AutopilotPlannerState,
  AutopilotTopic,
} from "@notra/ai/types/autopilot-planner";
import {
  actionableObservations,
  autonomousPullRequestBudget,
  countIndependentSignals,
  evaluateAutopilotGate,
  fitPlannerState,
  followFinding,
  markTopicActed,
  parsePlannerState,
  renderPlannerState,
  reopenTopic,
  resolveAutopilotOutcome,
  topicHasActiveWork,
} from "@notra/ai/utils/autopilot-planner";
import { MEMORY_PATHS } from "@notra/memory/constants/memory";
import { openMemorySnapshot, updateMemory } from "@notra/memory/memory";

import { listBlogPostPaths } from "@/lib/autopilot/blog";
import {
  countAutonomousProposals,
  countAutonomousTrackRecord,
  countOpenPullRequests,
  listActiveBlogFindings,
  listFindingStatuses,
  syncFindingPullRequests,
} from "@/lib/autopilot/findings";
import { generateAutopilotObject } from "@/lib/autopilot/llm";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import {
  countPostOutcomes,
  updatePostOutcomes,
} from "@/lib/autopilot/outcomes";
import { loadAutopilotResults } from "@/lib/autopilot/results";
import { loadDecisionMemory } from "@/lib/autopilot/rules";
import type {
  AutopilotRunContext,
  AutopilotRunObservation,
} from "@/types/autopilot";
import type {
  AutopilotLogger,
  AutopilotPlanActed,
  AutopilotPlanDecision,
} from "@/types/autopilot-runtime";
import { toErrorMessage } from "@/utils/error-message";

function statusOf(check: AutopilotGateResult["checks"][number]) {
  if (check.ok) {
    return "passed";
  }
  return check.waived ? "waived" : "failed";
}

function describeChecks(checks: AutopilotGateResult["checks"]) {
  return checks.map(
    (check) => `${statusOf(check)} ${check.name}: ${check.detail}`
  );
}

function ideaReason(
  gate: AutopilotGateResult,
  confidence: number | null,
  exception: string | null
) {
  const failed = new Set(
    gate.checks
      .filter((check) => !(check.ok || check.waived))
      .map((check) => check.name)
  );
  if (exception && failed.has("confidence")) {
    return `Jev was not sure enough about its own call (${exception})`;
  }
  if (failed.has("confidence")) {
    return confidence === null
      ? "Jev was unavailable"
      : "not sure enough for an automatic pull request";
  }
  if (failed.has("demand")) {
    return "nobody is asking about it yet";
  }
  return "no room for an automatic pull request";
}

function closedBefore(at: Date | null, fallback: string, days: number) {
  return (
    (at ?? new Date(fallback)).getTime() < Date.now() - days * AUTOPILOT_DAY_MS
  );
}

/**
 * Topics follow their finding once Autopilot acted on them. A dismissed or
 * merged one watches again once its window has passed.
 */
async function syncTopicsWithFindings(
  organizationId: string,
  state: AutopilotPlannerState
): Promise<AutopilotPlannerState> {
  const linked = state.topics.flatMap((topic) =>
    topic.findingId ? [topic.findingId] : []
  );
  const findings = new Map(
    (await listFindingStatuses(organizationId, linked)).map((row) => [
      row.id,
      row,
    ])
  );
  return {
    ...state,
    topics: state.topics.map((topic): AutopilotTopic => {
      const finding = topic.findingId ? findings.get(topic.findingId) : null;
      if (!(topic.findingId && finding)) {
        return topic.findingId
          ? { ...topic, findingId: null, status: "watching" }
          : topic;
      }
      const pullRequestUrl = finding.pullRequestUrl ?? topic.pullRequestUrl;
      switch (finding.status) {
        case "merged":
          return closedBefore(
            finding.mergedAt,
            topic.updatedAt,
            AUTOPILOT_DONE_TOPIC_REOPEN_DAYS
          )
            ? reopenTopic(topic)
            : followFinding(topic, { status: "done", pullRequestUrl });
        case "dismissed":
          return closedBefore(
            finding.dismissedAt,
            topic.updatedAt,
            AUTOPILOT_DISMISSED_TOPIC_REOPEN_DAYS
          )
            ? reopenTopic(topic)
            : followFinding(topic, { status: "dismissed", pullRequestUrl });
        case "suggested":
          return followFinding(topic, { status: "ready", pullRequestUrl });
        case "open":
        case "proposed":
          return followFinding(topic, {
            status: "in_progress",
            pullRequestUrl,
          });
        default:
          // Failed, expired or closed without a change: watch it again.
          return { ...topic, status: "watching", findingId: null };
      }
    }),
  };
}

/**
 * The observation from this run that becomes the finding: the newest one the
 * action may be built from (see actionableObservations). Without one there is
 * nothing to act on.
 */
function primaryObservation(
  topic: AutopilotTopic,
  observations: readonly AutopilotRunObservation[],
  action: AutopilotPlannedAction["type"]
) {
  return (
    actionableObservations({ type: action }, topic, observations)[0] ?? null
  );
}

/**
 * Pull requests from this run linked to a gap topic. They are not what the
 * post is about; they tell the writer what the product really does now.
 */
function shippedFacts(
  topic: AutopilotTopic,
  observations: readonly AutopilotRunObservation[],
  primary: AutopilotRunObservation
) {
  const ids = new Set(topic.signals.map((signal) => signal.observationId));
  return observations.filter(
    (row) =>
      row.id !== primary.id && row.source === "commits" && ids.has(row.id)
  );
}

async function writePlannerMemory(params: {
  ctx: AutopilotRunContext;
  log: AutopilotLogger;
  state: AutopilotPlannerState;
}) {
  const { ctx, log } = params;
  const files = {
    [MEMORY_PATHS.planner]: renderPlannerState(fitPlannerState(params.state)),
  };
  try {
    const result = await updateMemory({
      organizationId: ctx.organizationId,
      actor: "autopilot-run",
      message: `Autopilot run ${ctx.runId}`,
      mutate: async () => files,
    });
    await log.action("Updated the workspace memory", {
      commit: result.sha,
      changed: result.changed,
      overSoftLimit: result.overSoftLimit,
    });
  } catch (error) {
    // The plan already happened; a lost memory write must never redo it.
    await log.error("Could not update the workspace memory", {
      error: toErrorMessage(error, String(error)),
    });
  }
}

export async function decideAutopilotPlan(
  ctx: AutopilotRunContext,
  observations: AutopilotRunObservation[]
): Promise<AutopilotPlanDecision> {
  const log = createAutopilotLogger(ctx, null);
  if (!ctx.repository) {
    return { outcome: "skip", memory: null };
  }
  const snapshot = await openMemorySnapshot(ctx.organizationId);
  const [decisionMemory, plannerFile] = await Promise.all([
    loadDecisionMemory(ctx.organizationId),
    snapshot.read(MEMORY_PATHS.planner),
  ]);
  const stored = parsePlannerState(plannerFile);
  if (stored.lastRunId === ctx.runId) {
    await log.skip("This run already planned");
    return { outcome: "skip", memory: null };
  }
  if (observations.length === 0 && stored.topics.length === 0) {
    await log.skip("Nothing observed and no open topics to plan");
    return { outcome: "skip", memory: null };
  }
  await syncFindingPullRequests(ctx.organizationId);
  // Acting needs something seen this run, so without observations the model
  // has nothing to decide: only follow the findings the topics point at.
  if (observations.length === 0) {
    await log.skip("Nothing observed this run");
    return {
      outcome: "wait",
      memory: {
        ...(await syncTopicsWithFindings(ctx.organizationId, stored)),
        lastRunId: ctx.runId,
      },
    };
  }
  // Before the results and the budget read them; failing only leaves the
  // saved verdicts a day older.
  await updatePostOutcomes(ctx).catch(async (error: unknown) => {
    await log.info("Could not measure earlier posts", {
      error: toErrorMessage(error, "unknown error"),
    });
  });
  const trackRecordSince = new Date(
    Date.now() -
      AUTOPILOT_AUTONOMOUS_PR_BUDGET.trackRecordDays * AUTOPILOT_DAY_MS
  );
  const [
    synced,
    existingPosts,
    activeWork,
    openPullRequests,
    autonomous,
    trackRecord,
    outcomes,
    results,
  ] = await Promise.all([
    syncTopicsWithFindings(ctx.organizationId, stored),
    listBlogPostPaths(ctx),
    listActiveBlogFindings(ctx.organizationId),
    countOpenPullRequests(ctx.organizationId),
    countAutonomousProposals(
      ctx.organizationId,
      new Date(
        Date.now() - AUTOPILOT_AUTONOMOUS_PR_BUDGET.days * AUTOPILOT_DAY_MS
      )
    ),
    countAutonomousTrackRecord(ctx.organizationId, trackRecordSince),
    countPostOutcomes(ctx.organizationId, trackRecordSince),
    // Only ranks ready topics, so a failure plans without it.
    loadAutopilotResults(ctx).catch(async (error: unknown) => {
      await log.info("Could not read how earlier posts did", {
        error: toErrorMessage(error, "unknown error"),
      });
      return [];
    }),
  ]);
  const input = {
    brand: {
      name: ctx.brand?.name ?? "",
      about: ctx.brand?.description ?? "",
      audience: ctx.brand?.audience ?? "",
    },
    rules: decisionMemory.rules,
    feedback: decisionMemory.feedback,
    state: synced,
    observations: observations.map(
      ({ id, source, title, detail, updatePage, sustained }) => ({
        id,
        source,
        title,
        detail,
        updatePage: updatePage ?? null,
        ...(sustained ? { sustained: true } : {}),
      })
    ),
    existingPosts,
    activeWork: activeWork.map((row) => ({
      title: row.title,
      status: row.status,
    })),
    results,
    // Content gaps are read only for a GEO project with the gaps job on.
    demandTracked: Boolean(ctx.projectId && ctx.jobs.keywords),
  };
  if (results.length > 0) {
    await log.decision(
      `Read how ${results.length} earlier ${results.length === 1 ? "post" : "posts"} did`,
      {
        results: results.map(
          (result) =>
            `${result.page}: ${result.outcome ?? "update"}, ${result.aiCitations ?? "?"} AI citations, ${result.aiAnswerFetches ?? "?"} AI answer fetches, ${result.aiClicks ?? "?"} AI clicks, ${result.humanViews ?? "?"} views`
        ),
      }
    );
  }

  const plan = await planAutopilotRun({
    input,
    runId: ctx.runId,
    now: new Date(),
    generate: (call) =>
      generateAutopilotObject({
        organizationId: ctx.organizationId,
        modelId: AUTOPILOT_PLANNER_MODEL_ID,
        tag: "planner",
        log,
        schema: call.schema,
        instructions: call.instructions,
        prompt: call.prompt,
        maxOutputTokens: AUTOPILOT_PLANNER_MAX_OUTPUT_TOKENS,
        timeoutMs: AUTOPILOT_PLANNER_TIMEOUT_MS,
        retryReasoning: AUTOPILOT_PLANNER_RETRY_REASONING,
      }),
    evaluate: async (evaluation) => {
      const verdict = await getEvaluationClient().tryEvaluate({
        feature: "autopilot-action",
        organizationId: ctx.organizationId,
        modelId: AUTOPILOT_ACTION_JEV_MODEL_ID,
        state: evaluation.state,
        questions: evaluation.questions,
      });
      return verdict?.answers.act.probabilities ?? null;
    },
  });

  const linked = plan.state.topics.filter((topic) =>
    topic.signals.some((signal) => signal.runId === ctx.runId)
  );
  await log.decision(
    `Linked ${observations.length} observations into ${linked.length} topics`,
    {
      model: AUTOPILOT_PLANNER_MODEL_ID,
      memory: decisionMemory.sha,
      topics: linked.map(
        (topic) =>
          `${topic.title}: ${topic.status}, ${topic.signals.length} signals`
      ),
    }
  );

  const gate = evaluateAutopilotGate({
    action: plan.action,
    topic: plan.topic,
    actionConfidence: plan.actionConfidence,
    // By the finding the topic points at, or one that names the topic: a
    // crash before the memory write must not let the next run act twice.
    activeWork: plan.topic ? topicHasActiveWork(plan.topic, activeWork) : false,
    autonomousPullRequestsInWindow: autonomous,
    autonomousPullRequestBudget: autonomousPullRequestBudget({
      ...trackRecord,
      ...outcomes,
    }),
    draftSlotsFree: openPullRequests < ctx.maxOpenPullRequests,
    demandTracked: input.demandTracked,
    now: new Date(),
  });
  const outcome = resolveAutopilotOutcome({
    action: plan.action,
    topic: plan.topic,
    gate,
    observations,
  });
  const observation = plan.topic
    ? primaryObservation(plan.topic, observations, plan.action.type)
    : null;
  if (plan.action.type === "none" || !plan.topic) {
    await log.decision(`Waiting: ${plan.action.reason}`, {
      reason: plan.action.reason,
    });
    return { outcome: "wait", memory: plan.state };
  }
  if (!(outcome && observation)) {
    // resolveAutopilotOutcome and primaryObservation agree: no outcome
    // without a usable observation from this run.
    await log.decision(`Not acting on "${plan.topic.title}" yet`, {
      reason: plan.action.reason,
      checks: describeChecks(gate.checks),
      failed: gate.checks
        .filter((check) => !check.ok)
        .map((check) => check.name),
      ...(gate.open || gate.suggest
        ? {
            observation:
              plan.action.type === "update_page"
                ? "Nothing seen this run names the page to update"
                : "Nothing seen this run to act on",
          }
        : {}),
    });
    return { outcome: "wait", memory: plan.state };
  }
  const { topic, action } = plan;
  await log.decision(
    outcome === "open"
      ? `Writing "${action.brief?.topic ?? topic.title}"${action.exception ? `, its own call: ${action.exception}` : ""}`
      : `Saved "${action.brief?.topic ?? topic.title}" as an idea: ${ideaReason(gate, plan.actionConfidence, action.exception ?? null)}`,
    {
      reason: action.reason,
      ...(action.exception ? { exception: action.exception } : {}),
      confidence: plan.actionConfidence,
      checks: describeChecks(gate.checks),
    }
  );
  const shipped = shippedFacts(topic, observations, observation);
  const others = topic.signals
    .filter(
      (signal) =>
        signal.observationId !== observation.id &&
        !shipped.some((row) => row.id === signal.observationId)
    )
    .map((signal) => `- ${signal.detail}`)
    .join("\n");
  const pullRequests = [
    ...(observation.proposal.evidence.pullRequests ?? []),
    ...shipped.flatMap((row) => row.proposal.evidence.pullRequests ?? []),
  ];
  return {
    outcome,
    memory: plan.state,
    topicSlug: topic.slug,
    confidence: plan.actionConfidence,
    proposal: {
      ...observation.proposal,
      // A post is named after the planner's brief, not the observation
      // that triggered it; an update keeps the page it names.
      title:
        action.type === "write_post"
          ? `Blog post: ${action.brief?.topic ?? topic.title}`
          : observation.proposal.title,
      evidence: {
        ...observation.proposal.evidence,
        ...(action.type === "update_page" ? {} : { updatePage: null }),
        ...(action.exception ? { exception: action.exception } : {}),
        // The shipped work behind the answer: shown as sources and its
        // authors are asked to review the facts.
        ...(pullRequests.length > 0 ? { pullRequests } : {}),
        topic: {
          slug: topic.slug,
          title: topic.title,
          signals: countIndependentSignals(topic),
        },
        gate: gate.checks,
      },
    },
    brief: {
      topic: action.brief?.topic ?? observation.brief.topic,
      angle: action.brief?.angle ?? observation.brief.angle,
      evidence: [
        observation.brief.evidence,
        shipped.length > 0
          ? `What the product does now, from shipped work. Use it as facts for the answer, not as the subject of the post:\n\n${shipped.map((row) => row.brief.evidence).join("\n\n---\n\n")}`
          : "",
        others ? `Related signals:\n${others}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  };
}

export async function rememberAutopilotPlan(params: {
  ctx: AutopilotRunContext;
  decision: AutopilotPlanDecision;
  acted: AutopilotPlanActed | null;
}) {
  const { ctx, decision } = params;
  if (!decision.memory) {
    return false;
  }
  const log = createAutopilotLogger(ctx, null);
  const snapshot = await openMemorySnapshot(ctx.organizationId);
  const stored = parsePlannerState(await snapshot.read(MEMORY_PATHS.planner));
  if (stored.lastRunId === ctx.runId) {
    return false;
  }
  const state =
    params.acted && "topicSlug" in decision
      ? markTopicActed(decision.memory, decision.topicSlug, params.acted)
      : decision.memory;
  await writePlannerMemory({ ctx, log, state });
  return true;
}
