import { buildToneContext } from "@notra/ai/prompts/_shared/tone";

import {
  AUTOPILOT_BRAND_TONE_INSTRUCTIONS,
  AUTOPILOT_DASH,
  AUTOPILOT_NUMERIC_RANGE_DASH,
  AUTOPILOT_SPACED_DASH,
} from "@/constants/autopilot-style";
import type { AutopilotRunContext } from "@/types/autopilot";

const CODE = /(```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s)<>"']+)/g;
const SENTENCE = /[^.!?\n]*[–—][^.!?\n]*[.!?]?/g;
const WHITESPACE = /\s+/g;
const NUMBER = /\d+(?:[.,]\d+)*/g;
const LINK = /https?:\/\/[^\s)<>"'\]]+|\]\([^)]+\)/g;

/** Runs `edit` on prose only: code blocks, inline code and URLs stay as written. */
export function mapProse(content: string, edit: (prose: string) => string) {
  return content
    .split(CODE)
    .map((part, index) => (index % 2 === 1 ? part : edit(part)))
    .join("");
}

function squash(text: string) {
  return text.replace(WHITESPACE, " ").trim();
}

function sortedMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).sort().join("\n");
}

/**
 * Whether a rewrite of one sentence keeps its facts: the same numbers and
 * the same links. A dash rewrite runs after the fact and page checks, so it
 * may change the wording but never a figure or a link.
 */
export function keepsFacts(find: string, replace: string) {
  return (
    sortedMatches(find, NUMBER) === sortedMatches(replace, NUMBER) &&
    sortedMatches(find, LINK) === sortedMatches(replace, LINK)
  );
}

/**
 * Sentences with an em or en dash that the previous version didn't have. A
 * refresh never rewrites what the page already said, only what it adds.
 */
export function newDashSentences(content: string, previous: string | null) {
  const old = squash(previous ?? "");
  const found: string[] = [];
  mapProse(content, (prose) => {
    for (const match of prose.matchAll(SENTENCE)) {
      const sentence = match[0].trim();
      if (sentence && !old.includes(squash(sentence))) {
        found.push(sentence);
      }
    }
    return prose;
  });
  return [...new Set(found)];
}

/** "10–20" reads the same as "10-20"; ranges never need a model. */
export function fixNumericRanges(content: string) {
  return mapProse(content, (prose) =>
    prose.replace(AUTOPILOT_NUMERIC_RANGE_DASH, "$1-$2")
  );
}

/**
 * Last resort when a rewrite left a dash in new text: a comma reads as a
 * pause where the dash was. Only sentences the previous version didn't have.
 */
export function forceNoDashes(content: string, previous: string | null) {
  let next = content;
  for (const sentence of newDashSentences(content, previous)) {
    const plain = sentence
      .replace(AUTOPILOT_SPACED_DASH, ", ")
      .replace(AUTOPILOT_DASH, ", ");
    next = next.replace(sentence, () => plain);
  }
  return next;
}

// A period between digits ($9.99, 12.5%) is part of the figure, not a sentence end.
const ANY_SENTENCE = /(?:[^.!?\n]|(?<=\d)\.(?=\d))+[.!?]?/g;

/** The sentences (or lines, in tables and lists) of new prose that state one of `figures`. */
export function sentencesWithFigures(
  content: string,
  figures: readonly string[]
) {
  const found: string[] = [];
  mapProse(content, (prose) => {
    for (const match of prose.matchAll(ANY_SENTENCE)) {
      const sentence = match[0].trim();
      if (sentence && figures.some((figure) => sentence.includes(figure))) {
        found.push(sentence);
      }
    }
    return prose;
  });
  return [...new Set(found)];
}

const LIST_MARKER = /^- /;

/**
 * The edits for the sentences a model was asked to rewrite. The sentences are
 * listed as "- sentence", and the model sometimes copies that marker into
 * `find`: such an edit is for the sentence without it.
 */
export function askedEdits(
  edits: readonly { find: string; replace: string }[],
  asked: ReadonlySet<string>
) {
  return edits.flatMap((edit) => {
    if (asked.has(edit.find)) {
      return [edit];
    }
    const find = edit.find.replace(LIST_MARKER, "");
    return asked.has(find)
      ? [{ find, replace: edit.replace.replace(LIST_MARKER, "") }]
      : [];
  });
}

/** The brand's tone for a writer prompt; empty when the identity sets none. */
export function brandToneInstruction(brand: AutopilotRunContext["brand"]) {
  const tone = buildToneContext({
    toneProfile: brand?.toneProfile,
    customTone: brand?.customTone,
  }).trim();
  return tone ? `${AUTOPILOT_BRAND_TONE_INSTRUCTIONS}\n${tone}` : "";
}
