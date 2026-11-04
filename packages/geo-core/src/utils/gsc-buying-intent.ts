import { escapeRegExp } from "@notra/utils/escape";

import {
  GSC_BUYING_INTENT_RULES,
  GSC_CATEGORY_WORDS,
  GSC_NOT_BUYING_INTENT_PHRASES,
  GSC_SINGLE_PRODUCT_MAX_WORDS,
  GSC_SINGLE_PRODUCT_SECTIONS,
  GSC_SINGLE_PRODUCT_TRAILING_WORDS,
} from "../constants/google-search-console";
import type { GscBuyingIntentSection } from "../types/google-search-console";

// `\b` ignores non-ASCII letters, so "bestätigen" would match "best".
const WORD_CHAR = "[\\p{L}\\p{N}\\p{M}_]";
const WHITESPACE = /\s+/g;

function wordsPattern(words: readonly string[]): RegExp {
  const alternation = words
    .map((word) => escapeRegExp(word).replace(WHITESPACE, "\\s+"))
    .join("|");
  return new RegExp(
    `(?<!${WORD_CHAR})(?:${alternation})(?!${WORD_CHAR})`,
    "gu"
  );
}

const NOT_BUYING_INTENT = wordsPattern(GSC_NOT_BUYING_INTENT_PHRASES);
const SECTION_PATTERNS = GSC_BUYING_INTENT_RULES.map((rule) => ({
  section: rule.section,
  pattern: new RegExp(wordsPattern(rule.terms).source, "u"),
}));
const SINGLE_PRODUCT_TERMS = GSC_BUYING_INTENT_RULES.filter((rule) =>
  GSC_SINGLE_PRODUCT_SECTIONS.includes(rule.section)
).flatMap((rule) => rule.terms);
const SINGLE_PRODUCT_QUERY = new RegExp(
  `^((?:\\S+\\s+){1,${GSC_SINGLE_PRODUCT_MAX_WORDS}})(?:${SINGLE_PRODUCT_TERMS.map(escapeRegExp).join("|")})(?:\\s+(?:${GSC_SINGLE_PRODUCT_TRAILING_WORDS.map(escapeRegExp).join("|")}|\\d{4}))*$`,
  "u"
);
const CATEGORY_WORDS = new Set(GSC_CATEGORY_WORDS);

/** "acme pricing" names one product; "crm software pricing" names a category. */
function namesOneProduct(query: string): boolean {
  const lead = SINGLE_PRODUCT_QUERY.exec(query)?.[1];
  if (!lead) {
    return false;
  }
  return !lead
    .trim()
    .split(" ")
    .some((word) => CATEGORY_WORDS.has(word));
}

/**
 * The section a page needs for a query from someone comparing options,
 * checking prices or reading reviews, or null for any other query.
 */
export function buyingIntentSection(
  query: string
): GscBuyingIntentSection | null {
  const text = query
    .normalize("NFC")
    .toLowerCase()
    .replace(NOT_BUYING_INTENT, " ")
    .replace(WHITESPACE, " ")
    .trim();
  const match = SECTION_PATTERNS.find(({ pattern }) => pattern.test(text));
  if (!match) {
    return null;
  }
  if (
    GSC_SINGLE_PRODUCT_SECTIONS.includes(match.section) &&
    namesOneProduct(text)
  ) {
    return null;
  }
  return match.section;
}
