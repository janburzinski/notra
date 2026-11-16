import { findBrandMention } from "@notra/geo-core/utils/geo-brand-mention";

import {
  GEO_SHELF_EXCERPT_MAX_LENGTH,
  GEO_SHELF_LISTICLE_MIN_NUMBERED_ENTRIES,
} from "@/constants/geo-shelf";
import type {
  GeoShelfPageBrand,
  GeoShelfPageBrandResult,
  GeoShelfPageRead,
  GeoShelfPlacement,
  GeoShelfSourceKind,
} from "@/types/geo-shelf";

const PARENTHETICAL = /\s*\([^)]*\)\s*/g;
const WWW_PREFIX = /^www\./;
const MARKDOWN_LINK = /!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const LINK_TARGET = /\]\((https?:\/\/[^)\s]+)/g;
const HEADING_MARKER = /^#{1,6}\s+/;
const LIST_MARKER = /^(?:[-*+]|\d{1,3}[.)])\s+/;
const QUOTE_MARKER = /^>\s*/;
const EMPHASIS = /[*_`~]+/g;
const WHITESPACE_RUN = /\s+/g;
const NON_WORD_RUN = /[^\p{L}\p{M}\p{N}]+/gu;
/** `## 3. Name`, `### #3 Name`, `3) Name`, `**3.** Name`: the number prefix. */
const NUMBERED_ENTRY =
  /^(?:#{1,6}\s+)?\**(?:#(\d{1,3})[.):]?|(\d{1,3})[.):])\**\s+(?=\S)/;
const LISTICLE_TEXT =
  /\b(?:best|top\s+\d+|\d+\s+(?:best|top)|alternatives?\s+to|alternatives)\b/i;
const LISTICLE_SLUG =
  /(?:^|[/-])(?:best|top-\d+|\d+-best|alternatives?)(?:-|$)/i;

function hostOf(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`
    );
    return url.hostname.toLowerCase().replace(WWW_PREFIX, "");
  } catch {
    return null;
  }
}

function sameSite(host: string, brandHost: string): boolean {
  return host === brandHost || host.endsWith(`.${brandHost}`);
}

/**
 * Names like "Linear Releases (Linear)" never appear verbatim on a page, so
 * the bare name and the brand's domain are matched too.
 */
function brandTerms(brand: GeoShelfPageBrand): {
  name: string;
  aliases: string[];
} {
  const bare = brand.name.replace(PARENTHETICAL, " ").trim();
  const host = hostOf(brand.domain);
  const aliases = [bare, ...brand.aliases, ...(host ? [host] : [])].filter(
    (term) => term.length > 0 && term !== brand.name
  );
  return { name: brand.name, aliases };
}

function plainText(line: string): string {
  return line
    .replace(MARKDOWN_LINK, "$1")
    .replace(HEADING_MARKER, "")
    .replace(QUOTE_MARKER, "")
    .replace(LIST_MARKER, "")
    .replace(EMPHASIS, "")
    .replace(WHITESPACE_RUN, " ")
    .trim();
}

function clip(text: string): string {
  if (text.length <= GEO_SHELF_EXCERPT_MAX_LENGTH) {
    return text;
  }
  return `${text.slice(0, GEO_SHELF_EXCERPT_MAX_LENGTH - 1).trimEnd()}…`;
}

function linksTo(text: string, brandHost: string | null): boolean {
  if (!brandHost) {
    return false;
  }
  for (const match of text.matchAll(LINK_TARGET)) {
    const host = hostOf(match[1] ?? null);
    if (host && sameSite(host, brandHost)) {
      return true;
    }
  }
  return false;
}

/** The entry number and the text after it, for a numbered line. */
function numberedEntry(line: string): { number: number; rest: string } | null {
  const trimmed = line.trim();
  const entry = NUMBERED_ENTRY.exec(trimmed);
  const digits = entry?.[1] ?? entry?.[2];
  if (!(entry && digits)) {
    return null;
  }
  return {
    number: Number.parseInt(digits, 10),
    rest: trimmed.slice(entry[0].length),
  };
}

function wordsOf(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(NON_WORD_RUN, " ").trim();
}

/**
 * The number the page itself gives the brand, when it numbers its entries.
 * Only an entry that starts with the brand counts, so "2. Install the Acme
 * app" in a how-to list does not rank Acme second.
 */
function numberedPosition(
  lines: readonly string[],
  terms: readonly string[]
): number | null {
  const needles = terms.map(wordsOf).filter((term) => term.length > 0);
  for (const line of lines) {
    const entry = numberedEntry(line);
    if (!entry) {
      continue;
    }
    const lead = wordsOf(plainText(entry.rest));
    if (
      needles.some((needle) => lead === needle || lead.startsWith(`${needle} `))
    ) {
      return entry.number;
    }
  }
  return null;
}

function readBrand(
  brand: GeoShelfPageBrand,
  markdown: string,
  lines: readonly string[]
): GeoShelfPageBrandResult {
  const terms = brandTerms(brand);
  const brandHost = hostOf(brand.domain);
  // A link to the brand's site lists it even when the anchor text is
  // "Visit website" and the name is never spelled out.
  const matches = (line: string) =>
    findBrandMention(plainText(line), terms.name, terms.aliases) !== null ||
    linksTo(line, brandHost);
  const mentioned = lines.filter(matches);
  if (mentioned.length === 0) {
    return {
      competitorId: brand.competitorId,
      status: "absent",
      position: null,
      hasLink: false,
      excerpt: null,
    };
  }
  // Prose explains why the page names the brand; a bare heading rarely does.
  const prose =
    mentioned.find((line) => !HEADING_MARKER.test(line.trim())) ??
    mentioned[0] ??
    "";
  const position = numberedPosition(lines, [terms.name, ...terms.aliases]);
  return {
    competitorId: brand.competitorId,
    status: "present",
    position: position && position > 0 ? position : null,
    hasLink: linksTo(markdown, brandHost),
    excerpt: clip(plainText(prose)) || null,
  };
}

function countNumberedEntries(lines: readonly string[]): number {
  const numbers = new Set<number>();
  for (const line of lines) {
    const entry = numberedEntry(line);
    if (entry && HEADING_MARKER.test(line.trim())) {
      numbers.add(entry.number);
    }
  }
  return numbers.size;
}

/**
 * Domain rules only know a few platforms, so a page still filed as "other"
 * is checked for the shape of a ranked list: a "best/top/alternatives" title
 * or slug, or several numbered headings.
 */
function readShelfPageKind(input: {
  currentKind: GeoShelfSourceKind;
  url: string;
  title: string | null;
  lines: readonly string[];
}): GeoShelfSourceKind {
  if (input.currentKind !== "other") {
    return input.currentKind;
  }
  let path = "";
  try {
    path = new URL(input.url).pathname;
  } catch {
    path = "";
  }
  const firstHeading = input.lines.find((line) =>
    HEADING_MARKER.test(line.trim())
  );
  const looksRanked =
    LISTICLE_SLUG.test(path) ||
    LISTICLE_TEXT.test(input.title ?? "") ||
    LISTICLE_TEXT.test(firstHeading ? plainText(firstHeading) : "") ||
    countNumberedEntries(input.lines) >=
      GEO_SHELF_LISTICLE_MIN_NUMBERED_ENTRIES;
  return looksRanked ? "listicle" : "other";
}

/** Reads one fetched page: which tracked brands it names, where and how. */
export function readShelfPage(input: {
  url: string;
  title: string | null;
  markdown: string;
  currentKind: GeoShelfSourceKind;
  brands: readonly GeoShelfPageBrand[];
}): GeoShelfPageRead {
  const lines = input.markdown
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  return {
    kind: readShelfPageKind({
      currentKind: input.currentKind,
      url: input.url,
      title: input.title,
      lines,
    }),
    brands: input.brands.map((brand) =>
      readBrand(brand, input.markdown, lines)
    ),
  };
}

/**
 * Writes what the page reader found, except where a teammate already set a
 * brand by hand: their present/absent call wins over the fetch.
 */
export function mergeFetchedPlacements(input: {
  existing: readonly GeoShelfPlacement[];
  brands: readonly GeoShelfPageBrand[];
  results: readonly GeoShelfPageBrandResult[];
  checkedAt: string;
}): GeoShelfPlacement[] {
  const key = (competitorId: string | null) => competitorId ?? "";
  const existingByBrand = new Map(
    input.existing.map((placement) => [key(placement.competitorId), placement])
  );
  const resultByBrand = new Map(
    input.results.map((result) => [key(result.competitorId), result])
  );
  const written = new Set<string>();
  const next: GeoShelfPlacement[] = [];
  for (const brand of input.brands) {
    const brandKey = key(brand.competitorId);
    const previous = existingByBrand.get(brandKey);
    const result = resultByBrand.get(brandKey);
    written.add(brandKey);
    if (
      (previous?.evidence === "manual" && previous.status !== "unknown") ||
      !result
    ) {
      if (previous) {
        next.push(previous);
      }
      continue;
    }
    next.push({
      competitorId: brand.competitorId,
      brandName: brand.name,
      brandDomain: brand.domain,
      status: result.status,
      position: result.status === "present" ? result.position : null,
      hasLink: result.status === "present" && result.hasLink,
      evidence: "fetch",
      excerpt: result.status === "present" ? result.excerpt : null,
      checkedAt: input.checkedAt,
    });
  }
  // Brands that are no longer tracked keep whatever was stored for them.
  for (const placement of input.existing) {
    if (!written.has(key(placement.competitorId))) {
      next.push(placement);
    }
  }
  return next;
}
