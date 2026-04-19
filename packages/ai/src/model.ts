import { gateway } from "@notra/ai/gateway";
import {
  type AILogTarget,
  wrapModelWithObservability,
} from "@notra/ai/observability";
import type { GatewayArgs, GatewayResult } from "@notra/ai/types/gateway";
import type { CreateModelOptions } from "@notra/ai/types/model";
import { withSupermemory } from "@supermemory/tools/ai-sdk";

export function createModel(
  organizationId: string | undefined,
  modelId: GatewayArgs[0],
  options?: CreateModelOptions,
  log?: AILogTarget
): GatewayResult {
  const base = gateway(modelId);

  if (!organizationId) {
    return wrapModelWithObservability(base, log);
  }

  const supermemoryApiKey = process.env.SUPERMEMORY_API_KEY?.trim();
  if (!supermemoryApiKey) {
    return wrapModelWithObservability(base, log);
  }

  if (options?.enabled === false) {
    return wrapModelWithObservability(base, log);
  }

  const model = withSupermemory(base, organizationId, {
    apiKey: supermemoryApiKey,
    mode: "full",
    addMemory: "always",
    ...options?.supermemory,
  });

  return wrapModelWithObservability(model, log);
}
