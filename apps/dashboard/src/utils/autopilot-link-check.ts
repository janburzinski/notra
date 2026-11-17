import {
  AUTOPILOT_LINK_CHECK_BASE_PATTERN,
  AUTOPILOT_LINK_CHECK_FOUND_ON_LIMIT,
  AUTOPILOT_LINK_CHECK_LINK_PATTERN,
  AUTOPILOT_LINK_CHECK_REPORT_LINES,
  AUTOPILOT_LINK_CHECK_SKIPPED_SCHEMES,
} from "@/constants/autopilot-link-check";
import type {
  AutopilotBrokenLink,
  AutopilotMissingPage,
  AutopilotUnreachableLink,
} from "@/types/autopilot-link-check";

const WWW = /^www\./;
const AMPERSAND = /&(?:amp|#0*38|#x0*26);/gi;

export function siteHost(url: string | URL) {
  return new URL(url).hostname.toLowerCase().replace(WWW, "");
}

/** The page's path as a reader sees it, for lists of where a link sits. */
export function pagePath(url: string) {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function attributeValue(match: RegExpMatchArray) {
  return (match[1] ?? match[2] ?? match[3] ?? "")
    .trim()
    .replace(AMPERSAND, "&");
}

/** What relative links resolve against: the page's <base href>, else the page. */
function documentBase(html: string, pageUrl: string) {
  const match = html.match(AUTOPILOT_LINK_CHECK_BASE_PATTERN);
  if (!match) {
    return pageUrl;
  }
  try {
    return new URL(attributeValue(match), pageUrl).href;
  } catch {
    return pageUrl;
  }
}

/**
 * Every http(s) link in a page's HTML, absolute as a browser resolves it
 * (with the page's <base href>), without its #section (the page answers the
 * same either way), each once. Mail, phone and script links are left out.
 */
export function extractPageLinks(html: string, pageUrl: string) {
  const base = documentBase(html, pageUrl);
  const links = new Set<string>();
  for (const match of html.matchAll(AUTOPILOT_LINK_CHECK_LINK_PATTERN)) {
    const raw = attributeValue(match);
    if (!raw || raw.startsWith("#")) {
      continue;
    }
    if (AUTOPILOT_LINK_CHECK_SKIPPED_SCHEMES.test(raw)) {
      continue;
    }
    let url: URL;
    try {
      url = new URL(raw, base);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      continue;
    }
    url.hash = "";
    links.add(url.href);
  }
  return [...links];
}

function foundOn(pages: string[]) {
  const shown = pages.slice(0, AUTOPILOT_LINK_CHECK_FOUND_ON_LIMIT).join(", ");
  const more = pages.length - AUTOPILOT_LINK_CHECK_FOUND_ON_LIMIT;
  return more > 0 ? `${shown} and ${more} more` : shown;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function lines<T>(
  title: string,
  rows: readonly T[],
  line: (row: T) => string
): string[] {
  if (rows.length === 0) {
    return [];
  }
  const shown = rows.slice(0, AUTOPILOT_LINK_CHECK_REPORT_LINES).map(line);
  const more = rows.length - shown.length;
  return [
    "",
    `*${title}*`,
    ...shown.map((row) => `• ${row}`),
    ...(more > 0 ? [`• and ${more} more`] : []),
  ];
}

/**
 * One sentence for a condition or a short message, and a report ready to post
 * to Slack. Links on the site itself come first: those the team can fix.
 */
export function describeLinkCheck(params: {
  site: string;
  pagesChecked: number;
  pagesFailed: number;
  linksChecked: number;
  skipped: number;
  broken: AutopilotBrokenLink[];
  unreachable: AutopilotUnreachableLink[];
  missingPages: AutopilotMissingPage[];
  days: number;
}) {
  const { broken, unreachable, missingPages } = params;
  const own = broken.filter((link) => link.internal).length;
  const findings = [
    broken.length > 0
      ? `${plural(broken.length, "broken link")}${own > 0 ? ` (${own} to your own pages)` : ""}`
      : "no broken links",
    unreachable.length > 0 ? `${unreachable.length} that didn't answer` : null,
  ].filter(Boolean);
  const visitors =
    missingPages.length > 0
      ? ` Visitors opened ${plural(missingPages.length, "missing page")} in the last ${params.days === 1 ? "day" : `${params.days} days`}.`
      : "";
  const limits = [
    params.skipped > 0
      ? `${params.skipped} more links weren't checked this time`
      : null,
    params.pagesFailed > 0
      ? `${plural(params.pagesFailed, "page")} didn't load`
      : null,
  ].filter(Boolean);
  const summary = `Checked ${plural(params.linksChecked, "link")} on ${plural(params.pagesChecked, "page")} of ${params.site}: ${findings.join(", ")}.${visitors}${limits.length > 0 ? ` ${limits.join("; ")}.` : ""}`;
  const sorted = [...broken].sort(
    (a, b) => Number(b.internal) - Number(a.internal)
  );
  const report = [
    summary,
    ...lines(
      "Broken links",
      sorted,
      (link) => `${link.url} (${link.status}) on ${foundOn(link.foundOn)}`
    ),
    ...lines(
      "Missing pages visitors opened",
      missingPages,
      (page) => `${page.path} (${plural(page.views, "view")})`
    ),
    ...lines(
      "Didn't answer (may be down or blocking checks)",
      unreachable,
      (link) => `${link.url} on ${foundOn(link.foundOn)}`
    ),
  ].join("\n");
  return { summary, report };
}
