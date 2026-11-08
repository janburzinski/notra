import {
  WEB_PATH_DIGIT_RUN_PATTERN,
  WEB_PATH_EMAIL_PATTERN,
  WEB_PATH_ID_PLACEHOLDER,
  WEB_PATH_TOKEN_RUN_PATTERN,
  WEB_PATH_TOKEN_SEGMENT_PATTERN,
  WEB_PATH_UUID_PATTERN,
} from "../constants/web-analytics";

/** Whether the text mixes at least two of lowercase, uppercase and digits. */
export function mixesClasses(run: string): boolean {
  const classes = [/[a-z]/, /[A-Z]/, /\d/].filter((pattern) =>
    pattern.test(run)
  );
  return classes.length >= 2;
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
    WEB_PATH_TOKEN_SEGMENT_PATTERN.test(segment) &&
    (segment.match(WEB_PATH_TOKEN_RUN_PATTERN) ?? []).some(mixesClasses)
  );
}

/**
 * The path as stored, with every segment that looks like an email address,
 * a UUID, a long number or a token replaced by `:id`, so reports never show
 * them. Hash routes are scrubbed the same way.
 */
export function scrubWebPath(path: string): string {
  return path
    .split("/")
    .map((segment) =>
      segment && isIdentifier(segment) ? WEB_PATH_ID_PLACEHOLDER : segment
    )
    .join("/");
}
