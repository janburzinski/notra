import type { z } from "zod";

import type { buildAutopilotActionEvaluation } from "../prompts/autopilot-planner";
import type { autopilotPlannerOutputSchema } from "../schemas/autopilot-planner";

export type AutopilotSignalSource = "keywords" | "commits";

/**
 * Something a job noticed this run: a content gap, a merged pull request.
 * Observations never act on their own; the planner links them into topics.
 */
export interface AutopilotObservation {
  /** Stable across runs: the finding fingerprint, e.g. commits:acme/app#12. */
  id: string;
  source: AutopilotSignalSource;
  title: string;
  detail: string;
  /** An existing page this would rewrite instead of adding a post. */
  updatePage?: { url: string; title: string } | null;
}

export interface AutopilotTopicSignal {
  observationId: string;
  source: AutopilotSignalSource;
  title: string;
  detail: string;
  runId: string;
  seenAt: string;
}

export type AutopilotTopicStatus =
  | "watching"
  | "researching"
  | "ready"
  | "in_progress"
  | "done"
  | "dismissed";

export interface AutopilotTopic {
  slug: string;
  title: string;
  status: AutopilotTopicStatus;
  summary: string;
  openQuestions: string[];
  /** The condition that would make the topic worth acting on. */
  nextStep: string;
  signals: AutopilotTopicSignal[];
  /** The finding Autopilot opened for this topic, once it acted. */
  findingId: string | null;
  pullRequestUrl: string | null;
  updatedAt: string;
}

export interface AutopilotPlannerState {
  version: 1;
  /** The run that last planned; a replayed step sees its own id and stops. */
  lastRunId: string | null;
  topics: AutopilotTopic[];
}

export interface AutopilotPlannerInput {
  brand: { name: string; about: string; audience: string };
  rules: string[];
  feedback: string[];
  state: AutopilotPlannerState;
  observations: AutopilotObservation[];
  existingPosts: string[];
  /** Drafts and ideas already in flight, so the planner never doubles them. */
  activeWork: { title: string; status: string }[];
  /** How Autopilot's merged posts and page updates did since; empty without data. */
  results?: AutopilotPostResult[];
  /**
   * The brand tracks AI answers or searches, so content gaps are the demand
   * and a topic backed only by pull requests has none. Defaults to true.
   */
  demandTracked?: boolean;
}

/**
 * One merged Autopilot post or page update. Traffic counts cover the last
 * 30 days and are null when the site sends Notra no traffic data, so null
 * means unknown, never zero.
 */
export interface AutopilotPostResult {
  title: string;
  kind: "post" | "update";
  /** The planner topic it was written for, when it came from one. */
  topicSlug: string | null;
  /** The live page path, or the file slug when only that is known. */
  page: string;
  mergedDaysAgo: number;
  aiCrawls: number | null;
  /** AI assistants fetching the page while answering someone. */
  aiAnswerFetches: number | null;
  /** People who clicked through to it from an AI assistant. */
  aiClicks: number | null;
  humanViews: number | null;
  /** AI answers naming the brand for its prompt, or citing the page, before the merge and since. */
  answers: {
    metric: "mentions" | "citations";
    before: number | null;
    after: number | null;
  } | null;
}

export type AutopilotPlannedActionType = "none" | "write_post" | "update_page";

export interface AutopilotPlannedAction {
  type: AutopilotPlannedActionType;
  topicSlug: string | null;
  reason: string;
  brief: { topic: string; angle: string } | null;
  /**
   * Why the planner overrules the default evidence bars (signals, demand).
   * Jev still decides whether it opens or stays an idea.
   */
  exception?: string | null;
}

export interface AutopilotGateCheck {
  name:
    | "action"
    | "signals"
    | "demand"
    | "confidence"
    | "active_work"
    | "budget"
    | "draft_limit";
  ok: boolean;
  detail: string;
  /** Failed, but the planner overruled it with a reason. */
  waived?: boolean;
}

export interface AutopilotGateResult {
  /** Every check passed: Autopilot may open the pull request on its own. */
  open: boolean;
  /**
   * Worth keeping as an idea someone can start: only capacity said no, or the
   * post is likely good but not sure enough, or backed only by shipped work.
   */
  suggest: boolean;
  checks: AutopilotGateCheck[];
}

export type AutopilotPlannerOutput = z.infer<
  typeof autopilotPlannerOutputSchema
>;

export type AutopilotActionEvaluation = ReturnType<
  typeof buildAutopilotActionEvaluation
>;
