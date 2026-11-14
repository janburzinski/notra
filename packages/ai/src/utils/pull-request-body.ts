import { PULL_REQUEST_BODY_PREVIEW_MAX_CHARS } from "@notra/ai/constants/github";

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\([^)]*\)/g;
const HTML_IMAGE_RE = /<img\b[^>]*>/gi;
const VIDEO_URL_RE =
  /^https:\/\/github\.com\/user-attachments\/assets\/[\w-]+$/gm;
const CODE_FENCE_RE = /```[\s\S]*?(?:```|$)/g;
const HTML_TAG_RE = /<\/?[a-z][^>]*>/gi;
const CRLF_RE = /\r\n/g;
const HEADING_RE = /^#{1,6}\s+(.*)$/;
const WHITESPACE_RE = /\s+/g;
/** Template and bot sections that say nothing about what shipped. */
const SKIPPED_SECTION_RE =
  /\b(?:summary by|screenshots?|recordings?|testing|test plan|checklist|how to test|notes? for reviewers)\b/i;
/** Conventional commit types that never reach readers. A `!` breaking marker
 * does not match, so breaking changes keep their description. */
const INTERNAL_TITLE_RE =
  /^(?:build|chore|ci|docs|refactor|revert|style|test)(?:\([^)]*\))?:/i;

/** Bots that open dependency, CI and release chores. Coding agents are not
 * listed: their pull requests can ship features. */
const MAINTENANCE_BOT_LOGIN_RE =
  /^(?:dependabot|renovate|renovate-bot|github-actions|snyk-bot|pre-commit-ci|mergify|imgbot|allcontributors|release-please|changeset-bot|depfu|pyup-bot)(?:\[bot\])?$/i;

export function isMaintenanceBotLogin(
  login: string | null | undefined
): boolean {
  return Boolean(login && MAINTENANCE_BOT_LOGIN_RE.test(login));
}

export function isInternalPullRequestTitle(title: string): boolean {
  return INTERNAL_TITLE_RE.test(title.trim());
}

/** Keeps the prose of a description, without template and bot sections. */
function describeBody(body: string): string {
  const kept: string[] = [];
  let skipping = false;
  for (const line of body.split("\n")) {
    const heading = HEADING_RE.exec(line);
    if (heading) {
      skipping = SKIPPED_SECTION_RE.test(heading[1] ?? "");
      continue;
    }
    if (!skipping) {
      kept.push(line);
    }
  }
  return kept.join(" ").replace(WHITESPACE_RE, " ").trim();
}

/**
 * Shortens a pull request description for a list of many pull requests:
 * keeps the prose of its description as one line and cuts it at a fixed
 * length. Template comments, code blocks, screenshots and bot summaries are
 * dropped. `mediaCount` says how many screenshots or videos it had.
 */
export function previewPullRequestBody(body: string | null | undefined): {
  body: string | null;
  bodyTruncated: boolean;
  mediaCount: number;
} {
  if (!body?.trim()) {
    return { body: null, bodyTruncated: false, mediaCount: 0 };
  }
  let mediaCount = 0;
  const countMedia = () => {
    mediaCount += 1;
    return "";
  };
  const cleaned = describeBody(
    body
      .replace(CRLF_RE, "\n")
      .replace(HTML_COMMENT_RE, "")
      .replace(MARKDOWN_IMAGE_RE, countMedia)
      .replace(HTML_IMAGE_RE, countMedia)
      .replace(VIDEO_URL_RE, countMedia)
      .replace(CODE_FENCE_RE, "")
      .replace(HTML_TAG_RE, "")
  );
  if (!cleaned) {
    return { body: null, bodyTruncated: false, mediaCount };
  }
  if (cleaned.length <= PULL_REQUEST_BODY_PREVIEW_MAX_CHARS) {
    return { body: cleaned, bodyTruncated: false, mediaCount };
  }
  return {
    body: `${cleaned.slice(0, PULL_REQUEST_BODY_PREVIEW_MAX_CHARS).trimEnd()}…`,
    bodyTruncated: true,
    mediaCount,
  };
}
