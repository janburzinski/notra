import { ROUTER_PROVIDER_OPTIONS_KEY } from "@notra/ai/constants/router";
import { withRouterProviderOptions } from "@notra/ai/router/provider-options";
import type { RouterProviderOptions } from "@notra/ai/types/router";
import { isRecord } from "@notra/utils/unknown-record";
import type { generateText } from "ai";

type ProviderOptions = NonNullable<
  Parameters<typeof generateText>[0]["providerOptions"]
>;

const DEFAULT_FALLBACK_MODELS = ["anthropic/claude-sonnet-5"];

function getGatewayFallbackModels(modelId?: string): string[] {
  if (!modelId) {
    return [...DEFAULT_FALLBACK_MODELS];
  }

  // Content writing is Opus-only and chat is GLM-only, so neither may fall
  // back to another model. The router still fails over between gateways.
  if (
    modelId.startsWith("anthropic/claude-opus-") ||
    modelId.startsWith("zai/")
  ) {
    return [];
  }

  if (modelId.startsWith("anthropic/")) {
    return ["anthropic/claude-haiku-4.5"];
  }

  if (modelId.startsWith("openai/")) {
    return modelId === "openai/gpt-5.4-mini"
      ? ["openai/gpt-5.4-nano"]
      : ["openai/gpt-5.4-mini"];
  }

  return DEFAULT_FALLBACK_MODELS.filter((model) => model !== modelId);
}

/**
 * Attach route-neutral defaults (automatic caching + model fallback chain).
 * The router translates them into Vercel (`gateway`) or OpenRouter
 * (`openrouter`) options depending on the selected route, so call sites stay
 * gateway-agnostic. Vendor blocks such as `anthropic` or `openai` pass
 * through unchanged.
 */
export function withRouterDefaults(
  providerOptions?: ProviderOptions,
  options?: { modelId?: string; fallbackModels?: string[] }
): ProviderOptions {
  const fallbackModels =
    options?.fallbackModels ?? getGatewayFallbackModels(options?.modelId);
  const existingRouter = providerOptions?.[ROUTER_PROVIDER_OPTIONS_KEY];
  // GLM reasons on every call and defaults to max effort, which is slow and
  // can spend a small output budget on reasoning alone. Callers that want
  // more ask for it explicitly.
  const glmReasoning =
    options?.modelId?.startsWith("zai/") &&
    !(isRecord(existingRouter) && existingRouter.reasoning)
      ? { reasoning: { effort: "low" as const } }
      : {};
  const routerOptions: RouterProviderOptions = {
    caching: "auto",
    fallbackModels,
    ...glmReasoning,
  };

  return withRouterProviderOptions(
    providerOptions,
    routerOptions
  ) as ProviderOptions;
}
