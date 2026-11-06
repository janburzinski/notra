import { CHAT_MODEL_ID } from "@notra/ai/constants/models";
import { createModel } from "@notra/ai/model";
import { getContentEditorChatPrompt } from "@notra/ai/prompts/content-editor";
import { withRouterDefaults } from "@notra/ai/provider-options";
import type {
  OrchestrateDeps,
  OrchestrateInput,
  OrchestrateResult,
  RoutingResult,
} from "@notra/ai/types/orchestration";
import {
  prepareChatFileAttachments,
  replaceMissingFileAttachments,
} from "@notra/ai/utils/message-attachments";
import { summarizeRouteUsage } from "@notra/ai/utils/route-usage";
import { logError } from "@notra/ai/utils/server-log";
import { buildTelemetryOptions } from "@notra/ai/utils/tcc";
import { convertToModelMessages, isStepCount, streamText } from "ai";

import {
  hasEnabledGitHubIntegration,
  hasEnabledLinearIntegration,
  validateIntegrations,
} from "./integration-validator";
import { getThinkingProviderOptions } from "./thinking";
import {
  buildToolSet,
  getLinearContextFromIntegrations,
  getRepoContextFromIntegrations,
} from "./tool-registry";

export async function orchestrateChat(
  input: OrchestrateInput,
  deps?: OrchestrateDeps
): Promise<OrchestrateResult> {
  const {
    organizationId,
    messages,
    currentMarkdown,
    contentType,
    currentPostId,
    userId,
    imageContext,
    useMarkup,
    chargeAiCredits,
    selection,
    context = [],
    maxSteps = 1,
    abortSignal,
    log: inputLog,
    timezone,
    telemetryMetadata,
    documentMode,
    thinkingLevel = "low",
  } = input;

  const log = deps?.log ?? inputLog;

  const validatedIntegrations = await validateIntegrations(
    organizationId,
    context,
    deps?.integrationFetchers
  );

  const hasGitHub = hasEnabledGitHubIntegration(validatedIntegrations);
  const hasLinear = hasEnabledLinearIntegration(validatedIntegrations);

  const messagesWithAttachments = await replaceMissingFileAttachments(
    organizationId,
    messages,
    abortSignal
  );
  const messagesForModel = await prepareChatFileAttachments(
    messagesWithAttachments,
    abortSignal
  );
  const routingDecision: RoutingResult = {
    model: CHAT_MODEL_ID,
    thinkingLevel,
    complexity: "complex",
    requiresTools: true,
    reasoning: "Chat always uses GLM 5.3 Flash",
  };

  const model = createModel(organizationId, routingDecision.model, log);

  const { tools, descriptions } = buildToolSet(
    {
      organizationId,
      currentMarkdown,
      contentType,
      currentPostId,
      userId,
      imageContext,
      useMarkup,
      chargeAiCredits,
      validatedIntegrations,
    },
    {
      resolveContext: deps?.resolveContext,
      resolveLinearContext: deps?.resolveLinearContext,
    }
  );

  const repoContext = getRepoContextFromIntegrations(validatedIntegrations);
  const linearContext = getLinearContextFromIntegrations(validatedIntegrations);

  const systemPrompt = getContentEditorChatPrompt({
    selection,
    contentType,
    imageContext,
    documentMode,
    repoContext,
    linearContext,
    toolDescriptions: descriptions,
    hasGitHubEnabled: hasGitHub,
    hasLinearEnabled: hasLinear,
    timezone,
  });

  let firstChunkFired = false;

  const thinkingProviderOptions = getThinkingProviderOptions(
    routingDecision.model,
    true,
    thinkingLevel
  );
  const stream = streamText({
    model,
    instructions: systemPrompt,
    messages: await convertToModelMessages(messagesForModel, {
      tools,
      ignoreIncompleteToolCalls: true,
    }),
    tools,
    stopWhen: isStepCount(maxSteps),
    abortSignal,
    providerOptions: withRouterDefaults(
      {
        ...thinkingProviderOptions,
        gateway: { tags: ["content-chat"] },
      },
      {
        modelId: routingDecision.model,
      }
    ),
    ...buildTelemetryOptions(telemetryMetadata),
    onChunk({ chunk }) {
      if (firstChunkFired) {
        return;
      }
      if (chunk.type === "text-delta" || chunk.type === "reasoning-delta") {
        firstChunkFired = true;
        deps?.onFirstChunk?.();
      }
    },
    async onEnd({ usage, steps }) {
      await deps?.onUsage?.(
        usage,
        routingDecision.model,
        await summarizeRouteUsage(steps, routingDecision.model)
      );
    },
    onError({ error }) {
      logError("[Chat] Stream failed", error, {
        organizationId,
        model: routingDecision.model,
      });
    },
  });

  return { stream, routingDecision };
}
