import { fetchWebpage } from "@notra/ai/utils/context-dev";
import { fetchPublicUrl } from "@notra/ai/utils/public-fetch";

import {
  AUTOPILOT_LINK_CHECK_GONE_STATUSES,
  AUTOPILOT_LINK_CHECK_LINK_TIMEOUT_MS,
  AUTOPILOT_LINK_CHECK_USER_AGENT,
} from "@/constants/autopilot-link-check";
import {
  AUTOPILOT_REFRESH_LINK_TIMEOUT_MS,
  AUTOPILOT_REFRESH_MAX_LINK_CHECKS,
} from "@/constants/autopilot-refresh";
import {
  AUTOPILOT_RENDERING_CRAWLER_USER_AGENT,
  AUTOPILOT_RENDERING_FETCH_TIMEOUT_MS,
  AUTOPILOT_RENDERING_HTML_MAX_BYTES,
  AUTOPILOT_RENDERING_MAX_REDIRECTS,
} from "@/constants/autopilot-rendering";
import type { AutopilotLinkStatus } from "@/types/autopilot-link-check";
import type { AutopilotPageFetch } from "@/types/autopilot-templates-runtime";
import {
  htmlTextAttributes,
  htmlToText,
  isChallengePage,
  markdownToText,
} from "@/utils/autopilot-rendering";

/**
 * GET from the dashboard server to a public address only. The shared helper
 * pins each connection to the address it checked and checks every redirect,
 * so a site that redirects or resolves to a private address is refused.
 */
function fetchPublic(
  url: string,
  timeoutMs: number,
  redirect: RequestRedirect = "follow",
  userAgent = AUTOPILOT_RENDERING_CRAWLER_USER_AGENT
) {
  return fetchPublicUrl(
    url,
    {
      redirect,
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml",
      },
    },
    { timeoutMs, maxRedirects: AUTOPILOT_RENDERING_MAX_REDIRECTS }
  );
}

/**
 * The body up to a byte limit; the rest is never downloaded, so a site that
 * answers with a huge page can't fill the server's memory.
 */
async function readLimited(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (bytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done) {
      return text + decoder.decode();
    }
    const chunk = value.subarray(0, maxBytes - bytes);
    bytes += chunk.byteLength;
    text += decoder.decode(chunk, { stream: true });
  }
  await reader.cancel();
  return text + decoder.decode();
}

/** The page as ChatGPT's browsing agent gets it: the server's HTML, no JavaScript. */
async function fetchAsCrawler(url: string) {
  try {
    const response = await fetchPublic(
      url,
      AUTOPILOT_RENDERING_FETCH_TIMEOUT_MS
    );
    const html = await readLimited(
      response,
      AUTOPILOT_RENDERING_HTML_MAX_BYTES
    );
    return {
      status: response.status,
      text: htmlToText(html),
      attributes: htmlTextAttributes(html),
      challenged: isChallengePage(html, response.status),
    };
  } catch {
    return { status: null, text: "", attributes: "", challenged: false };
  }
}

/** A page's text as its server sends it; null when it doesn't load. */
export async function fetchPageText(url: string) {
  const page = await fetchAsCrawler(url);
  return page.status && page.status < 400 && !page.challenged
    ? page.text
    : null;
}

/** Image descriptions and labels in a page's server HTML; null when it doesn't load. */
export async function fetchPageAttributes(url: string) {
  const page = await fetchAsCrawler(url);
  return page.status && page.status < 400 && !page.challenged
    ? page.attributes
    : null;
}

/** The page's main content after a browser ran its JavaScript, via context.dev. */
export async function fetchRendered(url: string, maxChars?: number) {
  const page = await fetchWebpage({
    url,
    includeLinks: false,
    includeImages: false,
    timeoutMS: AUTOPILOT_RENDERING_FETCH_TIMEOUT_MS,
  });
  const markdown = maxChars ? page.markdown.slice(0, maxChars) : page.markdown;
  return {
    markdown,
    text: markdownToText(markdown),
    finalUrl: page.metadata?.finalUrl ?? page.url,
  };
}

/** Pages read as Markdown; ones that fail or come back empty are left out. */
export async function readPages(urls: readonly string[], maxChars: number) {
  const pages = await Promise.all(
    urls.map(async (url) => {
      try {
        const page = await fetchRendered(url, maxChars);
        return page.markdown.trim() ? { url, markdown: page.markdown } : null;
      } catch {
        return null;
      }
    })
  );
  return pages.filter((page) => page !== null);
}

export async function fetchPageForCrawlers(
  url: string
): Promise<AutopilotPageFetch & { challenged: boolean }> {
  const [raw, rendered] = await Promise.all([
    fetchAsCrawler(url),
    fetchRendered(url),
  ]);
  return {
    url,
    status: raw.status,
    rawText: raw.text,
    renderedText: rendered.text,
    renderedUrl: rendered.finalUrl,
    challenged: raw.challenged,
  };
}

/**
 * The status a link ends on after its redirects, and where; null after too
 * many redirects. Throws when it can't be reached.
 */
async function followLink(url: string, timeoutMs: number, userAgent?: string) {
  let current = url;
  for (let hop = 0; hop <= AUTOPILOT_RENDERING_MAX_REDIRECTS; hop += 1) {
    const response = await fetchPublic(current, timeoutMs, "manual", userAgent);
    await response.body?.cancel();
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      const next = new URL(location, current);
      // Like a browser, a redirect without its own #section keeps the link's.
      next.hash ||= new URL(current).hash;
      current = next.href;
      continue;
    }
    return { status: response.status, url: current };
  }
  return null;
}

/** Where a link ends up after its redirects; null when it is gone or unreachable. */
async function landingUrl(url: string) {
  const landed = await followLink(url, AUTOPILOT_REFRESH_LINK_TIMEOUT_MS);
  // Bot walls answer 403 to scripts and work for readers; only gone is dead.
  return landed && !AUTOPILOT_LINK_CHECK_GONE_STATUSES.has(landed.status)
    ? landed.url
    : null;
}

/**
 * Whether a link still works for a reader. Only 404 and 410 mean gone: bot
 * walls answer 403 or 429 to scripts and work in a browser. A server error,
 * a timeout or a redirect loop is "unreachable", which may pass on its own.
 */
export async function checkLinkStatus(
  url: string
): Promise<AutopilotLinkStatus> {
  try {
    const landed = await followLink(
      url,
      AUTOPILOT_LINK_CHECK_LINK_TIMEOUT_MS,
      AUTOPILOT_LINK_CHECK_USER_AGENT
    );
    if (!landed || landed.status >= 500) {
      return { kind: "unreachable" };
    }
    return AUTOPILOT_LINK_CHECK_GONE_STATUSES.has(landed.status)
      ? { kind: "gone", status: landed.status }
      : { kind: "ok" };
  } catch {
    return { kind: "unreachable" };
  }
}

/**
 * A page's server HTML as a reader's browser gets it, and the address it
 * landed on; null when it doesn't load.
 */
export async function fetchPageHtml(url: string) {
  try {
    const response = await fetchPublic(
      url,
      AUTOPILOT_RENDERING_FETCH_TIMEOUT_MS,
      "follow",
      AUTOPILOT_LINK_CHECK_USER_AGENT
    );
    if (response.status >= 400) {
      await response.body?.cancel();
      return null;
    }
    const html = await readLimited(
      response,
      AUTOPILOT_RENDERING_HTML_MAX_BYTES
    );
    return { html, url: response.url || url };
  } catch {
    return null;
  }
}

function siteOf(url: URL) {
  return url.hostname.replace(/^www\./, "");
}

/**
 * Links that are gone or unreachable, and links that redirect within their
 * own site with the address they land on. Links past the check limit count as
 * dead: Autopilot never ships a link nobody checked, and the text stays.
 * A redirect to another site is left alone, since it may be a sign-in page.
 */
export async function resolveLinks(urls: string[]) {
  const checked = urls.slice(0, AUTOPILOT_REFRESH_MAX_LINK_CHECKS);
  const dead = urls.slice(AUTOPILOT_REFRESH_MAX_LINK_CHECKS);
  const moved = new Map<string, string>();
  await Promise.all(
    checked.map(async (url) => {
      // Unreachable or private addresses never go into a page.
      const landed = await landingUrl(url).catch(() => null);
      if (landed === null) {
        dead.push(url);
      } else if (
        landed !== url &&
        siteOf(new URL(landed)) === siteOf(new URL(url))
      ) {
        moved.set(url, landed);
      }
    })
  );
  return { dead, moved };
}
