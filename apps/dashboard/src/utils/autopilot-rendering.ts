import { decodeHTML } from "entities";

import {
  AUTOPILOT_RENDERING_BLOCKED_STATUSES,
  AUTOPILOT_RENDERING_COPY_MIN_PLAIN_SHARE,
  AUTOPILOT_RENDERING_CHALLENGE_MARKERS,
  AUTOPILOT_RENDERING_MIN_RAW_SHARE,
  AUTOPILOT_RENDERING_MIN_RENDERED_WORDS,
  AUTOPILOT_RENDERING_MISSING_SAMPLES,
} from "@/constants/autopilot-rendering";
import type {
  AutopilotPageFetch,
  AutopilotRenderingProblem,
} from "@/types/autopilot-templates-runtime";
import { citationKey } from "@/utils/autopilot-citations";

const INVISIBLE_BLOCKS =
  /<(script|style|noscript|template|svg|head|iframe)\b[\s\S]*?<\/\1\s*>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const TAGS = /<[^>]+>/g;
const WHITESPACE = /\s+/g;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const MARKDOWN_LINK = /\[([^\]]*)\]\([^)]*\)/g;
const MARKDOWN_SYNTAX = /[#>*_`|~-]+/g;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
/** Letters and digits only, so "server-side" and "server side" compare equal. */
const PLAIN_WORD = /[\p{L}\p{N}]+/gu;
const SENTENCE_END = /(?<=[.!?])\s+/;
const JSX_TEXT = />([^<>{}]+)</g;
const LEADING_TEXT = /^([^<>{}]+)</;
const TRAILING_TEXT = />([^<>{}]+)$/;
const STRING_LITERAL = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
const MIN_SENTENCE_WORDS = 6;
const MIN_COPY_WORDS = 4;

/** The text an AI crawler gets from a page's HTML: no scripts, styles or head. */
export function htmlToText(html: string) {
  // Every named, decimal and hex reference, so "caf&eacute;" reads "café".
  return decodeHTML(
    html
      .replace(COMMENTS, " ")
      .replace(INVISIBLE_BLOCKS, " ")
      .replace(TAGS, " ")
  )
    .replace(WHITESPACE, " ")
    .trim();
}

export function markdownToText(markdown: string) {
  return markdown
    .replace(MARKDOWN_IMAGE, " ")
    .replace(MARKDOWN_LINK, "$1")
    .replace(MARKDOWN_SYNTAX, " ")
    .replace(WHITESPACE, " ")
    .trim();
}

function countWords(text: string) {
  return text.match(WORD)?.length ?? 0;
}

/** Space-delimited on both ends, so a match is always on whole words. */
function normalize(text: string) {
  return ` ${(text.match(PLAIN_WORD) ?? []).join(" ").toLowerCase()} `;
}

function sentences(text: string) {
  return text
    .split(SENTENCE_END)
    .map((sentence) => sentence.trim())
    .filter((sentence) => countWords(sentence) >= MIN_SENTENCE_WORDS);
}

/** Sentences a browser shows that the crawler's text doesn't contain. */
function missingSentences(
  renderedText: string,
  rawText: string,
  max = AUTOPILOT_RENDERING_MISSING_SAMPLES
) {
  const raw = normalize(rawText);
  return sentences(renderedText)
    .filter((sentence) => !raw.includes(normalize(sentence)))
    .slice(0, max);
}

/**
 * Share of the browser's sentence words the crawler's HTML also has. By
 * sentence, not word count: navigation and footers pad the raw HTML, so a
 * page can have plenty of words and still miss its main content.
 */
function crawlerCoverage(renderedText: string, rawText: string) {
  const raw = normalize(rawText);
  let total = 0;
  let found = 0;
  for (const sentence of sentences(renderedText)) {
    const words = countWords(sentence);
    total += words;
    if (raw.includes(normalize(sentence))) {
      found += words;
    }
  }
  return total === 0 ? 1 : found / total;
}

export function isChallengePage(html: string) {
  const lower = html.toLowerCase();
  return AUTOPILOT_RENDERING_CHALLENGE_MARKERS.some((marker) =>
    lower.includes(marker)
  );
}

function isBlocked(page: AutopilotPageFetch & { challenged: boolean }) {
  return (
    page.challenged ||
    (page.status !== null &&
      AUTOPILOT_RENDERING_BLOCKED_STATUSES.includes(page.status))
  );
}

/**
 * A crawler request that says nothing about the page: it failed, timed out or
 * hit a server error or a missing page. It is retried on the next run instead
 * of being read as content the repository hides.
 */
export function isFailedFetch(
  page: AutopilotPageFetch & { challenged: boolean }
) {
  return (
    !isBlocked(page) &&
    (page.status === null || page.status < 200 || page.status >= 400)
  );
}

/**
 * Whether the browser was sent on to another page, e.g. an index page that
 * redirects home with JavaScript. Its rendered text is that other page's, so
 * comparing it with this page's HTML says nothing about hidden content.
 */
export function leftThePage(page: AutopilotPageFetch) {
  if (!page.renderedUrl) {
    return false;
  }
  const from = citationKey(page.url);
  const to = citationKey(page.renderedUrl);
  return from !== null && to !== null && from !== to;
}

/**
 * What is wrong with a page for AI crawlers, or null. Blocked: the crawler
 * gets an error or a bot wall. Missing content: the server's HTML holds less
 * than half of the sentences a browser shows, because the rest needs JavaScript.
 * A failed request is never a problem; see isFailedFetch.
 */
export function assessRendering(
  page: AutopilotPageFetch & { challenged: boolean }
): AutopilotRenderingProblem | null {
  const rawWords = countWords(page.rawText);
  const renderedWords = countWords(page.renderedText);
  if (isFailedFetch(page)) {
    return null;
  }
  if (isBlocked(page)) {
    return {
      url: page.url,
      issue: "blocked",
      rawWords,
      renderedWords,
      status: page.status,
      missing: [],
    };
  }
  if (
    leftThePage(page) ||
    renderedWords < AUTOPILOT_RENDERING_MIN_RENDERED_WORDS ||
    crawlerCoverage(page.renderedText, page.rawText) >=
      AUTOPILOT_RENDERING_MIN_RAW_SHARE
  ) {
    return null;
  }
  return {
    url: page.url,
    issue: "missing_content",
    rawWords,
    renderedWords,
    status: page.status,
    missing: missingSentences(page.renderedText, page.rawText),
  };
}

/** Braces, assignments and tags only appear in code, never in copy. */
const CODE_MARKS = /[{}=<>]/;
const CODE_LINE =
  /^(?:import|export|const|let|var|return|if|else|for|while|switch|case|function|type|interface|await|async|from|["']use \w+["'])\b/;
const PLAIN_TOKEN = /^\p{L}+(?:['’]\p{L}+)*$/u;
const TOKEN_EDGES = /^[\s"'`([*_#>-]+|[\s"'`)\].,:;!?*_]+$/g;
const CLASS_ATTRIBUTE = /\bclass(?:Name)?=\s*\{?$/;

/**
 * Whether text reads like copy: mostly plain words, as sentences are, unlike
 * class lists, paths and expressions. Punctuation, colons and URLs inside
 * a sentence don't stop it from counting.
 */
function looksLikeCopy(text: string) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const plain = tokens.filter((token) =>
    PLAIN_TOKEN.test(token.replace(TOKEN_EDGES, ""))
  ).length;
  return (
    plain >= MIN_COPY_WORDS &&
    plain / tokens.length >= AUTOPILOT_RENDERING_COPY_MIN_PLAIN_SHARE
  );
}

function isProse(text: string) {
  const trimmed = text.trim();
  return (
    !(
      CODE_MARKS.test(trimmed) ||
      CODE_LINE.test(trimmed) ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("*")
    ) && looksLikeCopy(trimmed)
  );
}

/**
 * Copy in one run of added lines. JSX text is read across line breaks, so
 * `<p>` on one line and its text on the next still count; so does text that
 * runs into or out of a tag the change left alone.
 */
function copyFragments(chunk: string) {
  const fragments = [...chunk.matchAll(JSX_TEXT)].map(
    (match) => match[1] ?? ""
  );
  for (const edge of [LEADING_TEXT.exec(chunk), TRAILING_TEXT.exec(chunk)]) {
    if (edge?.[1] && isProse(edge[1])) {
      fragments.push(edge[1]);
    }
  }
  for (const line of chunk.split("\n")) {
    for (const match of line.matchAll(STRING_LITERAL)) {
      const value = match[2] ?? "";
      const before = line.slice(0, match.index);
      // Class lists, paths and URLs are strings too, but they don't read like copy.
      if (!CLASS_ATTRIBUTE.test(before.trimEnd()) && looksLikeCopy(value)) {
        fragments.push(value);
      }
    }
    if (isProse(line)) {
      fragments.push(line.trim());
    }
  }
  const counted = fragments.filter(
    (fragment) => countWords(fragment) >= MIN_COPY_WORDS
  );
  // A text line inside a JSX node is the same copy; count it once.
  return counted.filter(
    (fragment, index) =>
      !counted.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          other.length > fragment.length &&
          normalize(other).includes(normalize(fragment))
      ) &&
      counted.findIndex((other) => normalize(other) === normalize(fragment)) ===
        index
  );
}

/** Prose a change adds, from JSX text, string literals and plain text lines. */
export function addedCopy(before: string | null, after: string) {
  const remaining = new Map<string, number>();
  for (const line of (before ?? "").split(/\r?\n/)) {
    const key = line.trim();
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const chunks: string[][] = [[]];
  for (const line of after.split(/\r?\n/)) {
    const key = line.trim();
    const count = remaining.get(key) ?? 0;
    if (count > 0) {
      remaining.set(key, count - 1);
      chunks.push([]);
      continue;
    }
    chunks.at(-1)?.push(line);
  }
  return chunks
    .filter((chunk) => chunk.length > 0)
    .flatMap((chunk) => copyFragments(chunk.join("\n")));
}

/**
 * Words of added prose that the page doesn't already show in a browser. A
 * rendering fix may move existing copy, e.g. from a JSON file the browser
 * fetched into the server render; copy the page never showed is padding.
 */
export function inventedCopyWords(fragments: string[], renderedText: string) {
  const rendered = normalize(renderedText);
  return fragments
    .filter((fragment) => !rendered.includes(normalize(fragment)))
    .reduce((sum, fragment) => sum + countWords(fragment), 0);
}

export function renderingFingerprint(key: string, issue: string) {
  return `rendering:${issue}:${key}`;
}
