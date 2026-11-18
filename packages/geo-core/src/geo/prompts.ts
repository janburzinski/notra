import { DEFAULT_LANGUAGE } from "@notra/ai/constants/languages";
import {
  type AnyColumn,
  and,
  inArray,
  like,
  not,
  notInArray,
  or,
  type SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";

import { GEO_AUTO_PROMPT_IDS, GEO_MAX_PROMPTS } from "../constants/geo";
import type {
  GeoPromptDefinition,
  GeoSettings,
  GeoTrackedPrompt,
} from "../types/geo";
import { buildBrandTerms, promptMentionsBrand } from "./suggestion-keywords";

const CUSTOM_PROMPT_SCAN_ID_PREFIX = "custom-";
const SEQUENCE_PROMPT_SCAN_ID_PREFIX = "sequence-";

const GEO_AUTO_PROMPT_ID_SET = new Set<string>(GEO_AUTO_PROMPT_IDS);

export function isGeoAutoPromptId(promptId: string): boolean {
  return GEO_AUTO_PROMPT_ID_SET.has(promptId);
}

type AutoPromptChange = "pause" | "resume" | "remove";

export function applyAutoPromptChange(
  pausedAutoPromptIds: readonly string[],
  removedAutoPromptIds: readonly string[],
  promptId: string,
  change: AutoPromptChange
): {
  pausedAutoPromptIds: string[];
  removedAutoPromptIds: string[];
} {
  const paused = new Set(pausedAutoPromptIds);
  const removed = new Set(removedAutoPromptIds);
  if (change === "remove") {
    removed.add(promptId);
    paused.delete(promptId);
  } else if (change === "pause") {
    if (!removed.has(promptId)) {
      paused.add(promptId);
    }
  } else {
    paused.delete(promptId);
  }
  return {
    pausedAutoPromptIds: [...paused],
    removedAutoPromptIds: [...removed],
  };
}

export function toAutoTrackedPrompts(
  autoPrompts: readonly GeoPromptDefinition[],
  pausedAutoPromptIds: readonly string[],
  removedAutoPromptIds: readonly string[]
): GeoTrackedPrompt[] {
  const paused = new Set(pausedAutoPromptIds);
  const removed = new Set(removedAutoPromptIds);
  const prompts: GeoTrackedPrompt[] = [];
  for (const autoPrompt of autoPrompts) {
    if (removed.has(autoPrompt.id)) {
      continue;
    }
    prompts.push({
      id: autoPrompt.id,
      prompt: autoPrompt.text,
      enabled: !paused.has(autoPrompt.id),
      source: "auto",
      createdAt: null,
    });
  }
  return prompts;
}

/**
 * Scan results are recorded under a namespaced prompt id for custom prompts
 * (`custom-<uuid>`) so they never collide with the slug ids of auto prompts.
 */
export function customPromptScanId(promptId: string): string {
  return `${CUSTOM_PROMPT_SCAN_ID_PREFIX}${promptId}`;
}

/** The prompt id under which a tracked prompt's scan results are stored. */
export function trackedPromptScanId(
  prompt: Pick<GeoTrackedPrompt, "id" | "source">
): string {
  return prompt.source === "custom" ? customPromptScanId(prompt.id) : prompt.id;
}

function isCustomPromptScanId(promptId: string): boolean {
  return promptId.startsWith(CUSTOM_PROMPT_SCAN_ID_PREFIX);
}

function isConversationScanPromptId(promptId: string): boolean {
  return promptId.startsWith(SEQUENCE_PROMPT_SCAN_ID_PREFIX);
}

export function shouldSkipUnmatchedGapScan(
  scanId: string,
  matchedScanIds: ReadonlySet<string>,
  removedAutoPromptIds: ReadonlySet<string>
): boolean {
  return (
    matchedScanIds.has(scanId) ||
    isConversationScanPromptId(scanId) ||
    isCustomPromptScanId(scanId) ||
    removedAutoPromptIds.has(scanId)
  );
}

export function gapScanIds(promptId: string): string[] {
  return [promptId, customPromptScanId(promptId)];
}

export function activeGapScanFilter(
  scanIdColumn: AnyColumn,
  matchedScanIds: readonly string[],
  removedAutoPromptIds: readonly string[]
): SQL | undefined {
  return or(
    inArray(scanIdColumn, [...matchedScanIds]),
    and(
      not(like(scanIdColumn, `${CUSTOM_PROMPT_SCAN_ID_PREFIX}%`)),
      not(like(scanIdColumn, `${SEQUENCE_PROMPT_SCAN_ID_PREFIX}%`)),
      notInArray(scanIdColumn, [...removedAutoPromptIds])
    )
  );
}

/**
 * Scans of built-in prompts, plus custom prompt scans (`custom-<id>`) whose id
 * the subquery selects. Conversation scans never count as gaps.
 */
export function currentPromptScanFilter(
  scanIdColumn: AnyColumn,
  customPromptIds: SQLWrapper
): SQL | undefined {
  return or(
    and(
      not(like(scanIdColumn, `${CUSTOM_PROMPT_SCAN_ID_PREFIX}%`)),
      not(like(scanIdColumn, `${SEQUENCE_PROMPT_SCAN_ID_PREFIX}%`))
    ),
    and(
      like(scanIdColumn, `${CUSTOM_PROMPT_SCAN_ID_PREFIX}%`),
      inArray(
        sql`substr(${scanIdColumn}, ${CUSTOM_PROMPT_SCAN_ID_PREFIX.length + 1})`,
        customPromptIds
      )
    )
  );
}

export function promptIdFromScanId(scanId: string): string {
  return isCustomPromptScanId(scanId)
    ? scanId.slice(CUSTOM_PROMPT_SCAN_ID_PREFIX.length)
    : scanId;
}

export function scopeGeoPrompts(
  prompts: readonly GeoPromptDefinition[],
  promptIds: readonly string[]
): GeoPromptDefinition[] {
  const scanIds = new Set<string>();
  for (const promptId of promptIds) {
    scanIds.add(promptId);
    scanIds.add(customPromptScanId(promptId));
  }
  return prompts.filter((prompt) => scanIds.has(prompt.id));
}

/**
 * Mention checks for custom prompts are keyed by `custom-<uuid>`. Fall back to
 * the raw id so auto-generated slugs (`best-tools`) and legacy rows still match.
 */
export function findPromptMentionEntry<T>(
  byPrompt: Map<string, T>,
  promptId: string
): T | undefined {
  return byPrompt.get(customPromptScanId(promptId)) ?? byPrompt.get(promptId);
}

export function buildGeoPrompts(
  settings: Pick<GeoSettings, "companyName" | "aliases"> &
    Partial<Pick<GeoSettings, "promptLanguage">>,
  autoPrompts: readonly GeoPromptDefinition[] | null
): GeoPromptDefinition[] {
  if (
    !autoPrompts ||
    (settings.promptLanguage ?? DEFAULT_LANGUAGE) !== DEFAULT_LANGUAGE
  ) {
    return [];
  }
  const brandTerms = buildBrandTerms(settings);
  return autoPrompts
    .filter(
      (prompt) =>
        isGeoAutoPromptId(prompt.id) &&
        !promptMentionsBrand(prompt.text, brandTerms)
    )
    .slice(0, GEO_MAX_PROMPTS);
}

/**
 * Prompts a scan asks, in scan order: unpaused auto prompts first, then the
 * enabled custom prompts oldest first. Translation picks and defaults follow
 * the same order.
 */
export function assembleGeoScanPrompts(input: {
  autoPrompts: readonly GeoPromptDefinition[];
  customRows: readonly { id: string; prompt: string }[];
  pausedAutoPromptIds: readonly string[];
  removedAutoPromptIds: readonly string[];
}): GeoPromptDefinition[] {
  const paused = new Set(input.pausedAutoPromptIds);
  const removed = new Set(input.removedAutoPromptIds);
  return [
    ...input.autoPrompts.filter(
      (prompt) => !paused.has(prompt.id) && !removed.has(prompt.id)
    ),
    ...input.customRows.map((row) => ({
      id: customPromptScanId(row.id),
      text: row.prompt,
    })),
  ];
}
