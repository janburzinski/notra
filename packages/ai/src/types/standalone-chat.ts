import type { AILogTarget } from "@notra/ai/observability";
import type { StandaloneChatContextItem } from "@notra/ai/schemas/standalone-chat";
import type { ChatSurface } from "@notra/ai/types/chat";
import type { PostAgentReachLoader } from "@notra/ai/types/post-agent-reach";
import type { RouteUsageSummary } from "@notra/ai/types/router";
import type { TccMetadata } from "@notra/ai/types/tcc";
import type { LanguageModelUsage, UIMessage } from "ai";

import type {
  ResolveGranolaIntegrationContext,
  ResolveIntegrationContext,
  ResolveLinearIntegrationContext,
} from "./agents";
import type {
  IntegrationFetchers,
  ToolSet,
  ValidatedIntegration,
} from "./orchestration";

export interface StandaloneChatInput {
  organizationId: string;
  chatId?: string;
  userId?: string;
  messages: UIMessage[];
  projectId?: string | null;
  context?: StandaloneChatContextItem[];
  maxSteps?: number;
  log?: AILogTarget;
  enableThinking?: boolean;
  thinkingLevel?: "off" | "low" | "medium" | "high";
  abortSignal?: AbortSignal;
  timezone?: string;
  telemetryMetadata?: TccMetadata;
  useMarkup?: boolean;
  chargeAiCredits?: boolean;
  codeResearch?: boolean;
  surface?: ChatSurface;
}

export interface StandaloneChatDeps {
  preValidatedIntegrations?: ValidatedIntegration[];
  integrationFetchers?: IntegrationFetchers;
  resolveContext?: ResolveIntegrationContext;
  resolveLinearContext?: ResolveLinearIntegrationContext;
  resolveGranolaContext?: ResolveGranolaIntegrationContext;
  /** Tools the host app adds, such as the dashboard's workflow builder. */
  extraTools?: ToolSet;
  loadPostAgentReach?: PostAgentReachLoader;
  onUsage?: (
    usage: LanguageModelUsage,
    modelId: string,
    routeUsage?: RouteUsageSummary
  ) => void | Promise<void>;
  /**
   * Runs `onUsage` after the stream closes instead of before. The host keeps
   * the request alive until the work settles; without it, usage is recorded
   * before the stream ends.
   */
  deferUsage?: (work: () => Promise<void>) => void;
  onFirstChunk?: () => void;
  log?: AILogTarget;
}

export type { StandaloneChatContextItem } from "@notra/ai/schemas/standalone-chat";
export type { OrchestrateResult } from "./orchestration";
