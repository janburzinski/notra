import {
  AUTOPILOT_ACTION_IDEA_CONFIDENCE,
  AUTOPILOT_ACTION_MIN_CONFIDENCE,
  AUTOPILOT_AUTONOMOUS_PR_BUDGET,
  AUTOPILOT_PLANNER_FILE_MAX_BYTES,
  AUTOPILOT_DAY_MS,
  AUTOPILOT_DEMAND_MAX_AGE_DAYS,
  AUTOPILOT_FOLLOWED_TOPIC_NEXT_STEP,
  AUTOPILOT_PLANNER_STATE_BLOCK,
  AUTOPILOT_PLANNER_STATE_FENCE,
  AUTOPILOT_SIGNAL_DETAIL_MAX_CHARS,
  AUTOPILOT_TOPIC_MAX_SIGNALS,
  AUTOPILOT_TOPIC_MIN_SIGNALS,
  AUTOPILOT_TOPIC_SLUG_EDGE_DASHES,
  AUTOPILOT_TOPIC_SLUG_SEPARATORS,
  AUTOPILOT_TOPIC_STALE_DAYS,
  AUTOPILOT_TRIMMED_SIGNAL_DETAIL_CHARS,
} from "../constants/autopilot-planner";
import type {
  AutopilotGateCheck,
  AutopilotGateResult,
  AutopilotObservation,
  AutopilotPlannedAction,
  AutopilotPlannerOutput,
  AutopilotPlannerState,
  AutopilotTopic,
} from "../types/autopilot-planner";

export const EMPTY_PLANNER_STATE: AutopilotPlannerState = {
  version: 1,
  lastRunId: null,
  topics: [],
};

export function topicSlug(title: string) {
  return (
    title
      .toLowerCase()
      .replace(AUTOPILOT_TOPIC_SLUG_SEPARATORS, "-")
      .replace(AUTOPILOT_TOPIC_SLUG_EDGE_DASHES, "")
      .slice(0, 60) || "topic"
  );
}

/** The JSON block is the source of truth; the prose above it is for people. */
export function parsePlannerState(
  markdown: string | null
): AutopilotPlannerState {
  // The last block: prose above it can never pose as state.
  const start =
    markdown?.lastIndexOf(`\`\`\`json ${AUTOPILOT_PLANNER_STATE_FENCE}\n`) ??
    -1;
  const json =
    markdown && start >= 0
      ? AUTOPILOT_PLANNER_STATE_BLOCK.exec(markdown.slice(start))?.[1]
      : null;
  if (!json) {
    return EMPTY_PLANNER_STATE;
  }
  try {
    const value = JSON.parse(json) as Partial<AutopilotPlannerState>;
    return {
      version: 1,
      lastRunId: typeof value.lastRunId === "string" ? value.lastRunId : null,
      // Topics written before nextStep existed read back with an empty one.
      topics: Array.isArray(value.topics)
        ? value.topics.map((topic) => ({
            ...topic,
            nextStep: topic.nextStep ?? "",
          }))
        : [],
    };
  } catch {
    return EMPTY_PLANNER_STATE;
  }
}

/** Model-written text cannot open a code fence in planner.md. */
function plannerProse(text: string) {
  return text.replaceAll("```", "'''");
}

export function renderPlannerState(state: AutopilotPlannerState) {
  const active = state.topics.filter(
    (topic) => topic.status !== "done" && topic.status !== "dismissed"
  );
  const shown = new Set(active);
  const closed = state.topics.filter((topic) => !shown.has(topic));
  const sections = active.map((topic) =>
    [
      `## ${plannerProse(topic.title)} (${topic.status.replace("_", " ")})`,
      plannerProse(topic.summary),
      topic.openQuestions.length
        ? `Open questions:\n${topic.openQuestions.map((question) => `- ${plannerProse(question)}`).join("\n")}`
        : "",
      topic.nextStep ? `Next step: ${plannerProse(topic.nextStep)}` : "",
      `Signals:\n${topic.signals
        .map(
          (signal) =>
            `- ${signal.seenAt.slice(0, 10)} · ${signal.source} · ${plannerProse(signal.title)}`
        )
        .join("\n")}`,
      topic.pullRequestUrl ? `Pull request: ${topic.pullRequestUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
  );
  const done = closed.length
    ? `## Closed\n\n${closed
        .map(
          (topic) =>
            `- ${plannerProse(topic.title)}: ${topic.status}${topic.pullRequestUrl ? ` (${topic.pullRequestUrl})` : ""}`
        )
        .join("\n")}`
    : "";
  return `${[
    "# Planner",
    "Topics Autopilot is following across runs. Written by Autopilot; the JSON block at the end is what it reads back.",
    ...sections,
    done,
    `\`\`\`json ${AUTOPILOT_PLANNER_STATE_FENCE}\n${JSON.stringify(state)}\n\`\`\``,
  ]
    .filter(Boolean)
    .join("\n\n")}\n`;
}

/**
 * Distinct observations. A gap or pull request seen again on a later run is
 * still one signal: the job simply saw it again.
 */
export function countIndependentSignals(topic: AutopilotTopic) {
  return new Set(topic.signals.map((signal) => signal.observationId)).size;
}

/** A draft, a write or an idea already exists for this topic. */
export function topicHasActiveWork(
  topic: AutopilotTopic,
  activeWork: readonly { topicSlug: string | null }[]
) {
  return (
    topic.status === "in_progress" ||
    activeWork.some((row) => row.topicSlug === topic.slug)
  );
}

/**
 * The observations from this run an action on this topic may be built from,
 * newest signal first. A page update needs one that names the page. A topic
 * people ask about is written from the gap, never from the pull request next
 * to it: the gap carries the question and the target the post is measured by,
 * the pull request only the product facts.
 */
export function actionableObservations<T extends AutopilotObservation>(
  action: Pick<AutopilotPlannedAction, "type">,
  topic: AutopilotTopic,
  observations: readonly T[]
): T[] {
  const byId = new Map(observations.map((row) => [row.id, row]));
  const ofTopic = [...topic.signals]
    .reverse()
    .flatMap((signal) => {
      const row = byId.get(signal.observationId);
      return row ? [row] : [];
    })
    .filter((row, index, rows) => rows.indexOf(row) === index);
  if (action.type === "update_page") {
    return ofTopic.filter((row) => row.updatePage);
  }
  const hasDemand = topic.signals.some(
    (signal) => signal.source === "keywords"
  );
  return hasDemand
    ? ofTopic.filter((row) => row.source === "keywords")
    : ofTopic;
}

/**
 * What the run does with the gate's verdict. It acts only on a topic that
 * something seen this run belongs to, so the finding has fresh evidence; a
 * page update also needs one of those observations to name the page.
 */
export function resolveAutopilotOutcome(params: {
  action: AutopilotPlannedAction;
  topic: AutopilotTopic | null;
  gate: AutopilotGateResult;
  observations: readonly AutopilotObservation[];
}): "open" | "suggest" | null {
  const { action, topic, gate } = params;
  if (action.type === "none" || !topic) {
    return null;
  }
  if (actionableObservations(action, topic, params.observations).length === 0) {
    return null;
  }
  if (gate.open) {
    return "open";
  }
  return gate.suggest ? "suggest" : null;
}

/** A topic moved to the status of its finding, with a next step to match. */
export function followFinding(
  topic: AutopilotTopic,
  update: {
    status: keyof typeof AUTOPILOT_FOLLOWED_TOPIC_NEXT_STEP;
    findingId?: string | null;
    pullRequestUrl: string | null;
  }
): AutopilotTopic {
  return {
    ...topic,
    ...update,
    nextStep: AUTOPILOT_FOLLOWED_TOPIC_NEXT_STEP[update.status],
  };
}

export function reopenTopic(topic: AutopilotTopic): AutopilotTopic {
  return {
    ...topic,
    status: "watching",
    findingId: null,
    pullRequestUrl: null,
    nextStep: "",
  };
}

/** Points the topic at what the run opened for it. */
export function markTopicActed(
  state: AutopilotPlannerState,
  slug: string,
  acted: {
    findingId: string;
    status: "in_progress" | "ready";
    pullRequestUrl: string | null;
  }
): AutopilotPlannerState {
  return {
    ...state,
    topics: state.topics.map((topic) =>
      topic.slug === slug ? followFinding(topic, acted) : topic
    ),
  };
}

/**
 * Keeps planner.md under its limit: first shorter signal details, then the
 * oldest closed topics, then the oldest saved ideas, then the oldest topics
 * nothing was opened for.
 */
export function fitPlannerState(
  state: AutopilotPlannerState
): AutopilotPlannerState {
  const size = (value: AutopilotPlannerState) =>
    new TextEncoder().encode(renderPlannerState(value)).length;
  if (size(state) <= AUTOPILOT_PLANNER_FILE_MAX_BYTES) {
    return state;
  }
  let fitted: AutopilotPlannerState = {
    ...state,
    topics: state.topics.map((topic) => ({
      ...topic,
      signals: topic.signals.map((signal) => ({
        ...signal,
        detail: signal.detail.slice(0, AUTOPILOT_TRIMMED_SIGNAL_DETAIL_CHARS),
      })),
    })),
  };
  const byAge = (a: AutopilotTopic, b: AutopilotTopic) =>
    a.updatedAt.localeCompare(b.updatedAt);
  const closed = (topic: AutopilotTopic) =>
    topic.status === "done" || topic.status === "dismissed";
  const removable = [
    ...fitted.topics.filter(closed).sort(byAge),
    ...fitted.topics
      .filter((topic) => topic.status === "ready" && topic.findingId !== null)
      .sort(byAge),
    ...fitted.topics
      .filter((topic) => topic.findingId === null && !closed(topic))
      .sort(byAge),
  ];
  for (const topic of removable) {
    if (size(fitted) <= AUTOPILOT_PLANNER_FILE_MAX_BYTES) {
      break;
    }
    fitted = {
      ...fitted,
      topics: fitted.topics.filter((row) => row.slug !== topic.slug),
    };
  }
  return fitted;
}

/**
 * Applies the planner's output. Only code adds evidence: the model picks a
 * topic per observation, but a signal exists only for an observation this run
 * really made, so a hallucinated id can never make a topic look riper.
 */
export function applyPlannerOutput(params: {
  state: AutopilotPlannerState;
  output: AutopilotPlannerOutput;
  observations: readonly AutopilotObservation[];
  runId: string;
  now: Date;
}): { state: AutopilotPlannerState; action: AutopilotPlannedAction } {
  const { output, runId, now } = params;
  const at = now.toISOString();
  const topics = new Map(
    params.state.topics.map((topic) => [topic.slug, structuredClone(topic)])
  );
  // Topics are named by slug, or by title, compared in slug form so case and
  // punctuation never miss.
  const byTitle = new Map(
    params.state.topics.map((topic) => [topicSlug(topic.title), topic.slug])
  );
  const find = (slugOrTitle: string | null) => {
    if (!slugOrTitle || topics.has(slugOrTitle)) {
      return slugOrTitle;
    }
    const key = topicSlug(slugOrTitle);
    return topics.has(key) ? key : (byTitle.get(key) ?? null);
  };
  /** An existing topic, or a new one under the slug the model chose for it. */
  const resolve = (slug: string | null, title: string | null) => {
    const existing = find(slug) ?? find(title);
    if (existing) {
      return existing;
    }
    const name = (title ?? slug ?? "").trim();
    // A skipped observation has no slug: name its topic after the title, or
    // every skipped observation would land on the same placeholder slug.
    const base = topicSlug(slug?.trim() || name);
    if (!(name && base)) {
      return null;
    }
    topics.set(base, {
      slug: base,
      title: name,
      status: "watching",
      summary: "",
      openQuestions: [],
      nextStep: "",
      signals: [],
      findingId: null,
      pullRequestUrl: null,
      updatedAt: at,
    });
    byTitle.set(topicSlug(name), base);
    return base;
  };

  /** One signal per observation: seeing it again only refreshes it. */
  const addSignal = (
    topic: AutopilotTopic,
    observation: AutopilotObservation
  ) => {
    const signal = {
      observationId: observation.id,
      source: observation.source,
      title: observation.title,
      detail: observation.detail.slice(0, AUTOPILOT_SIGNAL_DETAIL_MAX_CHARS),
      runId,
      seenAt: at,
    };
    topic.signals = [
      ...topic.signals.filter((row) => row.observationId !== observation.id),
      signal,
    ].slice(-AUTOPILOT_TOPIC_MAX_SIGNALS);
    topic.updatedAt = at;
  };

  const observations = new Map(params.observations.map((row) => [row.id, row]));
  const assigned = new Set<string>();
  /** Topics that got an observation they had never seen: new evidence. */
  const freshEvidence = new Set<string>();
  for (const assignment of output.assignments) {
    const observation = observations.get(assignment.observationId);
    if (!observation || assigned.has(observation.id)) {
      continue;
    }
    const slug = resolve(
      assignment.topicSlug,
      assignment.newTopicTitle ?? observation.title
    );
    const topic = slug ? topics.get(slug) : undefined;
    if (!topic) {
      continue;
    }
    assigned.add(observation.id);
    if (
      !topic.signals.some((signal) => signal.observationId === observation.id)
    ) {
      freshEvidence.add(topic.slug);
    }
    addSignal(topic, observation);
  }
  // Nothing is silently lost: an observation the model skipped stays with the
  // topic that already holds it, or gets its own.
  for (const observation of params.observations) {
    if (assigned.has(observation.id)) {
      continue;
    }
    const holder = [...topics.values()].find((topic) =>
      topic.signals.some((signal) => signal.observationId === observation.id)
    );
    const slug = holder?.slug ?? resolve(null, observation.title);
    const topic = slug ? topics.get(slug) : undefined;
    if (topic) {
      addSignal(topic, observation);
    }
  }

  for (const update of output.topics) {
    const slug = find(update.slug);
    const topic = slug ? topics.get(slug) : undefined;
    // In-progress and closed topics follow their finding, not the model. A
    // dismissed topic comes back only with new evidence from this run.
    if (
      !topic ||
      topic.status === "in_progress" ||
      topic.status === "done" ||
      (topic.status === "dismissed" && !freshEvidence.has(topic.slug))
    ) {
      continue;
    }
    topic.status = update.status;
    topic.summary = update.summary;
    topic.openQuestions = update.openQuestions.slice(0, 5);
    topic.nextStep = update.nextStep;
    topic.updatedAt = at;
  }

  const staleBefore =
    now.getTime() - AUTOPILOT_TOPIC_STALE_DAYS * AUTOPILOT_DAY_MS;
  const kept = [...topics.values()].filter(
    (topic) =>
      topic.findingId !== null ||
      new Date(topic.updatedAt).getTime() >= staleBefore
  );

  const actionSlug =
    output.action.type === "none" ? null : find(output.action.topicSlug);
  return {
    state: { version: 1, lastRunId: runId, topics: kept },
    action:
      output.action.type === "none" || !actionSlug || !output.action.brief
        ? {
            type: "none",
            topicSlug: null,
            reason:
              output.action.type !== "none" && !actionSlug
                ? `Unknown topic "${output.action.topicSlug}": ${output.action.reason}`
                : output.action.reason,
            brief: null,
          }
        : {
            type: output.action.type,
            topicSlug: actionSlug,
            reason: output.action.reason,
            brief: output.action.brief,
          },
  };
}

/**
 * Whether Autopilot may open a pull request on its own. Every check must
 * pass; when only capacity or an unavailable Jev blocks it, the action is
 * kept as an idea.
 */
export function evaluateAutopilotGate(params: {
  action: AutopilotPlannedAction;
  topic: AutopilotTopic | null;
  /** Jev's probability that this exact action should happen now; null if Jev is down. */
  actionConfidence: number | null;
  /** A draft, a write or an idea already exists for this topic. */
  activeWork: boolean;
  autonomousPullRequestsInWindow: number;
  draftSlotsFree: boolean;
  /**
   * The workspace tracks AI answers or searches, so a topic nobody asks about
   * is known to have no demand. Without that data, shipped work is the only
   * signal and a confident post about it may still become an idea.
   */
  demandTracked: boolean;
  now: Date;
}): AutopilotGateResult {
  const { action, topic } = params;
  const signals = topic ? countIndependentSignals(topic) : 0;
  // AI answers or searches that miss the brand, seen lately; merged pull
  // requests alone only show that something shipped, not that anyone wants
  // to read about it, and a gap the brand has since closed is no demand.
  const demandSince =
    params.now.getTime() - AUTOPILOT_DEMAND_MAX_AGE_DAYS * AUTOPILOT_DAY_MS;
  const demand =
    topic?.signals.some(
      (signal) =>
        signal.source === "keywords" &&
        new Date(signal.seenAt).getTime() >= demandSince
    ) ?? false;
  // A merged or dismissed topic is never reopened on the model's word alone.
  const closed = topic?.status === "done" || topic?.status === "dismissed";
  let demandDetail = "Only shipped pull requests, nobody asking for it yet";
  if (demand) {
    demandDetail = "AI answers or searches show people look for this";
  } else if (params.demandTracked) {
    demandDetail =
      "Only shipped pull requests: no tracked answer or search asks for it";
  }
  let actionDetail = `${action.type} for ${topic?.title ?? "an unknown topic"}`;
  if (action.type === "none") {
    actionDetail = "The planner chose to wait";
  } else if (closed) {
    actionDetail = `${topic?.title} is already ${topic?.status}`;
  }
  const checks: AutopilotGateCheck[] = [
    {
      name: "action",
      ok: action.type !== "none" && topic !== null && !closed,
      detail: actionDetail,
    },
    {
      name: "signals",
      ok: signals >= AUTOPILOT_TOPIC_MIN_SIGNALS,
      detail: `${signals} of ${AUTOPILOT_TOPIC_MIN_SIGNALS} independent signals`,
    },
    {
      name: "demand",
      ok: demand,
      detail: demandDetail,
    },
    {
      name: "confidence",
      ok:
        params.actionConfidence !== null &&
        params.actionConfidence >= AUTOPILOT_ACTION_MIN_CONFIDENCE,
      detail:
        params.actionConfidence === null
          ? "Jev was unavailable"
          : `${Math.round(params.actionConfidence * 100)}% for this action (needs ${Math.round(AUTOPILOT_ACTION_MIN_CONFIDENCE * 100)}%)`,
    },
    {
      name: "active_work",
      ok: !params.activeWork,
      detail: params.activeWork
        ? "Something is already open for this topic"
        : "Nothing open for this topic",
    },
    {
      name: "budget",
      ok:
        params.autonomousPullRequestsInWindow <
        AUTOPILOT_AUTONOMOUS_PR_BUDGET.count,
      detail: `${params.autonomousPullRequestsInWindow} of ${AUTOPILOT_AUTONOMOUS_PR_BUDGET.count} automatic pull requests in the last ${AUTOPILOT_AUTONOMOUS_PR_BUDGET.days} days`,
    },
    {
      name: "draft_limit",
      ok: params.draftSlotsFree,
      detail: params.draftSlotsFree
        ? "A draft slot is free"
        : "The open pull request limit is reached",
    },
  ];
  const failed = checks.filter((check) => !check.ok).map((check) => check.name);
  const confidence = params.actionConfidence;
  // Unsure about a post people ask for: an idea beats nothing. Without
  // demand only a confident post becomes an idea.
  const ideaConfidence =
    confidence === null ||
    (demand && confidence >= AUTOPILOT_ACTION_IDEA_CONFIDENCE);
  return {
    open: failed.length === 0,
    suggest:
      failed.length > 0 &&
      failed.every(
        (name) =>
          name === "budget" ||
          name === "draft_limit" ||
          // Where answers and searches are tracked, a post nobody asks for
          // helps neither, so it is not even an idea.
          (name === "demand" && !params.demandTracked) ||
          (name === "confidence" && ideaConfidence)
      ),
    checks,
  };
}
