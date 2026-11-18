import type { AutopilotApprovals } from "@notra/db/types/autopilot";
import type { InferRouterOutputs } from "@orpc/server";
import type { ReactNode, RefObject } from "react";

import type { AUTOPILOT_ONBOARDING_GOAL_IDS } from "@/constants/autopilot-onboarding";
import type { DashboardRouter } from "@/lib/orpc/router";
import type { AgentQuestion } from "@/types/agent-questions";
import type { AutopilotOverview } from "@/types/autopilot";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";

export type AutopilotOnboardingGoalId =
  (typeof AUTOPILOT_ONBOARDING_GOAL_IDS)[number];

/** What Ollie made of an answer in the team's own words. */
export type AutopilotOnboardingTurn =
  InferRouterOutputs<DashboardRouter>["autopilot"]["onboardingTurn"];

/** An answer Ollie couldn't use, and what he said; the question comes again. */
interface AutopilotOnboardingAside {
  answer: string;
  reply: string;
}

/** The answers so far; the conversation is rebuilt from them after a redirect. */
export interface AutopilotOnboardingAnswers {
  intro?: AutopilotOnboardingIntro;
  goal?: { goals: AutopilotOnboardingGoalId[]; text: string };
  about?: AutopilotOnboardingAbout;
  repository?: string;
  approvals?: AutopilotApprovals;
  /** Null skips the brief in Slack. */
  slack?: { id: string; name: string } | null;
  /** What was answered to each question, as shown back; null if dismissed. */
  asked?: Partial<Record<AutopilotOnboardingQuestionId, string[] | null>>;
  /** Ollie's own reply to an answer in the team's words, instead of the stock one. */
  replies?: Partial<Record<AutopilotOnboardingQuestionId, string>>;
  asides?: Partial<
    Record<AutopilotOnboardingQuestionId, AutopilotOnboardingAside[]>
  >;
  /** Automations the conversation turned on or off, over what the goals pick. */
  jobs?: Partial<Record<AutopilotAutomationKind, boolean>>;
  /** Always/never instructions, saved as Autopilot rules. */
  rules?: string[];
  /** Context for every run, kept in Autopilot's memory with the goal. */
  notes?: string[];
  /**
   * Answers Ollie took from what's already set up (the only repository, or a
   * saved setup turned back on): he says them instead of asking.
   */
  known?: Partial<Record<AutopilotOnboardingQuestionId, true>>;
}

export type AutopilotOnboardingQuestionId =
  | "goal"
  | "audience"
  | "voice"
  | "rival"
  | "repository"
  | "approvals"
  | "slack";

/** What Ollie read up on before saying hello. */
export type AutopilotOnboardingIntro =
  InferRouterOutputs<DashboardRouter>["autopilot"]["onboardingIntro"];

/** Who the team writes for, how it sounds, who to beat; null when not said. */
export interface AutopilotOnboardingAbout {
  audience: string | null;
  voice: string | null;
  rival: string | null;
}

/** Ollie's lines, and your answers shown as the chat's question cards. */
export type AutopilotOnboardingMessage =
  | { id: string; from: "ollie"; text: string }
  | {
      id: string;
      from: "you";
      question: AgentQuestion;
      /** Null when the question was dismissed. */
      answers: string[] | null;
    };

export type AutopilotOnboardingStep =
  | {
      kind: "question";
      id: AutopilotOnboardingQuestionId;
      question: AgentQuestion;
      /** Skipping picks the default answer. */
      skippable: boolean;
    }
  | {
      kind: "about";
      /** One card with a tab per question, like the agent asks several. */
      ids: AutopilotOnboardingQuestionId[];
      questions: AgentQuestion[];
    }
  | { kind: "connect-github" }
  | { kind: "waiting" }
  | { kind: "setup" };

export interface AutopilotOnboardingRepository {
  fullName: string;
  pushedAt: string | null;
}

export interface AutopilotOnboardingChannel {
  id: string;
  name: string;
}

export interface AutopilotOnboardingContext {
  githubConnected: boolean;
  /** Null while they load. */
  repositories: AutopilotOnboardingRepository[] | null;
  /** They couldn't be loaded; the chat offers a retry. */
  repositoriesFailed: boolean;
  slackConnected: boolean;
  /** Connected Slack's channels have loaded, or failed to. */
  channelsLoaded: boolean;
  channels: AutopilotOnboardingChannel[];
  defaultChannelId: string | null;
}

type AutopilotSetupTaskStatus =
  | "pending"
  | "running"
  | "done"
  | "warning"
  | "error";

export interface AutopilotSetupTask {
  id: "save" | "data" | "run";
  label: string;
  status: AutopilotSetupTaskStatus;
  details: string[];
}

/** chat → setup → done → docking (the chat fades, the input stays as the dock). */
export type AutopilotOnboardingPhase = "chat" | "setup" | "done" | "docking";

/** Ollie's chat as it stands, kept while you look at another page. */
export interface AutopilotOnboardingSession {
  /** Null until read from the session after mount. */
  answers: AutopilotOnboardingAnswers | null;
  thinking: boolean;
  /** Your answer while Ollie reads it, so it shows before his reply does. */
  pending: {
    id: AutopilotOnboardingQuestionId;
    question: AgentQuestion;
    text: string;
  } | null;
  /** Replies the model took its time over show without another pause. */
  thought: ReadonlySet<string>;
  phase: AutopilotOnboardingPhase;
  tasks: AutopilotSetupTask[];
  /** An answer is with the model; a second submit waits. */
  asking: boolean;
  /** The intro is being fetched; coming back doesn't fetch it again. */
  readingUp: boolean;
  /** The setup is running; coming back doesn't start it again. */
  settingUp: boolean;
  /** Resolves once the dashboard behind the chat has its data. */
  refreshed: Promise<unknown>;
}

export type OllieMood = "idle" | "talking" | "thinking" | "working" | "happy";

export interface OllieProps {
  mood: OllieMood;
  /** False holds still, e.g. an older avatar in a chat. */
  animated?: boolean;
  className?: string;
}

export interface AutopilotOnboardingProps {
  organizationId: string;
  organizationSlug: string;
  overview: AutopilotOverview;
  projectId: string | null;
  basePath: string;
  onDone: () => void;
  /** The chat starts to end: the dashboard behind it rises in. */
  onReveal: () => void;
}

export interface OllieGuideProps {
  mood: OllieMood;
  /** The chat is ending: he swims into the agent dock and pops. */
  diving?: boolean;
  /** The chat section: Ollie lines up with the last line said in it. */
  containerRef: RefObject<HTMLElement | null>;
}

export interface AutopilotRevealProps {
  /** Under Ollie's chat: kept out of sight until it ends. */
  hidden: boolean;
  /** Its place in the stagger. */
  index: number;
  className?: string;
  children: ReactNode;
}

export interface AutopilotPausedProps {
  organizationId: string;
  settings: AutopilotOverview["settings"];
  canManage: boolean;
}

export interface AutopilotFooterSwapProps {
  /** Changes when the contents are something else, e.g. the next question. */
  swapKey: string;
  children: ReactNode;
}

export interface AutopilotSetupProgressProps {
  tasks: AutopilotSetupTask[];
  onRetry: (() => void) | null;
  /** Everything ran: the panel says so and shines once. */
  finished: boolean;
}
