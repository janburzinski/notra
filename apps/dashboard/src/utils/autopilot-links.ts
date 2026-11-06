import { createHash } from "node:crypto";

import type { GscQueryPageRow } from "@notra/ai/types/google-search-console";
import type { AutopilotInternalLink } from "@notra/db/types/autopilot";

import {
  AUTOPILOT_LINKS_ANCHORS_PER_TARGET,
  AUTOPILOT_LINKS_CONTEXT_CHARS,
  AUTOPILOT_LINKS_MAX_ANCHOR_WORDS,
  AUTOPILOT_LINKS_MAX_FILES,
  AUTOPILOT_LINKS_MAX_POSITION,
  AUTOPILOT_LINKS_MIN_ANCHOR_WORDS,
  AUTOPILOT_LINKS_MIN_IMPRESSIONS,
  AUTOPILOT_LINKS_MIN_POSITION,
  AUTOPILOT_LINKS_PER_POST,
  AUTOPILOT_LINKS_PHRASE_WORDS,
  AUTOPILOT_LINKS_SPOTS_PER_TARGET,
} from "@/constants/autopilot-links";
import type {
  AutopilotLinkSpot,
  AutopilotLinkTarget,
} from "@/types/autopilot-templates-runtime";
import { citationKey } from "@/utils/autopilot-citations";
import { htmlToText, markdownToText } from "@/utils/autopilot-rendering";

const WHITESPACE = /\s+/g;
const ANCHOR_CHARS = /^[\p{L}\p{N}][\p{L}\p{N}' -]*[\p{L}\p{N}]$/u;
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const FENCE = /^\s*(`{3,}|~{3,})(.*)/;
/** Headings, JSX and HTML, imports, tables, callouts, quotes, images and footnotes. */
const SKIPPED_LINE =
  /^\s*(?:#{1,6}\s|<|import\s|export\s|\||:::|\{|>|!\[|\[\^|\[[^\]]+\]:\s)/;
const INDENTED_CODE = /^(?: {4}|\t)(?!\s*(?:[-*+]|\d+\.)\s)/;
const MASKED = [
  /`[^`]*`/g,
  // Bold runs are mostly labels that work as headings ("**Pricing:** …").
  /\*\*[^*]+\*\*/g,
  /__[^_]+__/g,
  // Every link form: inline, reference, shortcut reference and images.
  /!?\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])?/g,
  /<a\b[^>]*>[\s\S]*?<\/a>/gi,
  /<[^>]+>/g,
  /\{[^}]*\}/g,
  /https?:\/\/\S+/g,
];
const LINK_HREF =
  /\]\(\s*<?([^)\s>]+)|href=["']([^"']+)["']|^\s*\[[^\]]+\]:\s*<?([^\s>]+)/gm;
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const WWW = /^www\./;
const NON_WORD = /[^\p{L}\p{N}]+/gu;

function normalizeQuery(query: string) {
  return query.toLowerCase().replace(WHITESPACE, " ").trim();
}

function isAnchorQuery(query: string, brandTerms: readonly string[]) {
  const words = query.split(" ").length;
  return (
    words >= AUTOPILOT_LINKS_MIN_ANCHOR_WORDS &&
    words <= AUTOPILOT_LINKS_MAX_ANCHOR_WORDS &&
    ANCHOR_CHARS.test(query) &&
    !brandTerms.some((term) => term && query.includes(term))
  );
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Pages ranking 4 to 20 with the queries they rank for, from Search Console
 * query and page pairs. Each query belongs to the page that ranks best for it,
 * so one phrase never points at two pages. Brand queries are left out: the
 * brand name is not a phrase to link.
 */
export function pickLinkTargets(
  rows: readonly GscQueryPageRow[],
  brandTerms: readonly string[]
): AutopilotLinkTarget[] {
  const terms = brandTerms.map(normalizeQuery).filter(Boolean);
  const best = new Map<string, GscQueryPageRow & { key: string }>();
  for (const row of rows) {
    const key = citationKey(row.page);
    const query = normalizeQuery(row.query);
    if (!(key && isAnchorQuery(query, terms))) {
      continue;
    }
    const current = best.get(query);
    if (
      !current ||
      row.position < current.position ||
      (row.position === current.position &&
        row.impressions > current.impressions)
    ) {
      best.set(query, { ...row, query, key });
    }
  }
  const pages = new Map<
    string,
    { url: string; anchors: AutopilotLinkTarget["anchors"] }
  >();
  for (const row of best.values()) {
    // Each query on its own: a search already in the top 3 needs no link.
    if (
      row.impressions < AUTOPILOT_LINKS_MIN_IMPRESSIONS ||
      row.position < AUTOPILOT_LINKS_MIN_POSITION ||
      row.position > AUTOPILOT_LINKS_MAX_POSITION
    ) {
      continue;
    }
    const page = pages.get(row.key) ?? {
      url: row.page.split("#")[0] ?? row.page,
      anchors: [],
    };
    page.anchors.push({
      query: row.query,
      position: round(row.position),
      impressions: row.impressions,
    });
    pages.set(row.key, page);
  }
  return [...pages.entries()]
    .map(([key, page]) => {
      const impressions = page.anchors.reduce(
        (sum, anchor) => sum + anchor.impressions,
        0
      );
      const position =
        page.anchors.reduce(
          (sum, anchor) => sum + anchor.position * anchor.impressions,
          0
        ) / impressions;
      return {
        url: page.url,
        key,
        position: round(position),
        impressions,
        anchors: page.anchors
          .sort(
            (a, b) =>
              b.impressions - a.impressions || a.query.localeCompare(b.query)
          )
          .slice(0, AUTOPILOT_LINKS_ANCHORS_PER_TARGET),
      };
    })
    .sort(
      (a, b) => b.impressions - a.impressions || a.key.localeCompare(b.key)
    );
}

/** Pages a post already links to, as citation keys. */
function linkedKeys(content: string, sourceUrl: string) {
  const keys = new Set<string>();
  for (const match of content.matchAll(LINK_HREF)) {
    const href = match[1] ?? match[2] ?? match[3];
    if (!href) {
      continue;
    }
    try {
      const key = citationKey(new URL(href, sourceUrl).toString());
      if (key) {
        keys.add(key);
      }
    } catch {
      // Not a URL, e.g. a mailto or a template expression.
    }
  }
  return keys;
}

function hostKey(url: string) {
  return new URL(url).hostname.toLowerCase().replace(WWW, "");
}

/** Root-relative on the same site, absolute across subdomains. */
function linkHref(sourceUrl: string, targetUrl: string) {
  const target = new URL(targetUrl);
  const href =
    hostKey(sourceUrl) === hostKey(targetUrl)
      ? `${target.pathname}${target.search}`
      : `${target.origin}${target.pathname}${target.search}`;
  return href.replaceAll("(", "%28").replaceAll(")", "%29");
}

function maskRanges(line: string) {
  return MASKED.flatMap((pattern) =>
    [...line.matchAll(pattern)].map(
      (match) => [match.index, match.index + match[0].length] as const
    )
  );
}

function findAnchor(
  line: string,
  query: string,
  masks: readonly (readonly [number, number])[]
) {
  const phrase = query
    .split(" ")
    .map((word) => word.replace(REGEX_SPECIAL, "\\$&"))
    .join("[ \\t]+");
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_\\-/.])${phrase}(?![\\p{L}\\p{N}_\\-])`,
    "giu"
  );
  for (const match of line.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    if (!masks.some(([from, to]) => start < to && end > from)) {
      return { start, end, text: match[0] };
    }
  }
  return null;
}

function contextAround(line: string, start: number, end: number) {
  const text = line.trim();
  if (text.length <= AUTOPILOT_LINKS_CONTEXT_CHARS) {
    return text;
  }
  const offset = line.indexOf(text);
  const middle = (start + end) / 2 - offset;
  const from = Math.max(
    0,
    Math.min(
      text.length - AUTOPILOT_LINKS_CONTEXT_CHARS,
      Math.round(middle - AUTOPILOT_LINKS_CONTEXT_CHARS / 2)
    )
  );
  return `${from > 0 ? "…" : ""}${text.slice(from, from + AUTOPILOT_LINKS_CONTEXT_CHARS)}${from + AUTOPILOT_LINKS_CONTEXT_CHARS < text.length ? "…" : ""}`;
}

/** Lines of body prose a link may go in: no frontmatter, code, headings, JSX or intro. */
function proseLines(content: string) {
  const lines = content.split("\n");
  const frontmatter = FRONTMATTER.exec(content)?.[0] ?? "";
  const first = frontmatter ? frontmatter.split("\n").length - 1 : 0;
  const blocks: { skipped: boolean; lines: number[] }[] = [];
  let current: { skipped: boolean; lines: number[] } | null = null;
  // The opening marker: only the same character, at least as long and with
  // no info string closes the block.
  let fence: string | null = null;
  for (let index = first; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const marker = FENCE.exec(line);
    if (fence) {
      const closing = marker?.[1] ?? "";
      if (
        closing[0] === fence[0] &&
        closing.length >= fence.length &&
        !marker?.[2]?.trim()
      ) {
        fence = null;
      }
      continue;
    }
    if (marker?.[1]) {
      fence = marker[1];
      current = null;
      continue;
    }
    if (!line.trim()) {
      current = null;
      continue;
    }
    if (!current) {
      current = { skipped: SKIPPED_LINE.test(line), lines: [] };
      blocks.push(current);
    }
    if (!(SKIPPED_LINE.test(line) || INDENTED_CODE.test(line))) {
      current.lines.push(index);
    }
  }
  const prose = blocks.filter(
    (block) => !block.skipped && block.lines.length > 0
  );
  // The intro paragraph sets up the post; links go further down.
  return { lines, eligible: prose.slice(1).flatMap((block) => block.lines) };
}

/**
 * Places in one post where a target's query appears in body prose and could
 * become a link. Never the post itself, never a page it already links to, and
 * never inside code, an existing link, a heading or the intro.
 */
export function findLinkSpots(params: {
  content: string;
  sourceUrl: string;
  sourcePath: string;
  targets: readonly AutopilotLinkTarget[];
}): Omit<AutopilotLinkSpot, "id">[] {
  const sourceKey = citationKey(params.sourceUrl);
  const linked = linkedKeys(params.content, params.sourceUrl);
  const targets = params.targets.filter(
    (target) => target.key !== sourceKey && !linked.has(target.key)
  );
  if (targets.length === 0) {
    return [];
  }
  const { lines, eligible } = proseLines(params.content);
  const masks = new Map(
    eligible.map((index) => [index, maskRanges(lines[index] ?? "")])
  );
  const spots: Omit<AutopilotLinkSpot, "id">[] = [];
  for (const target of targets) {
    const used = new Set<number>();
    for (const anchor of target.anchors) {
      for (const index of eligible) {
        if (used.size >= AUTOPILOT_LINKS_SPOTS_PER_TARGET) {
          break;
        }
        if (used.has(index)) {
          continue;
        }
        const line = lines[index] ?? "";
        const match = findAnchor(line, anchor.query, masks.get(index) ?? []);
        if (!match) {
          continue;
        }
        spots.push({
          sourceUrl: params.sourceUrl,
          sourcePath: params.sourcePath,
          line: index,
          start: match.start,
          end: match.end,
          text: match.text,
          href: linkHref(params.sourceUrl, target.url),
          targetUrl: target.url,
          targetKey: target.key,
          query: anchor.query,
          position: anchor.position,
          impressions: anchor.impressions,
          context: contextAround(line, match.start, match.end),
        });
        used.add(index);
      }
    }
  }
  return spots;
}

/**
 * The reviewed spots that make it into the pull request: one link per target
 * per post, one per line, a few per post, and a bounded number of posts. Spots
 * come in priority order, so the best targets win.
 */
export function selectLinks(
  spots: readonly AutopilotLinkSpot[],
  keep: ReadonlySet<string>
) {
  const posts = new Map<string, AutopilotLinkSpot[]>();
  for (const spot of spots) {
    if (!keep.has(spot.id)) {
      continue;
    }
    const chosen = posts.get(spot.sourcePath) ?? [];
    if (
      chosen.length >= AUTOPILOT_LINKS_PER_POST ||
      chosen.some(
        (other) =>
          other.targetKey === spot.targetKey || other.line === spot.line
      )
    ) {
      continue;
    }
    if (!posts.has(spot.sourcePath)) {
      if (posts.size >= AUTOPILOT_LINKS_MAX_FILES) {
        continue;
      }
      posts.set(spot.sourcePath, chosen);
    }
    chosen.push(spot);
  }
  return [...posts.values()].flat();
}

/** Turns each phrase into a link; the words themselves never change. */
export function applyLinkSpots(
  content: string,
  spots: readonly AutopilotLinkSpot[]
) {
  const lines = content.split("\n");
  const ordered = [...spots].sort(
    (a, b) => b.line - a.line || b.start - a.start
  );
  for (const spot of ordered) {
    const line = lines[spot.line] ?? "";
    if (line.slice(spot.start, spot.end) !== spot.text) {
      throw new Error(
        `${spot.sourcePath} changed: "${spot.text}" is no longer on line ${spot.line + 1}`
      );
    }
    lines[spot.line] =
      `${line.slice(0, spot.start)}[${spot.text}](${spot.href})${line.slice(spot.end)}`;
  }
  return lines.join("\n");
}

/** Lowercase words only, so Markdown and HTML of the same text compare equal. */
export function plainWords(text: string) {
  return text.toLowerCase().normalize("NFKC").replace(NON_WORD, " ").trim();
}

/**
 * About eight words around a spot's phrase, as they read on the published
 * page. Finding them there proves the post is live at the spot's URL.
 */
export function spotPhrase(spot: Pick<AutopilotLinkSpot, "context" | "text">) {
  // Decoded like the live page: inline HTML and entities become plain text.
  const words = plainWords(markdownToText(htmlToText(spot.context))).split(" ");
  // A context cut mid-word starts or ends with a partial word.
  const from = spot.context.startsWith("…") ? 1 : 0;
  const to = spot.context.endsWith("…") ? words.length - 1 : words.length;
  const usable = words.slice(from, to).filter(Boolean);
  const anchor = plainWords(spot.text).split(" ");
  const at = usable.findIndex((_, index) =>
    anchor.every((word, offset) => usable[index + offset] === word)
  );
  if (at < 0 || usable.length < AUTOPILOT_LINKS_PHRASE_WORDS) {
    return null;
  }
  const start = Math.max(
    0,
    Math.min(at - 3, usable.length - AUTOPILOT_LINKS_PHRASE_WORDS)
  );
  return usable.slice(start, start + AUTOPILOT_LINKS_PHRASE_WORDS).join(" ");
}

export function linkPairKey(sourceUrl: string, targetUrl: string) {
  return `${citationKey(sourceUrl) ?? sourceUrl}>${citationKey(targetUrl) ?? targetUrl}`;
}

export function linksFingerprint(links: readonly AutopilotInternalLink[]) {
  const pairs = links
    .map((link) => `${link.sourcePath}>${link.targetUrl}`)
    .sort()
    .join("\n");
  return `links:${createHash("sha256").update(pairs).digest("hex").slice(0, 16)}`;
}

export function toInternalLink(spot: AutopilotLinkSpot): AutopilotInternalLink {
  return {
    sourceUrl: spot.sourceUrl,
    sourcePath: spot.sourcePath,
    anchor: spot.text,
    targetUrl: spot.targetUrl,
    query: spot.query,
    position: spot.position,
    impressions: spot.impressions,
  };
}
