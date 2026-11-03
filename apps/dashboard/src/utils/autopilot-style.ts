import {
  AUTOPILOT_DASH,
  AUTOPILOT_NUMERIC_RANGE_DASH,
  AUTOPILOT_SPACED_DASH,
} from "@/constants/autopilot-style";

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
