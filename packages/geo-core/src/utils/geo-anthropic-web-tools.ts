import { anthropic } from "@ai-sdk/anthropic";
import type { ToolSet } from "ai";

import {
  GEO_GROUNDED_FETCH_MAX_CONTENT_TOKENS,
  GEO_GROUNDED_MAX_FETCHES,
  GEO_GROUNDED_MAX_SEARCHES,
} from "../constants/geo";

export function geoAnthropicWebTools(
  modelId: string,
  allowFiltering: boolean
): ToolSet {
  const version = /claude-[a-z]+-(\d+)(?:[.-](\d+))?/.exec(modelId);
  const supportsFiltering =
    version !== null &&
    (Number(version[1]) > 4 ||
      (Number(version[1]) === 4 && Number(version[2]) >= 6));
  const fetchOptions = {
    maxUses: GEO_GROUNDED_MAX_FETCHES,
    maxContentTokens: GEO_GROUNDED_FETCH_MAX_CONTENT_TOKENS,
  };
  return allowFiltering && supportsFiltering
    ? {
        web_search: anthropic.tools.webSearch_20260318({
          maxUses: GEO_GROUNDED_MAX_SEARCHES,
          responseInclusion: "excluded",
        }),
        web_fetch: anthropic.tools.webFetch_20260318({
          ...fetchOptions,
          responseInclusion: "excluded",
        }),
      }
    : {
        web_search: anthropic.tools.webSearch_20250305({
          maxUses: GEO_GROUNDED_MAX_SEARCHES,
        }),
        web_fetch: anthropic.tools.webFetch_20250910(fetchOptions),
      };
}
