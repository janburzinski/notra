import { WEB_ERROR_MESSAGE_MAX_LENGTH } from "../constants/web-analytics";
import { mixesClasses } from "./web-path-scrub";

// `%40` is an encoded `@`, as in a request URL quoted by an error. Neither
// side spans a `/`, so an email in a URL path never swallows its host.
const EMAIL_PATTERN =
  /[^\s@"'<>(),;:/]+(?:@|%40)[^\s@"'<>(),;:/]+\.[a-z]{2,}/gi;
const IPV4_PATTERN = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const URL_QUERY_PATTERN = /(\b[a-z][\w+.-]*:\/\/[^\s?#"'<>]*)[?#][^\s"'<>]*/gi;
const RELATIVE_QUERY_PATTERN =
  /((?:^|[\s"'(=])\.{0,2}\/[^\s?#"'<>()]*)[?#][^\s"'<>()]*/g;
// JWTs, base64url secrets and prefixed keys such as sk_live_…: 20 or more
// id characters, optionally dot-joined, mixing letters with digits or cases.
const TOKEN_PATTERN = /[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]{4,})*/g;
const DIGIT_RUN_PATTERN = /\d{4,}/g;
// Hex ids and tokens (UUID parts, hashes) that include at least one digit.
const HEX_TOKEN_PATTERN = /\b(?=[a-f]*\d)[0-9a-f]{16,}\b/gi;
const WHITESPACE_PATTERN = /\s+/g;

/** Replaces email addresses in free text supplied by a page. */
export function scrubWebText(value: string): string {
  return value.replace(EMAIL_PATTERN, "[email]");
}

/**
 * Error messages and sources can quote whatever the page was handling.
 * Before storage: queries and fragments of absolute and relative URLs go,
 * emails become `[email]`, tokens, IPv4 addresses, long hex ids and runs of
 * four or more digits become `#`, whitespace collapses and the result is
 * capped. No stack is ever accepted.
 */
export function scrubWebErrorText(value: string): string {
  return scrubWebText(
    value.replace(URL_QUERY_PATTERN, "$1").replace(RELATIVE_QUERY_PATTERN, "$1")
  )
    .replace(TOKEN_PATTERN, (token) => (mixesClasses(token) ? "#" : token))
    .replace(IPV4_PATTERN, "#")
    .replace(HEX_TOKEN_PATTERN, "#")
    .replace(DIGIT_RUN_PATTERN, "#")
    .replace(WHITESPACE_PATTERN, " ")
    .trim()
    .slice(0, WEB_ERROR_MESSAGE_MAX_LENGTH);
}
