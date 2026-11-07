import type { ChatAttachment } from "@notra/ai/types/chat";
import type { ReactNode } from "react";

export type RightPanelId = "agent" | "content" | "preview";

export interface AgentPanelPrompt {
  id: number;
  text: string;
  attachments?: ChatAttachment[];
}

/** A composer that takes drafted text, such as the dock or the sidebar's input. */
export type AgentDraftTarget = (text: string) => void;

export interface AgentPromptOptions {
  attachments?: ChatAttachment[];
}

export interface RightPanelContextValue {
  active: RightPanelId | null;
  expanded: boolean;
  hasOpened: Record<RightPanelId, boolean>;
  openPanel: (id: RightPanelId) => void;
  closePanel: (id?: RightPanelId) => void;
  togglePanel: (id: RightPanelId) => void;
  toggleExpanded: () => void;
  /** A message for the agent to send once its panel is open. */
  agentPrompt: AgentPanelPrompt | null;
  askAgent: (text: string, options?: AgentPromptOptions) => void;
  takeAgentPrompt: (id: number) => void;
  /** Puts text in whichever agent composer is showing, to finish and send. */
  draftAgentPrompt: (text: string) => void;
  /** Lets a showing composer take drafts; returns how to stop. */
  registerAgentDraftTarget: (target: AgentDraftTarget) => () => void;
}

export interface RightPanelProps {
  id: RightPanelId;
  children: ReactNode;
  /** `wide` docks at reading width for document previews. */
  size?: "default" | "wide";
}
