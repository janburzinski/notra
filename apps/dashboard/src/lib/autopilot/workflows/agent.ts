import { calculateAiCreditCostCents } from "@notra/ai/billing/ai-credit-cost";
import {
  allowUnmeteredAiInDevelopment,
  autumn,
} from "@notra/ai/billing/autumn";
import {
  checkAutumnFeature,
  finalizeAutumnLock,
} from "@notra/ai/billing/autumn-locks";
import { FEATURES } from "@notra/ai/billing/features";
import { shouldApplyMarkup } from "@notra/ai/billing/token-pricing";
import { CONTENT_BILLING_LOCK_TTL_MS } from "@notra/ai/constants/content-billing";
import { AGENT_DEFAULT_MODEL } from "@notra/ai/constants/models";
import { createModel } from "@notra/ai/model";
import { withRouterDefaults } from "@notra/ai/provider-options";
import {
  createGetGeoCompetitorShareTool,
  createGetGeoOverviewTool,
  createGetGeoProjectContextTool,
  createGetGeoPromptResultsTool,
  createListGeoProjectsTool,
} from "@notra/ai/tools/geo";
import { createGetAvailablePostsTool } from "@notra/ai/tools/post";
import { registerWebSearchTools } from "@notra/ai/tools/web-search";
import type { AgentTokenUsage } from "@notra/ai/types/agents";
import { summarizeRouteUsage } from "@notra/ai/utils/route-usage";
import { logError } from "@notra/ai/utils/server-log";
import { buildTelemetryOptions } from "@notra/ai/utils/tcc";
import { toAgentTokenUsage } from "@notra/ai/utils/token-usage";
import { generateText, isStepCount, Output, type Tool } from "ai";
import { getStepMetadata } from "workflow";

import { AUTOPILOT_WORKFLOW_AGENT_MAX_STEPS } from "@/constants/autopilot-workflows";
import { decisionSchema } from "@/schemas/autopilot-workflows";
import type {
  AutopilotWorkflowAgentCall,
  AutopilotWorkflowAgentResult,
} from "@/types/autopilot-workflows";

function workflowAgentTools(organizationId: string) {
  const config = { organizationId };
  const tools: Record<string, Tool> = {
    listGeoProjects: createListGeoProjectsTool(config),
    getGeoOverview: createGetGeoOverviewTool(config),
    getGeoCompetitorShare: createGetGeoCompetitorShareTool(config),
    getGeoPromptResults: createGetGeoPromptResultsTool(config),
    getGeoProjectContext: createGetGeoProjectContextTool(config),
    getAvailablePosts: createGetAvailablePostsTool(config),
  };
  registerWebSearchTools(tools);
  return tools;
}

async function chargeUsage(params: {
  organizationId: string;
  lockId: string;
  tag: string;
  modelId: string;
  usage: AgentTokenUsage;
  useMarkup: boolean;
}) {
  const { organizationId, lockId, tag, modelId, usage, useMarkup } = params;
  const cost = calculateAiCreditCostCents(usage, modelId, useMarkup);
  try {
    await finalizeAutumnLock(lockId, "confirm", cost.costCents, {
      source: "autopilot_workflow",
      block: tag,
      model: modelId,
      billing_basis: cost.billingBasis,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_cents: cost.costCents,
    });
  } catch (error) {
    logError("[Autopilot workflow] Failed to charge AI credits", error, {
      organizationId,
      lockId,
    });
  }
}

async function releaseCredits(organizationId: string, lockId: string) {
  try {
    await finalizeAutumnLock(lockId, "release");
  } catch (error) {
    logError("[Autopilot workflow] Failed to release AI credits", error, {
      organizationId,
      lockId,
    });
  }
}

/** Runs one agent step; null when the workspace can't pay for it. */
async function runAgent<Result>(
  call: AutopilotWorkflowAgentCall,
  generate: (
    options: Parameters<typeof generateText>[0]
  ) => Promise<AutopilotWorkflowAgentResult<Result>>
): Promise<Result | null> {
  if (!(autumn || allowUnmeteredAiInDevelopment)) {
    throw new Error("Billing is unavailable, so the agent step can't run");
  }
  const lockId = allowUnmeteredAiInDevelopment
    ? null
    : `autopilot-workflow:${call.idempotencyKey}:${getStepMetadata().attempt}`;
  let useMarkup = false;
  if (lockId) {
    const { response, duplicateLock } = await checkAutumnFeature({
      organizationId: call.organizationId,
      featureId: FEATURES.AI_CREDITS,
      requiredBalance: 1,
      lockId,
      lockTtlMs: CONTENT_BILLING_LOCK_TTL_MS,
    });
    if (duplicateLock) {
      throw new Error(
        "This agent step attempt already has a billing reservation"
      );
    }
    if (!response?.allowed) {
      return null;
    }
    useMarkup = shouldApplyMarkup(response.balance ?? null);
  }
  const modelId = AGENT_DEFAULT_MODEL;
  const modelCall = async () => {
    try {
      return await generate({
        model: createModel(call.organizationId, modelId),
        instructions: call.instructions,
        prompt: call.prompt,
        tools: workflowAgentTools(call.organizationId),
        stopWhen: isStepCount(AUTOPILOT_WORKFLOW_AGENT_MAX_STEPS),
        providerOptions: withRouterDefaults(
          { gateway: { tags: ["autopilot-workflow", call.tag] } },
          { modelId }
        ),
        ...buildTelemetryOptions({
          feature: "autopilot-workflow",
          organizationId: call.organizationId,
          routeName: `autopilot-workflow/${call.tag}`,
        }),
      });
    } catch (error) {
      if (lockId) {
        await releaseCredits(call.organizationId, lockId);
      }
      throw error;
    }
  };
  const { result, usage, steps } = await modelCall();
  if (lockId) {
    // Gateway-reported cost and prompt size price it like the chat does.
    const routeUsage = await summarizeRouteUsage(steps, modelId);
    await chargeUsage({
      organizationId: call.organizationId,
      lockId,
      tag: call.tag,
      modelId,
      usage: {
        ...toAgentTokenUsage(usage),
        maxPromptTokens: routeUsage.maxPromptTokens,
        tokenCostUsd: routeUsage.tokenCostUsd,
      },
      useMarkup,
    });
  }
  return result;
}

export function runAutopilotAgentText(call: AutopilotWorkflowAgentCall) {
  return runAgent(call, async (options) => {
    const { text, totalUsage, steps } = await generateText(options);
    return { result: text, usage: totalUsage, steps };
  });
}

export function runAutopilotAgentDecision(call: AutopilotWorkflowAgentCall) {
  return runAgent(call, async (options) => {
    const { output, totalUsage, steps } = await generateText({
      ...options,
      // The answer comes as a step of its own after the tool calls, and the
      // last step leaves the tools out so there always is one.
      stopWhen: isStepCount(AUTOPILOT_WORKFLOW_AGENT_MAX_STEPS + 1),
      prepareStep: ({ stepNumber }) =>
        stepNumber === AUTOPILOT_WORKFLOW_AGENT_MAX_STEPS
          ? { toolChoice: "none" as const }
          : undefined,
      output: Output.object({ schema: decisionSchema }),
    });
    return { result: output, usage: totalUsage, steps };
  });
}
