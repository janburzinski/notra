import { devToolsMiddleware } from "@ai-sdk/devtools";
import { gateway as routedModel } from "@notra/ai/gateway";
import { withGatewayAgentOptions } from "@notra/ai/utils/gateway-agent-model";
import { gatewayAttributionOptions } from "@notra/ai/utils/usage-attribution";
import { getOrganizationId } from "@notra/tools/utils/organization";
import { type LanguageModel, wrapLanguageModel } from "ai";
import { defineDynamic } from "eve";

import {
  ASSISTANT_MODEL_ID,
  GLM_CONTEXT_WINDOW_TOKENS,
} from "../constants/models";

export function createAgentModel(
  modelId: string,
  tag = "agent-chat",
  organizationId?: string | null
): LanguageModel {
  const tagged = withGatewayAgentOptions(
    routedModel(modelId, { organizationId: organizationId ?? undefined }),
    tag
  );
  if (process.env.AI_SDK_DEVTOOLS !== "true") {
    return tagged;
  }

  return wrapLanguageModel({
    model: tagged,
    middleware: devToolsMiddleware(),
  });
}

export function getStepTurnId(event: unknown): string | undefined {
  const turnId = (event as { data?: { turnId?: unknown } }).data?.turnId;
  return typeof turnId === "string" ? turnId : undefined;
}

export function createAssistantModel() {
  return defineDynamic({
    events: {
      "step.started": (event, ctx) => {
        const organizationId = getOrganizationId(ctx);
        const surface =
          ctx.session.auth.current?.attributes.surface ??
          ctx.session.auth.initiator?.attributes.surface;
        const isTask = surface === "task";
        return {
          model: createAgentModel(
            ASSISTANT_MODEL_ID,
            isTask ? "agent-task" : "agent-chat",
            organizationId
          ),
          ...(isTask ? { reasoning: "low" as const } : {}),
          modelContextWindowTokens: GLM_CONTEXT_WINDOW_TOKENS,
          modelOptions: {
            providerOptions: {
              gateway: gatewayAttributionOptions({
                organizationId,
                sessionId: ctx.session.id,
                turnId: getStepTurnId(event),
              }),
            },
          },
        };
      },
    },
  });
}
