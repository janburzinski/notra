import { GEO_PROMPT_SCAN_CHOICES_LIMIT } from "@notra/ai/constants/geo-tools";
import { customPromptScanId } from "@notra/geo-core/geo/prompts";
import type { GeoTrackedPrompt } from "@notra/geo-core/types/geo";

import type { GeoPromptScanMatch } from "@/types/geo-prompt-scan";

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/["'“”‘’`]/g, "")
    .replace(/[?.!]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function choices(prompts: readonly GeoTrackedPrompt[]) {
  return prompts
    .slice(0, GEO_PROMPT_SCAN_CHOICES_LIMIT)
    .map(({ id, prompt }) => ({ id, prompt }));
}

/**
 * Finds the tracked prompt the agent means: by id, by its exact wording, or
 * by a part of it that only one prompt contains. Anything else hands back
 * prompts to pick from instead of guessing.
 */
export function matchTrackedPrompt(
  prompts: readonly GeoTrackedPrompt[],
  query: string
): GeoPromptScanMatch {
  const byId = prompts.find(
    (prompt) => prompt.id === query || customPromptScanId(prompt.id) === query
  );
  if (byId) {
    return { status: "match", prompt: byId };
  }
  const wanted = normalize(query);
  const exact = prompts.filter((prompt) => normalize(prompt.prompt) === wanted);
  if (exact.length === 1 && exact[0]) {
    return { status: "match", prompt: exact[0] };
  }
  const partial = wanted
    ? prompts.filter((prompt) => normalize(prompt.prompt).includes(wanted))
    : [];
  if (partial.length === 1 && partial[0]) {
    return { status: "match", prompt: partial[0] };
  }
  return partial.length > 1
    ? { status: "choose", prompts: choices(partial) }
    : { status: "not_found", prompts: choices(prompts) };
}

/** Like `matchTrackedPrompt`, but only enabled prompts can be scanned. */
export function matchGeoScanPrompt(
  prompts: readonly GeoTrackedPrompt[],
  query: string
): GeoPromptScanMatch {
  return matchTrackedPrompt(
    prompts.filter((prompt) => prompt.enabled),
    query
  );
}

function promptsForQuery(
  enabled: readonly GeoTrackedPrompt[],
  query: string
): readonly GeoTrackedPrompt[] {
  const byId = enabled.filter(
    (prompt) => prompt.id === query || customPromptScanId(prompt.id) === query
  );
  if (byId.length > 0) {
    return byId;
  }
  const wanted = normalize(query);
  const containing = enabled.filter((prompt) =>
    normalize(prompt.prompt).includes(wanted)
  );
  if (containing.length > 0) {
    return containing;
  }
  const words = wanted.split(" ").filter((word) => word.length > 2);
  return words.length === 0
    ? []
    : enabled.filter((prompt) => {
        const text = normalize(prompt.prompt);
        return words.every((word) => text.includes(word));
      });
}

/**
 * Enabled tracked prompts a query points at, for an agent to pick an id from:
 * the prompt with that id, those containing the query, or failing that those
 * containing all of its words. No query lists them all.
 */
export function findGeoScanPrompts(
  prompts: readonly GeoTrackedPrompt[],
  query: string | undefined
) {
  const enabled = prompts.filter((prompt) => prompt.enabled);
  const found = query?.trim()
    ? promptsForQuery(enabled, query.trim())
    : enabled;
  return { prompts: choices(found), total: found.length };
}
