import type { UIMessage } from "ai";
import type * as z from "zod";

import type { agentQuestionInputSchema } from "@/schemas/agent-questions";

export type AgentQuestion = z.infer<
  typeof agentQuestionInputSchema
>["questions"][number];

/** One question's answers: the options picked, or the user's own words. */
export type AgentQuestionAnswer = string[];

/** A question the agent is waiting on, read from its tool call. */
export interface PendingAgentQuestion {
  toolCallId: string;
  questions: AgentQuestion[];
}

export interface AgentQuestionCardProps {
  /** The questions so far; they stream in, so they can be partial. */
  input: unknown;
  /** The user's answers once given. */
  output: unknown;
  state: string;
}

export interface AgentQuestionDockProps {
  questions: AgentQuestion[];
  onSubmit: (answers: AgentQuestionAnswer[]) => void;
  onDismiss: () => void;
  /** Lifts the dock off the page when it floats over content. */
  elevated?: boolean;
  className?: string;
}

export interface AgentQuestionOptionProps {
  label: string;
  description?: string;
  multiple: boolean;
  picked: boolean;
  shortcut: number;
  onPick: () => void;
  ref?: (element: HTMLElement | null) => void;
}

export interface AgentQuestionMarkProps {
  multiple: boolean;
  picked: boolean;
  number: number;
}

export interface AgentQuestionPaneProps {
  question: AgentQuestion;
  /** Only the shown question is visible; the rest keep the dock's height. */
  active: boolean;
  titleId?: string;
  picked: AgentQuestionAnswer;
  ownAnswer: string;
  ownAnswerOn: boolean;
  onPick: (label: string) => void;
  onToggleOwnAnswer: () => void;
  onChooseOwnAnswer: () => void;
  onOwnAnswerChange: (value: string) => void;
  onOwnAnswerEnter: () => void;
  rowRef?: (index: number, element: HTMLElement | null) => void;
  ownAnswerRef?: (element: HTMLInputElement | null) => void;
}

export interface AgentQuestionProgressProps {
  questions: AgentQuestion[];
  tab: number;
  answered: (index: number) => boolean;
  onGo: (index: number) => void;
}

export interface AgentQuestionFooterProps {
  last: boolean;
  canSubmit: boolean;
  /** Missing on the first question. */
  onBack?: () => void;
  onNext: () => void;
  onDismiss: () => void;
}

/** One part of a chat message, such as text or a tool call. */
export type AgentMessagePart = UIMessage["parts"][number];
