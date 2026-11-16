import {
  WEB_PATH_DIGIT_RUN_PATTERN,
  WEB_PATH_EMAIL_PATTERN,
  WEB_PATH_ID_PLACEHOLDER,
  WEB_PATH_TOKEN_FILLER_PATTERN,
  WEB_PATH_TOKEN_MIN_CLASS_CHANGES,
  WEB_PATH_TOKEN_MIN_LENGTH,
  WEB_PATH_TOKEN_RUN_PATTERN,
  WEB_PATH_TOKEN_SEGMENT_PATTERN,
  WEB_PATH_TOKEN_SURE_CLASS_CHANGES,
  WEB_PATH_UUID_PATTERN,
  WEB_PATH_WORD_MIN_VOWELS,
} from "../constants/web-analytics";

const ALPHANUMERIC_PATTERN = /^[A-Za-z0-9]+$/;
// `%3B` too: a path keeps an encoded semicolon encoded. Nothing is decoded,
// so an encoded slash never becomes a separator. It stops at `#` as well,
// so a hash route after the parameter (`#!/pricing`) stays one.
const PATH_PARAMETERS_PATTERN = /(?:;|%3b)[^/#]*/gi;
const DIGIT_PATTERN = /\d/g;
const VOWEL_PATTERN = /[aeiou]/gi;

function charClass(char: string): number {
  if (char >= "a" && char <= "z") {
    return 0;
  }
  return char >= "A" && char <= "Z" ? 1 : 2;
}

/** Whether the text mixes at least two of lowercase, uppercase and digits. */
export function mixesClasses(run: string): boolean {
  const classes = [/[a-z]/, /[A-Z]/, /\d/].filter((pattern) =>
    pattern.test(run)
  );
  return classes.length >= 2;
}

/**
 * A random token split by `-` or `_`, padded with `=` or percent-encoded
 * (base64url, base64 in a URL): with those left out it is 16 or more
 * letters and digits that switch class often and are not word-like.
 */
export function isSeparatedToken(segment: string): boolean {
  const pieces = segment
    .split(WEB_PATH_TOKEN_FILLER_PATTERN)
    .filter((piece) => piece.length > 0);
  const text = pieces.join("");
  if (
    text.length < WEB_PATH_TOKEN_MIN_LENGTH ||
    !ALPHANUMERIC_PATTERN.test(text)
  ) {
    return false;
  }
  // Only changes inside a piece count: `Getting-Started` starts each word
  // with a capital, which is no sign of randomness.
  let changes = 0;
  for (const piece of pieces) {
    for (let index = 1; index < piece.length; index++) {
      if (
        charClass(piece.charAt(index)) !== charClass(piece.charAt(index - 1))
      ) {
        changes++;
      }
    }
  }
  const rate = changes / (text.length - pieces.length || 1);
  const letters = text.replace(DIGIT_PATTERN, "");
  const vowels =
    (letters.match(VOWEL_PATTERN)?.length ?? 0) / Math.max(1, letters.length);
  return (
    rate >= WEB_PATH_TOKEN_MIN_CLASS_CHANGES &&
    (vowels < WEB_PATH_WORD_MIN_VOWELS ||
      rate >= WEB_PATH_TOKEN_SURE_CLASS_CHANGES)
  );
}

function isIdentifier(segment: string): boolean {
  if (
    WEB_PATH_EMAIL_PATTERN.test(segment) ||
    WEB_PATH_UUID_PATTERN.test(segment) ||
    WEB_PATH_DIGIT_RUN_PATTERN.test(segment)
  ) {
    return true;
  }
  // Slugs are words joined by dashes; tokens and hashes have a long run of
  // mixed letters and digits with no separator in it.
  return (
    (WEB_PATH_TOKEN_SEGMENT_PATTERN.test(segment) &&
      (segment.match(WEB_PATH_TOKEN_RUN_PATTERN) ?? []).some(mixesClasses)) ||
    isSeparatedToken(segment)
  );
}

/**
 * The path as stored, with every segment that looks like an email address,
 * a UUID, a long number or a token replaced by `:id`, so reports never show
 * them. Hash routes are scrubbed the same way.
 */
export function scrubWebPath(path: string): string {
  return (
    path
      // Path parameters (`;jsessionid=…`) carry sessions, not pages.
      .replace(PATH_PARAMETERS_PATTERN, "")
      .split("/")
      .map((segment) =>
        segment && isIdentifier(segment) ? WEB_PATH_ID_PLACEHOLDER : segment
      )
      .join("/")
  );
}
