import type { AGENT_SURFACES } from "@notra/ai/constants/agent";
import type { agentStreamEventSchema } from "@notra/schemas/dashboard/agent";
import type { z } from "zod";

export type AgentSurface = (typeof AGENT_SURFACES)[number];

export interface AgentSessionScope {
  organizationId: string;
  userId?: string;
  chatId?: string;
  surface: AgentSurface;
  contentId?: string;
  collectionId?: string;
  contentType?: string;
  autoPublish?: boolean;
  useMarkup?: boolean;
  chargeAiCredits?: boolean;
  voiceId?: string;
  brandAgentType?: string;
  sourceMetadata?: object;
  generationConfig?: object;
  codeResearch?: boolean;
}

export interface StartAgentSessionInput {
  scope: AgentSessionScope;
  message: string;
  outputSchema?: Record<string, unknown>;
}

export interface StartAgentSessionResult {
  agentSessionId: string;
  eveSessionId: string;
}

export interface AgentTaskRunResult {
  eveSessionId: string;
  output: unknown;
}

export type AgentTaskStreamResult =
  | { output: unknown }
  | { failed: string }
  | null;

export type AgentStreamEvent = z.infer<typeof agentStreamEventSchema>;
