import type { IconSvgElement } from "@hugeicons/react";
import type { RouteUsageStep } from "@notra/ai/types/router";
import type { WORKFLOW_RUN_STATUSES } from "@notra/db/constants/workflows";
import type { autopilotWorkflows } from "@notra/db/schema";
import type { Database } from "@notra/db/types/database";
import type { AutopilotWorkflowSchedule } from "@notra/db/types/workflows";
import type { StoredWorkflowGraph } from "@notra/workflows/types/graph";
import type { WorkflowValidationIssue } from "@notra/workflows/types/run";
import type { DynamicToolUIPart, LanguageModelUsage, ToolUIPart } from "ai";
import type { ReactNode } from "react";

import type {
  AgentQuestionAnswer,
  PendingAgentQuestion,
} from "@/types/agent-questions";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import type { ChatSuggestion } from "@/types/components/chat-suggestions";
import type {
  WorkflowRunView,
  WorkflowRunViewNode,
} from "@/types/workflow-engine";

export interface AutopilotWorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  schedule: AutopilotWorkflowSchedule | null;
  lastRunAt: Date | null;
  updatedAt: Date;
  stepCount: number;
}

export interface AutopilotWorkflowRunSummary {
  id: string;
  status: (typeof WORKFLOW_RUN_STATUSES)[number];
  trigger: string;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

export interface AutopilotWorkflowDetail extends AutopilotWorkflowSummary {
  view: WorkflowRunView;
  issues: WorkflowValidationIssue[];
  /** The most recent runs. */
  runs: AutopilotWorkflowRunSummary[];
  /** Every run so far, which can be more than `runs` holds. */
  runCount: number;
}

export interface AutopilotWorkflowAgentResult<Result> {
  result: Result;
  usage: LanguageModelUsage;
  steps: readonly RouteUsageStep[];
}

export interface AutopilotWorkflowAgentPromptParams {
  title: string;
  /** The step's saved text, with its {{…}} placeholders. */
  template: unknown;
  /** The same text with earlier output filled in. */
  resolved: string;
}

export interface AutopilotWorkflowAgentCall {
  organizationId: string;
  tag: string;
  instructions: string;
  prompt: string;
}

export type AutopilotWorkflowRow = typeof autopilotWorkflows.$inferSelect;

export type SaveAutopilotWorkflowResult =
  | { ok: true; workflowId: string; created: boolean; warning?: string }
  | { ok: false; issues: string[] };

export interface AutopilotWorkflowPageClientProps {
  organizationSlug: string;
  workflowId: string;
}

export interface AutopilotWorkflowRunsTableProps {
  runs: AutopilotWorkflowRunSummary[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
}

export interface AutopilotWorkflowStep {
  node: WorkflowRunViewNode;
  condition: string | null;
}

export interface AutopilotWorkflowStepProps {
  step: AutopilotWorkflowStep;
  last: boolean;
  showStatus: boolean;
}

export interface AutopilotWorkflowStepDetailsProps {
  title: string;
  output: string | null;
  settings: NonNullable<AutopilotWorkflowStep["node"]["settings"]>;
}

export interface AutopilotWorkflowStepsProps {
  /** The steps to show: the workflow itself, or one of its runs. */
  view: WorkflowRunView;
  /** The workflow's own view, which carries each step's settings. */
  settingsView: WorkflowRunView;
  showStatus: boolean;
}

export interface AutopilotWorkflowStepToggleProps {
  label: string;
  /** Names the step too, since every step has the same toggles. */
  stepTitle: string;
  /** The id of the panel it opens. */
  controls: string;
  open: boolean;
  onClick: () => void;
}

/** Where a workflow the agent is writing stands. */
export type AutopilotWorkflowDraftStatus =
  | "drafting"
  | "awaiting-approval"
  | "saving"
  | "saved"
  | "needs-fixes"
  | "discarded"
  | "failed";

/** The agent's save call, as the chat holds it. */
export type AutopilotWorkflowDraftPart = ToolUIPart | DynamicToolUIPart;

/** A workflow as the agent writes it, read from its save call. */
export interface AutopilotWorkflowDraft {
  toolCallId: string;
  /** Set while the save waits for the user's approval. */
  approvalId: string | null;
  /** The saved workflow it changes; null for a new one. */
  workflowId: string | null;
  /** A change to a saved workflow rather than a new one. */
  isChange: boolean;
  name: string | null;
  description: string | null;
  schedule: AutopilotWorkflowSchedule | null;
  view: WorkflowRunView;
  status: AutopilotWorkflowDraftStatus;
  /** Where the saved workflow lives in the dashboard. */
  path: string | null;
  issues: string[];
}

export interface AutopilotWorkflowDraftPreviewProps {
  draft: AutopilotWorkflowDraft;
  /** Saves the workflow the agent proposed; set while it waits for approval. */
  onApprove?: () => void;
  onDeny?: () => void;
  /**
   * `compact` is one line, for saves that were replaced or shown elsewhere;
   * `inline` sits in the chat; `panel` fills the full-screen preview.
   */
  variant: "compact" | "inline" | "panel";
}

export interface AutopilotAgentDockProps {
  organizationId: string;
  organizationSlug: string;
  /** Off the Autopilot pages, or while the agent sidebar is open. */
  hidden: boolean;
}

export interface AutopilotWorkflowDraftCanvasProps {
  draft: AutopilotWorkflowDraft;
  className?: string;
}

export interface AutopilotWorkflowDraftSummaryProps {
  draft: AutopilotWorkflowDraft;
  showDescription: boolean;
  /** Off while the actions below show the status next to Save. */
  showStatus: boolean;
}

export interface AutopilotWorkflowDraftIssuesProps {
  issues: string[];
}

export interface AutopilotWorkflowOpenLinkProps {
  path: string;
}

export interface AutopilotWorkflowDraftStatusProps {
  status: AutopilotWorkflowDraftStatus;
  isChange?: boolean;
}

export interface AutopilotWorkflowDraftActionsProps {
  status: AutopilotWorkflowDraftStatus;
  isChange: boolean;
  onApprove: () => void;
  onDeny: () => void;
}

export interface AutopilotWorkflowDraftToolsOptions {
  /** The save the full preview is for; earlier ones show as one line. */
  latestToolCallId: string | null;
  /** One line for every save, when the full preview sits beside the chat. */
  compactAll?: boolean;
}

/** How much of the Autopilot agent dock shows: the input, the chat, or all of it. */
export type AutopilotAgentDockMode = "collapsed" | "open" | "fullscreen";

export interface AutopilotWorkflowLoaderProps {
  canManage: boolean;
  organizationId: string;
  organizationSlug: string;
  workflowId: string;
}

export interface AutopilotWorkflowPageProps extends Omit<
  AutopilotWorkflowLoaderProps,
  "workflowId"
> {
  workflow: AutopilotWorkflowDetail;
}

/** The workflow whose page the user is on, as the agent hears about it. */
export interface AutopilotWorkflowFocus {
  workflow: AutopilotWorkflowDetail;
  definition: {
    graph: StoredWorkflowGraph;
    schedule: AutopilotWorkflowSchedule | null;
  };
  path: string | null;
}

/** One difference between a saved workflow and the change the agent proposes. */
export type AutopilotWorkflowChange =
  | { kind: "schedule"; from: string; to: string }
  | { kind: "name"; from: string; to: string }
  | { kind: "description" }
  | {
      kind: "added" | "removed" | "changed" | "rewired";
      /** The step's id, unique where titles may not be. */
      id: string;
      title: string;
    };

export interface AutopilotWorkflowSavedVersion {
  name: string;
  description: string | null;
  schedule: AutopilotWorkflowSchedule | null;
  view: Pick<WorkflowRunView, "nodes" | "edges">;
}

export interface AutopilotWorkflowDraftChangesProps {
  draft: AutopilotWorkflowDraft;
}

/** The parts of Autopilot's settings that say whether a built-in automation runs. */
export interface AutopilotAutomationFocusSettings {
  enabled: boolean;
  jobs: Partial<Record<string, boolean>>;
  briefHour: number;
  timezone: string;
}

/** What the Autopilot dock's conversation is about, from the page it's on. */
export interface AutopilotAgentDockFocus {
  focusWorkflow: Pick<AutopilotWorkflowSummary, "name"> | undefined;
  focusAutomation: AutopilotAutomationKind | null;
}

export interface AutopilotAgentDockChip {
  name: string;
  icon: IconSvgElement;
}

export interface AutopilotWorkflowCompactDraftProps {
  draft: AutopilotWorkflowDraftPreviewProps["draft"];
  actions: ReactNode;
}

export interface AutopilotWorkflowDraftCanvasSlotProps {
  draft: AutopilotWorkflowDraftPreviewProps["draft"];
  /** In the dock's full-screen panel, where it fills the rest. */
  panel: boolean;
}

export interface AutopilotWorkflowRunErrorProps {
  run: AutopilotWorkflowRunSummary | undefined;
}

export interface AutopilotWorkflowRunCaptionProps {
  run: AutopilotWorkflowRunSummary | undefined;
  latest: boolean;
  changedSinceRun: boolean;
}

export interface AutopilotWorkflowActionsProps {
  /** False while it has issues or a run is going. */
  canRun: boolean;
  running: boolean;
  onRun: () => void;
  onDelete: () => void;
}

export interface AutopilotAgentDockFocusChipProps {
  focus: AutopilotAgentDockChip;
  onRemove: () => void;
}

export interface AutopilotAgentDockSuggestionsProps {
  disabled: boolean;
  hidden: boolean;
  onSelect: (prompt: string) => void;
  suggestions: ChatSuggestion[];
}

export interface AutopilotAgentDockHeaderProps {
  fullscreen: boolean;
  onNewChat: () => void;
  onToggleFullscreen: () => void;
  onMinimize: () => void;
}

export interface AutopilotAgentDockPreviewProps {
  draft: AutopilotWorkflowDraft | null;
  onApprove: (approvalId: string) => void;
  onDeny: (approvalId: string) => void;
}

export interface AutopilotAgentDockInputProps {
  fullscreen: boolean;
  pendingQuestion: PendingAgentQuestion | null;
  /** Floating on its own, the questions lift off the page like the input. */
  questionsElevated: boolean;
  onAnswer: (toolCallId: string, answers: AgentQuestionAnswer[]) => void;
  onDismissQuestion: (toolCallId: string) => void;
  children: ReactNode;
}

export type AutopilotWorkflowTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export interface AutopilotWorkflowSchedulePlanInput {
  workflowId: string;
  /** The schedule the workflow has, if any. */
  storedScheduleId: string | null;
  /** When it should run, or null for no schedule. */
  cron: string | null;
}

export type AutopilotWorkflowSchedulePlan =
  | { action: "create"; cron: string; scheduleId: string }
  | { action: "remove"; scheduleId: string }
  | { action: "none" };

/** Switching a workflow's schedule on or off. */
export interface AutopilotWorkflowEnabledInput {
  workflowId: string;
  enabled: boolean;
}
