import { AUTOPILOT_FACT_MIN_QUOTE_CHARS } from "@/constants/autopilot-style";
import type {
  AutopilotFactClaim,
  AutopilotFactSource,
} from "@/types/autopilot-templates-runtime";

const NON_WORD = /[^\p{L}\p{N}$%.]+/gu;
/** A period that ends a sentence, not one inside a number like $5.99. */
const LOOSE_PERIOD = /(?<!\d)\.|\.(?!\d)/g;
/** Prices, percentages and figures with units: what a reader acts on. */
const FIGURE =
  /(?:[$€£]\s?\d(?:[\d,]|\.(?=\d))*|\d(?:[\d,]|\.(?=\d))*\s?(?:%|percent|GB|TB|ms|hours?|seconds?|minutes?))/gi;

function squash(text: string) {
  return ` ${text
    .toLowerCase()
    .replace(LOOSE_PERIOD, " ")
    .replace(NON_WORD, " ")
    .trim()} `;
}

const ELLIPSIS = /\s*(?:\.{3}|…)\s*/;

/**
 * Whether a claim's quote really appears in the source it names, ignoring
 * case, punctuation and line breaks. A quote may skip text with "...": then
 * every piece must appear in that source, in order. A model that cites a
 * quote it made up is caught here, not trusted.
 */
export function quoteIsInSource(
  claim: Pick<AutopilotFactClaim, "quote" | "source">,
  sources: readonly AutopilotFactSource[]
) {
  const pieces = claim.quote
    .split(ELLIPSIS)
    .map(squash)
    .filter((piece) => piece.trim().length > 0);
  const quoted = pieces.reduce((sum, piece) => sum + piece.trim().length, 0);
  if (pieces.length === 0 || quoted < AUTOPILOT_FACT_MIN_QUOTE_CHARS) {
    return false;
  }
  const named = sources.filter((source) => source.label === claim.source);
  return (named.length > 0 ? named : sources).some((source) => {
    const text = squash(source.text);
    let from = 0;
    for (const piece of pieces) {
      const at = text.indexOf(piece, from);
      if (at === -1) {
        return false;
      }
      from = at + piece.length - 1;
    }
    return true;
  });
}

/** Figures on the page that no source contains, for a person to check. */
export function unsourcedFigures(
  content: string,
  sources: readonly AutopilotFactSource[]
) {
  const all = squash(sources.map((source) => source.text).join(" "));
  const figures = new Set(
    (content.match(FIGURE) ?? []).map((figure) => figure.trim())
  );
  return [...figures].filter((figure) => !all.includes(squash(figure)));
}
