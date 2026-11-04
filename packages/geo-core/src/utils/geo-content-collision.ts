import {
  GEO_COLLISION_MERGE_TARGET_LIMIT,
  GEO_COLLISION_MIN_TOKEN_LENGTH,
  GEO_COLLISION_ORDERED_TITLE_BONUS,
  GEO_COLLISION_PARTIAL_SCORE,
  GEO_COLLISION_STOPWORDS,
  GEO_COLLISION_STRONG_SCORE,
  GEO_SEARCH_GAP_MIN_IMPRESSIONS,
  GEO_SEARCH_GAP_RANKING_MAX_POSITION,
  GEO_TRACKING_PARAM_RE,
  GEO_SEARCH_GAP_SECTION_ADVICE,
} from "../constants/geo";
import type {
  GeoContentCollisionCandidate,
  GeoContentCollisionGap,
  GeoContentCollisionMatch,
  GeoSearchGapRankingPage,
  GeoSearchGapRecommendation,
  GeoSearchGapRecommendationInput,
  GeoSuggestionKeyword,
} from "../types/geo";
import { searchGapImpressions, searchGapPosition } from "./geo-gaps";
import { buyingIntentSection } from "./gsc-buying-intent";

const NON_WORD_RE = /[^\p{L}\p{N}\s]+/gu;
const WHITESPACE_RE = /\s+/;
const SLUG_SEPARATOR_RE = /[-_]+/g;
const ING_SUFFIX_RE = /ing$/;
const ES_SUFFIX_RE = /es$/;
const S_SUFFIX_RE = /s$/;
const STEM_MIN_LENGTH = 4;
const PERCENT = 100;
const WWW_PREFIX_RE = /^www\./;
const TRAILING_SLASH_RE = /\/+$/;

function stem(token: string): string {
  if (token.length <= STEM_MIN_LENGTH) {
    return token;
  }
  if (ING_SUFFIX_RE.test(token)) {
    return token.replace(ING_SUFFIX_RE, "");
  }
  if (ES_SUFFIX_RE.test(token)) {
    return token.replace(ES_SUFFIX_RE, "");
  }
  return token.replace(S_SUFFIX_RE, "");
}

function collisionTokens(text: string): string[] {
  const tokens: string[] = [];
  const words = text
    .toLowerCase()
    .replace(NON_WORD_RE, " ")
    .split(WHITESPACE_RE);
  for (const word of words) {
    if (
      word.length < GEO_COLLISION_MIN_TOKEN_LENGTH ||
      GEO_COLLISION_STOPWORDS.has(word)
    ) {
      continue;
    }
    tokens.push(stem(word));
  }
  return tokens;
}

function termSet(parts: readonly string[]): Set<string> {
  const terms = new Set<string>();
  for (const part of parts) {
    for (const token of collisionTokens(part)) {
      terms.add(token);
    }
  }
  return terms;
}

function lastPathSegmentWords(url: string | null): string {
  if (!url) {
    return "";
  }
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  const last = segments.at(-1) ?? "";
  return last.replace(SLUG_SEPARATOR_RE, " ");
}

function slugWords(slug: string | null): string {
  return slug ? slug.replace(SLUG_SEPARATOR_RE, " ") : "";
}

function candidateTerms(candidate: GeoContentCollisionCandidate): Set<string> {
  const extra =
    candidate.kind === "page"
      ? lastPathSegmentWords(candidate.url)
      : slugWords(candidate.slug);
  return termSet([candidate.title ?? "", extra]);
}

function containsInOrder(
  tokens: readonly string[],
  first: string,
  second: string
): boolean {
  const firstIndex = tokens.indexOf(first);
  if (firstIndex < 0) {
    return false;
  }
  return tokens.includes(second, firstIndex + 1);
}

function candidateTitle(candidate: GeoContentCollisionCandidate): string {
  const title = candidate.title?.trim();
  if (title) {
    return title;
  }
  return candidate.url ?? candidate.slug ?? candidate.id;
}

export function scoreContentCollisions(
  gap: GeoContentCollisionGap,
  candidates: readonly GeoContentCollisionCandidate[]
): GeoContentCollisionMatch[] {
  const gapTerms = termSet([gap.prompt, gap.title ?? "", ...gap.queries]);
  if (gapTerms.size === 0) {
    return [];
  }
  const [firstQueryToken, secondQueryToken] = collisionTokens(
    gap.queries[0] ?? ""
  );
  const orderedPair: [string, string] | null =
    firstQueryToken && secondQueryToken
      ? [firstQueryToken, secondQueryToken]
      : null;

  const matches: GeoContentCollisionMatch[] = [];
  for (const candidate of candidates) {
    const terms = candidateTerms(candidate);
    if (terms.size === 0) {
      continue;
    }
    let shared = 0;
    for (const term of gapTerms) {
      if (terms.has(term)) {
        shared += 1;
      }
    }
    if (shared === 0) {
      continue;
    }
    let score = shared / gapTerms.size;
    if (
      orderedPair &&
      containsInOrder(
        collisionTokens(candidate.title ?? ""),
        orderedPair[0],
        orderedPair[1]
      )
    ) {
      score += GEO_COLLISION_ORDERED_TITLE_BONUS;
    }
    matches.push({
      kind: candidate.kind,
      id: candidate.id,
      url: candidate.url,
      title: candidateTitle(candidate),
      score: Math.min(1, score),
    });
  }
  matches.sort(
    (left, right) =>
      right.score - left.score || left.title.localeCompare(right.title)
  );
  return matches;
}

function percent(score: number): number {
  return Math.round(score * PERCENT);
}

/** Same page despite "www.", a trailing slash or the protocol; query strings stay distinct. */
function pageKey(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(WWW_PREFIX_RE, "");
    return `${host}${parsed.pathname.replace(TRAILING_SLASH_RE, "")}${parsed.search}`;
  } catch {
    return url.trim().toLowerCase().replace(TRAILING_SLASH_RE, "");
  }
}

function isHomepage(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.replace(TRAILING_SLASH_RE, "") !== "") {
      return false;
    }
    // "/?utm_source=…" is the homepage; "/?p=123" (WordPress plain permalinks) is a post.
    return [...parsed.searchParams.keys()].every((name) =>
      GEO_TRACKING_PARAM_RE.test(name)
    );
  } catch {
    return false;
  }
}

/**
 * The page Search Console shows most for a gap's queries, among pages on
 * Google's first two pages. Updating the page Google already trusts beats a
 * new page that has to start from zero. The homepage is never a target: it
 * ranks for everything and is not where a comparison or pricing section goes.
 */
export function searchGapRankingPage(
  keywords: readonly GeoSuggestionKeyword[] | null | undefined
): GeoSearchGapRankingPage | null {
  // "www.", protocol and trailing-slash variants of one URL are one page.
  const byPage = new Map<string, GeoSuggestionKeyword[]>();
  for (const keyword of keywords ?? []) {
    if (keyword.page && !isHomepage(keyword.page)) {
      const key = pageKey(keyword.page);
      byPage.set(key, [...(byPage.get(key) ?? []), keyword]);
    }
  }
  let top: GeoSearchGapRankingPage | null = null;
  let topImpressions = -1;
  for (const onPage of byPage.values()) {
    // The page's own share and position; the query's totals are the fallback.
    const shown = onPage.map((keyword) => ({
      url: keyword.page ?? "",
      query: keyword.query,
      impressions: keyword.pageImpressions ?? keyword.impressions,
      position: keyword.pagePosition ?? keyword.position,
    }));
    const position = searchGapPosition(shown);
    if (position === null || position > GEO_SEARCH_GAP_RANKING_MAX_POSITION) {
      continue;
    }
    const impressions = searchGapImpressions(shown) ?? 0;
    if (impressions <= topImpressions) {
      continue;
    }
    const byImpressions = [...shown].sort(
      (left, right) => right.impressions - left.impressions
    );
    const section =
      byImpressions
        .map((item) => buyingIntentSection(item.query))
        .find((value) => value !== null) ?? null;
    top = { url: byImpressions[0]?.url ?? "", position, section };
    topImpressions = impressions;
  }
  return top;
}

function rankingPageReason(page: GeoSearchGapRankingPage): string {
  const ranked = `Google already ranks this page at #${page.position} for these queries`;
  if (page.section) {
    return `${ranked}. Add ${GEO_SEARCH_GAP_SECTION_ADVICE[page.section]} near the top instead of publishing a new page.`;
  }
  return `${ranked}; update it to answer them instead of publishing a new page.`;
}

/** The ranking page as a target, with its title when Notra knows the page. */
function rankingTarget(
  url: string,
  matches: readonly GeoContentCollisionMatch[],
  candidates: readonly GeoContentCollisionCandidate[]
): { match: GeoContentCollisionMatch; known: boolean } {
  const key = pageKey(url);
  const sameUrl = (other: string | null) =>
    other !== null && pageKey(other) === key;
  const scored = matches.find((match) => sameUrl(match.url));
  if (scored) {
    return { match: scored, known: true };
  }
  const candidate = candidates.find((item) => sameUrl(item.url));
  if (candidate) {
    return {
      match: {
        kind: candidate.kind,
        id: candidate.id,
        url: candidate.url,
        title: candidateTitle(candidate),
        score: 0,
      },
      known: true,
    };
  }
  return {
    match: { kind: "page", id: url, url, title: url, score: 0 },
    known: false,
  };
}

export function recommendSearchGapAction({
  matches,
  impressions,
  clicks,
  rankingPage,
  candidates = [],
}: GeoSearchGapRecommendationInput): GeoSearchGapRecommendation {
  const impressionCount = impressions ?? 0;
  const clickCount = clicks ?? 0;
  const thinDemand =
    impressions !== null &&
    impressionCount < GEO_SEARCH_GAP_MIN_IMPRESSIONS &&
    clickCount === 0;
  const best = matches[0];
  const strongMatch =
    best !== undefined && best.score >= GEO_COLLISION_STRONG_SCORE;
  if (rankingPage && !thinDemand) {
    const target = rankingTarget(rankingPage.url, matches, candidates);
    // A page Notra has never seen does not outrank a page it knows covers the gap.
    if (target.known || !strongMatch) {
      return {
        action: "update",
        reason: rankingPageReason(rankingPage),
        targets: [{ ...target.match, googlePosition: rankingPage.position }],
      };
    }
  }
  if (best && strongMatch) {
    return {
      action: "update",
      reason: `Existing page covers ${percent(best.score)}% of this query cluster; update it instead of publishing a duplicate.`,
      targets: [best],
    };
  }
  const partial = matches.filter(
    (match) => match.score >= GEO_COLLISION_PARTIAL_SCORE
  );
  if (partial.length >= 2) {
    const targets = partial.slice(0, GEO_COLLISION_MERGE_TARGET_LIMIT);
    return {
      action: "merge",
      reason: `${targets.length} existing pages each cover part of this query cluster; merge them into one page instead of adding a third angle.`,
      targets,
    };
  }
  if (thinDemand) {
    return {
      action: "ignore",
      reason: `Only ${impressionCount} impressions and no clicks so far; the demand is too thin to justify a new page yet.`,
      targets: [],
    };
  }
  if (best) {
    return {
      action: "create",
      reason: `The closest existing page covers only ${percent(best.score)}% of this query cluster; a dedicated page can own it.`,
      targets: [best],
    };
  }
  return {
    action: "create",
    reason:
      "No existing page or post covers this query cluster; a new page can own it.",
    targets: [],
  };
}
