import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { VERCEL_NAMESPACE_PREFIX } from "@notra/ai/constants/router";
import type { GatewayAdapter, NeonAdapterConfig } from "@notra/ai/types/router";

import { fromNeonModelId, isModelSupported, toNeonModelId } from "../model-ids";
import { buildNeonProviderOptions } from "../provider-options";

export function createNeonAdapter(config: NeonAdapterConfig): GatewayAdapter {
  const host = config.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "");
  const bearer = { authorization: `Bearer ${config.apiKey}` };
  const chat = createOpenAICompatible({
    name: "neon",
    apiKey: config.apiKey,
    baseURL: `${host}/v1`,
    fetch: config.fetch,
    includeUsage: true,
    supportsStructuredOutputs: true,
  });
  // Neon's chat-completions endpoint rejects OpenAI function tools with
  // reasoning, Claude structured output, Gemini tool schemas and every
  // provider web search tool. The native endpoints serve all of them.
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: `${host}/openai/v1`,
    fetch: config.fetch,
  });
  const anthropic = createAnthropic({
    apiKey: config.apiKey,
    baseURL: `${host}/anthropic/v1`,
    headers: bearer,
    fetch: config.fetch,
  });
  const google = createGoogleGenerativeAI({
    apiKey: config.apiKey,
    baseURL: `${host}/gemini/v1beta`,
    headers: bearer,
    fetch: config.fetch,
  });

  const createModel = (modelId: string): LanguageModelV4 => {
    const neonModelId = toNeonModelId(modelId);
    const family = modelId.replace(VERCEL_NAMESPACE_PREFIX, "").split("/")[0];
    // gpt-oss is only served on chat completions.
    if (family === "openai" && !neonModelId.startsWith("gpt-oss")) {
      return openai.responses(neonModelId);
    }
    if (family === "anthropic") {
      return anthropic(neonModelId);
    }
    if (family === "google") {
      return google(neonModelId);
    }
    return chat.chatModel(neonModelId);
  };

  return {
    id: "neon",
    // Neon/Databricks may retain prompts for abuse monitoring for up to 30 days.
    // https://neon.com/docs/ai-gateway/data-retention
    enforcesZdr: false,
    supportsModel: (modelId) => isModelSupported("neon", modelId),
    mapModelId: toNeonModelId,
    createModel,
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
