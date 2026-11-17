/** Pages one check reads by default, and at most; the homepage is always one. */
export const AUTOPILOT_LINK_CHECK_DEFAULT_PAGES = 25;
export const AUTOPILOT_LINK_CHECK_MAX_PAGES = 50;

/**
 * Distinct links one check requests. Each is one request to someone's site,
 * and the step has to finish inside one function call.
 */
export const AUTOPILOT_LINK_CHECK_MAX_LINKS = 200;

/**
 * Reads pages as a reader's browser gets them. Sites that serve Markdown to
 * AI agents (Notra Sites does) would hide their links from the crawler agent.
 */
export const AUTOPILOT_LINK_CHECK_USER_AGENT =
  "Mozilla/5.0 (compatible; NotraLinkCheck/1.0; +https://www.usenotra.com)";

export const AUTOPILOT_LINK_CHECK_PAGE_CONCURRENCY = 4;
export const AUTOPILOT_LINK_CHECK_LINK_CONCURRENCY = 10;
export const AUTOPILOT_LINK_CHECK_LINK_TIMEOUT_MS = 8000;

/** Pages a broken link is listed on in the output, and links listed per group. */
export const AUTOPILOT_LINK_CHECK_FOUND_ON_LIMIT = 3;
export const AUTOPILOT_LINK_CHECK_LIST_LIMIT = 25;

/** Visitor 404s: how far back by default, and how many paths are listed. */
export const AUTOPILOT_LINK_CHECK_DEFAULT_DAYS = 7;
export const AUTOPILOT_LINK_CHECK_MISSING_LIMIT = 20;
/**
 * Rows asked for before keeping the checked site's: the query's host filter
 * also matches subdomains, which could otherwise fill the whole list.
 */
export const AUTOPILOT_LINK_CHECK_MISSING_QUERY_LIMIT = 200;

/** Lines per group in the ready-to-post report; the counts cover the rest. */
export const AUTOPILOT_LINK_CHECK_REPORT_LINES = 10;

/** Statuses that mean the page is gone. Bot walls (403, 429) answer scripts only. */
export const AUTOPILOT_LINK_CHECK_GONE_STATUSES: ReadonlySet<number> = new Set([
  404, 410,
]);

/** An <a>'s own href; whitespace before it rules out data-href and the like. */
export const AUTOPILOT_LINK_CHECK_LINK_PATTERN =
  /<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
export const AUTOPILOT_LINK_CHECK_BASE_PATTERN =
  /<base\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
export const AUTOPILOT_LINK_CHECK_SKIPPED_SCHEMES =
  /^(?:mailto|tel|javascript|data|sms|ftp):/i;
