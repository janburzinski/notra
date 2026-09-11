const SEPARATOR_PATTERN = /[\s\-_/@.]+/g;
const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}\p{M}]/u;
/** Scripts written without spaces; adjacency there is not a false-positive signal. */
const SCRIPT_WITHOUT_SPACES =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;
const TRAIL_SURROGATE_MIN = 0xdc00;
const TRAIL_SURROGATE_MAX = 0xdfff;
const LEAD_SURROGATE_MIN = 0xd800;
const LEAD_SURROGATE_MAX = 0xdbff;

/**
 * Collapses casing, whitespace and package-style punctuation so that
 * `@acme/email-sdk`, `email_sdk` and `Email SDK` share one form.
 */
function normalizeBrandText(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(SEPARATOR_PATTERN, " ")
    .trim();
}

function codePointAt(text: string, index: number): string | undefined {
  if (index < 0 || index >= text.length) {
    return undefined;
  }
  return String.fromCodePoint(text.codePointAt(index)!);
}

function codePointBefore(text: string, index: number): string | undefined {
  if (index <= 0) {
    return undefined;
  }
  const previous = index - 1;
  const unit = text.charCodeAt(previous);
  if (
    previous > 0 &&
    unit >= TRAIL_SURROGATE_MIN &&
    unit <= TRAIL_SURROGATE_MAX
  ) {
    const lead = text.charCodeAt(previous - 1);
    if (lead >= LEAD_SURROGATE_MIN && lead <= LEAD_SURROGATE_MAX) {
      return codePointAt(text, previous - 1);
    }
  }
  return codePointAt(text, previous);
}

function isWordCharacter(character: string | undefined): boolean {
  return (
    character !== undefined &&
    WORD_CHARACTER_PATTERN.test(character) &&
    !SCRIPT_WITHOUT_SPACES.test(character)
  );
}

function containsTerm(haystack: string, term: string): boolean {
  let from = 0;
  while (from <= haystack.length - term.length) {
    const index = haystack.indexOf(term, from);
    if (index === -1) {
      return false;
    }
    const before = codePointBefore(haystack, index);
    const after = codePointAt(haystack, index + term.length);
    if (!isWordCharacter(before) && !isWordCharacter(after)) {
      return true;
    }
    from = index + 1;
  }
  return false;
}

/**
 * Returns the company name or alias that literally appears in the answer, or
 * null when none does. This is the source of truth for `mentioned`; the judge
 * model only supplies position, sentiment, competitors and excerpt.
 */
export function findBrandMention(
  answer: string,
  companyName: string,
  aliases: readonly string[]
): string | null {
  const haystack = normalizeBrandText(answer);
  if (haystack.length === 0) {
    return null;
  }
  for (const term of [companyName, ...aliases]) {
    const needle = normalizeBrandText(term);
    if (needle.length > 0 && containsTerm(haystack, needle)) {
      return term;
    }
  }
  return null;
}
