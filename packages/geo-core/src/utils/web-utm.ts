import {
  WEB_PATH_EMAIL_PATTERN,
  WEB_PATH_ID_PLACEHOLDER,
  WEB_PATH_TOKEN_RUN_PATTERN,
  WEB_PATH_UUID_PATTERN,
  WEB_UTM_CAMPAIGN_MAX_LENGTH,
} from "../constants/web-analytics";
import { isSeparatedToken, mixesClasses } from "./web-path-scrub";

/**
 * A free-text UTM parameter (campaign, term or content) as stored: trimmed,
 * cut to length, and `:id` when it looks like an email address, a UUID or a
 * token, so a link tagged per recipient never puts them in reports.
 */
export function scrubWebUtmText(value: string | null | undefined): string {
  const text = (value ?? "").trim().slice(0, WEB_UTM_CAMPAIGN_MAX_LENGTH);
  const identifies =
    WEB_PATH_EMAIL_PATTERN.test(text) ||
    WEB_PATH_UUID_PATTERN.test(text) ||
    (text.match(WEB_PATH_TOKEN_RUN_PATTERN) ?? []).some(mixesClasses) ||
    isSeparatedToken(text);
  return identifies ? WEB_PATH_ID_PLACEHOLDER : text;
}
