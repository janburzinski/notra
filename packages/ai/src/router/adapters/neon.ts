import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { GatewayAdapter, NeonAdapterConfig } from "@notra/ai/types/router";

import { fromNeonModelId, isModelSupported, toNeonModelId } from "../model-ids";
import { buildNeonProviderOptions } from "../provider-options";

export function createNeonAdapter(config: NeonAdapterConfig): GatewayAdapter {
  const baseURL = config.baseURL.replace(/\/+$/, "");
  const client = createOpenAICompatible({
    name: "neon",
    apiKey: config.apiKey,
    baseURL: baseURL.endsWith("/v1") ? baseURL : `${baseURL}/v1`,
    fetch: config.fetch,
    includeUsage: true,
    supportsStructuredOutputs: true,
  });

  return {
    id: "neon",
    // Neon/Databricks may retain prompts for abuse monitoring for up to 30 days.
    // https://neon.com/docs/ai-gateway/data-retention
    enforcesZdr: false,
    supportsModel: (modelId) => isModelSupported("neon", modelId),
    mapModelId: toNeonModelId,
    createModel: (modelId) => client.chatModel(toNeonModelId(modelId)),
    buildProviderOptions: buildNeonProviderOptions,
    // No documented inference-token balance/health endpoint. Do not invent a
    // funded balance or send the inference credential to the management API.
    getBalance: () => Promise.resolve({ balance: null }),
    checkHealth: () =>
      Promise.resolve({
        ok: false,
        reason: "No health endpoint; verify with an inference request",
      }),
    extractRouteMetadata: (_metadata, servedModelId) => ({
      ...(servedModelId ? { model: fromNeonModelId(servedModelId) } : {}),
    }),
  };
}
