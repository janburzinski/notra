import { createAnthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { createPerplexity } from "@ai-sdk/perplexity";
import { xai } from "@ai-sdk/xai";
import { gateway } from "@notra/ai/gateway";
import { requireApiKey } from "@notra/utils/require-api-key";

import {
  GEO_ANTHROPIC_API_KEY_ENV,
  GEO_OPENAI_API_KEY_ENV,
  GEO_PERPLEXITY_API_KEY_ENV,
} from "../constants/geo";
import type {
  GeoGroundedEngine,
  GeoGroundedInvocation,
  GeoGroundedInvocationOptions,
} from "../types/geo";
import { geoAnthropicWebSearch } from "../utils/geo-anthropic-web-search";

export function buildGroundedInvocation(
  engine: GeoGroundedEngine,
  options: GeoGroundedInvocationOptions = {}
): GeoGroundedInvocation {
  // Provider-defined web search tools need a gateway that serves them: Neon
  // runs OpenAI and Gemini search natively, everything else is pinned to Vercel.
  const groundedGateway = {
    organizationId: options.organizationId,
    gateway: "vercel",
    zdr: options.zdr,
    logContext: options.logContext,
  } as const;
  const neonGroundedGateway = {
    organizationId: options.organizationId,
    gateways: ["neon", "vercel"],
    zdr: options.zdr,
    logContext: options.logContext,
  } as const;
  switch (engine.provider) {
    case "gateway-openai":
      return {
        model: gateway(engine.model, neonGroundedGateway),
        tools: { web_search: openai.tools.webSearch({}) },
      };
    case "gateway-anthropic":
      return {
        model: gateway(engine.model, groundedGateway),
        tools: {
          web_search: geoAnthropicWebSearch(
            engine.model,
            options.zdr === "none"
          ),
        },
      };
    case "gateway-google":
      return {
        model: gateway(engine.model, neonGroundedGateway),
        tools: { google_search: google.tools.googleSearch({}) },
      };
    case "gateway-perplexity":
      return { model: gateway(engine.model, groundedGateway), tools: {} };
    case "gateway-meta":
      // Meta accepts the OpenAI-compatible search tool, but rejects it under ZDR.
      if (options.zdr === "required") {
        throw new Error("Meta web search does not support zero data retention");
      }
      return {
        model: gateway(engine.model, { ...groundedGateway, zdr: "none" }),
        tools: { web_search: openai.tools.webSearch({}) },
      };
    case "gateway-spacexai":
      return {
        model: gateway(engine.model, groundedGateway),
        tools: { web_search: xai.tools.webSearch({}) },
      };
    case "direct-openai": {
      const provider = createOpenAI({
        apiKey: requireApiKey(GEO_OPENAI_API_KEY_ENV),
      });
      return {
        model: provider.responses(engine.model),
        tools: { web_search: provider.tools.webSearch({}) },
      };
    }
    case "direct-anthropic": {
      const provider = createAnthropic({
        apiKey: requireApiKey(GEO_ANTHROPIC_API_KEY_ENV),
      });
      return {
        model: provider(engine.model),
        tools: {
          web_search: geoAnthropicWebSearch(
            engine.model,
            options.zdr === "none"
          ),
        },
      };
    }
    default: {
      const provider = createPerplexity({
        apiKey: requireApiKey(GEO_PERPLEXITY_API_KEY_ENV),
      });
      return { model: provider(engine.model), tools: {} };
    }
  }
}
