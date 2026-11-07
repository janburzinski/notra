import type { ChatMessageMetadata } from "@notra/ai/types/chat";
import type { UIMessage } from "ai";
import type { ReactNode } from "react";

export type AssistantActivityStep =
  | "writingResponse"
  | "thinking"
  | "waitingForApproval"
  | "waitingForAnswer"
  | "searchingWeb"
  | "executingTools"
  | "runningTool"
  | "writingDraft";

export interface ChatActivityStatusProps {
  children?: ReactNode;
  seconds: number;
  label?: string;
  active?: boolean;
}

/** A turn that ended on the user: an approval or the agent's questions. */
export type AssistantActivityWaitingStep = Extract<
  AssistantActivityStep,
  "waitingForApproval" | "waitingForAnswer"
>;

export interface ChatActivityGroupProps {
  children: ReactNode;
  /** Shown instead of how long it worked while the agent waits on the user. */
  waitingStep?: AssistantActivityWaitingStep;
  /** Starts open and stays open until the reader folds it. */
  defaultOpen?: boolean;
  durationMs?: number;
  elapsedSeconds?: number;
  forceOpen?: boolean;
  groupId: string;
  hasDetails: boolean;
  isLoading: boolean;
  isStreaming: boolean;
  step: AssistantActivityStep;
}

export interface ChatSearchStackProps {
  items: Array<{
    input: unknown;
    output: unknown;
    state: string;
    toolCallId: string;
  }>;
}

export interface ChatAssistantPartsProps {
  activityTimings?: ChatMessageMetadata["activityTimings"];
  durationMs?: number;
  elapsedSeconds?: number;
  isLoading: boolean;
  isStandaloneTool?: (part: UIMessage["parts"][number]) => boolean;
  /** Identifies effect-only tool elements that mount without splitting activity. */
  isStandalonePartVisible?: (content: ReactNode) => boolean;
  messageId: string;
  parts: UIMessage["parts"];
  renderStandalone: (
    part: UIMessage["parts"][number],
    index: number
  ) => ReactNode;
  renderTool: (part: UIMessage["parts"][number], index: number) => ReactNode;
}

export interface ChatActivityGroupOpenOptions {
  defaultOpen: boolean;
  forceOpen: boolean;
  isLoading: boolean;
  isStreaming: boolean;
}

export interface ChatActivityLabelOptions {
  step: ChatActivityGroupProps["step"];
  waitingStep: ChatActivityGroupProps["waitingStep"];
  isStreaming: boolean;
  durationSeconds: number | null;
}
