import type { BlockDiff } from "@/types/autopilot-revisions";

/**
 * A word-level diff of two paragraphs, for showing a rewrite inline the way
 * a doc's suggestion mode does. Paragraphs only carry **bold** and `code`,
 * so those are parsed here and kept on every word.
 */

export interface DiffWord {
  text: string;
  bold: boolean;
  code: boolean;
}

export interface DiffRun {
  kind: "same" | "removed" | "added";
  words: DiffWord[];
}

/** Starts of blocks that are not a plain paragraph: these aren't diffed inline. */
const NOT_A_PARAGRAPH = /^(#|```|\||[-*+] |>|\d+\. )/u;

function isParagraph(markdown: string) {
  return !NOT_A_PARAGRAPH.test(markdown.trim());
}

/** Links, images, HTML, strikethrough and single-star or underscore emphasis. */
const BEYOND_BOLD_AND_CODE = /\[|\]\(|<|~~|_|(?<!\*)\*(?!\*)/u;

/**
 * A paragraph the word diff can draw as it is: it only knows **bold** and
 * `code`, so anything else keeps the real Markdown renderer.
 */
export function isPlainParagraph(markdown: string) {
  return isParagraph(markdown) && !BEYOND_BOLD_AND_CODE.test(markdown);
}

/** Splits a paragraph into words and spaces, each with its inline style. */
function toWords(markdown: string): DiffWord[] {
  const words: DiffWord[] = [];
  let bold = false;
  let code = false;
  let text = "";
  const flush = () => {
    // Punctuation is its own token, so "first" and "first:" share "first".
    for (const part of text.split(/(\s+|[,.:;!?()"“”]+)/u)) {
      if (part) {
        words.push({ text: part, bold, code });
      }
    }
    text = "";
  };
  for (let index = 0; index < markdown.length; index += 1) {
    const char = markdown[index];
    if (char === "`") {
      flush();
      code = !code;
    } else if (!code && char === "*" && markdown[index + 1] === "*") {
      flush();
      bold = !bold;
      index += 1;
    } else {
      text += char;
    }
  }
  flush();
  return words;
}

function sameWord(a: DiffWord, b: DiffWord) {
  return a.text === b.text && a.bold === b.bold && a.code === b.code;
}

/**
 * The longest common run of words, walked back into same, removed and added
 * runs; in a replaced stretch the removed words come first.
 */
export function diffWords(before: string, after: string): DiffRun[] {
  const a = toWords(before);
  const b = toWords(after);
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint16Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const wordA = a[i];
      const wordB = b[j];
      table[i * cols + j] =
        wordA && wordB && sameWord(wordA, wordB)
          ? (table[(i + 1) * cols + j + 1] ?? 0) + 1
          : Math.max(
              table[(i + 1) * cols + j] ?? 0,
              table[i * cols + j + 1] ?? 0
            );
    }
  }
  const runs: DiffRun[] = [];
  const push = (kind: DiffRun["kind"], word: DiffWord) => {
    const last = runs.at(-1);
    if (last?.kind === kind) {
      last.words.push(word);
    } else {
      runs.push({ kind, words: [word] });
    }
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const wordA = a[i];
    const wordB = b[j];
    if (wordA && wordB && sameWord(wordA, wordB)) {
      push("same", wordA);
      i += 1;
      j += 1;
    } else if (
      wordA &&
      (!wordB ||
        (table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0))
    ) {
      push("removed", wordA);
      i += 1;
    } else if (wordB) {
      push("added", wordB);
      j += 1;
    }
  }
  return mergeSpaces(runs);
}

const isSpace = (word: DiffWord) => !word.text.trim();

function trimSpaces(words: DiffWord[]) {
  let start = 0;
  let end = words.length;
  while (start < end && isSpace(words[start] as DiffWord)) {
    start += 1;
  }
  while (end > start && isSpace(words[end - 1] as DiffWord)) {
    end -= 1;
  }
  return words.slice(start, end);
}

/**
 * One stretch of changes reads as one replacement: all its removed words,
 * then all its added words, instead of word-by-word confetti. Only a space
 * between changed runs keeps them in the same stretch.
 */
function mergeSpaces(runs: DiffRun[]): DiffRun[] {
  const out: DiffRun[] = [];
  let removed: DiffWord[] = [];
  let added: DiffWord[] = [];
  let open = false;
  const flush = () => {
    if (!open) {
      return;
    }
    const gone = trimSpaces(removed);
    const fresh = trimSpaces(added);
    // A space trimmed off the ends stays in the text, unmarked.
    const space = { text: " ", bold: false, code: false };
    const both = [...removed, ...added];
    const leading = both.length > 0 && isSpace(both[0] as DiffWord);
    const trailing =
      (added.length > 0 && isSpace(added.at(-1) as DiffWord)) ||
      (added.length === 0 &&
        removed.length > 0 &&
        isSpace(removed.at(-1) as DiffWord));
    if (leading) {
      out.push({ kind: "same", words: [space] });
    }
    if (gone.length > 0) {
      out.push({ kind: "removed", words: gone });
    }
    if (gone.length > 0 && fresh.length > 0) {
      out.push({ kind: "same", words: [space] });
    }
    if (fresh.length > 0) {
      out.push({ kind: "added", words: fresh });
    }
    if (trailing) {
      out.push({ kind: "same", words: [space] });
    }
    removed = [];
    added = [];
    open = false;
  };
  for (const [index, run] of runs.entries()) {
    const next = runs[index + 1];
    if (run.kind === "removed") {
      removed.push(...run.words);
      open = true;
    } else if (run.kind === "added") {
      added.push(...run.words);
      open = true;
    } else if (
      open &&
      next &&
      next.kind !== "same" &&
      run.words.every(isSpace)
    ) {
      removed.push(...run.words);
      added.push(...run.words);
    } else {
      // A stretch that ends right before a space keeps the space outside.
      flush();
      out.push(run);
    }
  }
  flush();
  return out;
}

/** A post's Markdown in blocks: paragraphs, headings, lists, fenced code whole. */
function splitMarkdownBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/u.test(line)) {
      fenced = !fenced;
    }
    if (!fenced && line.trim() === "") {
      if (current.length > 0) {
        blocks.push(current.join("\n"));
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) {
    blocks.push(current.join("\n"));
  }
  return blocks;
}

/**
 * Which blocks of a post a commit touched. Blocks are matched by their whole
 * text; in a stretch between two unchanged blocks, the new blocks replace the
 * old ones in order, so a rewritten paragraph reads as an inline diff.
 */
export function diffBlocks(before: string, after: string): BlockDiff {
  const a = splitMarkdownBlocks(before);
  const b = splitMarkdownBlocks(after);
  const cols = b.length + 1;
  const table = new Uint32Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] =
        a[i] === b[j]
          ? (table[(i + 1) * cols + j + 1] ?? 0) + 1
          : Math.max(
              table[(i + 1) * cols + j] ?? 0,
              table[i * cols + j + 1] ?? 0
            );
    }
  }
  const changed: number[] = [];
  const replaced: Record<number, string | null> = {};
  const dropped: Record<number, string[]> = {};
  let removed: string[] = [];
  let added: number[] = [];
  // `at` is the index of the next block in the new version, where blocks
  // that were removed without a replacement are shown struck through.
  const flush = (at: number) => {
    for (const [rank, index] of added.entries()) {
      changed.push(index);
      replaced[index] = removed[rank] ?? null;
    }
    const gone = removed.slice(added.length);
    if (gone.length > 0) {
      dropped[at] = gone;
    }
    removed = [];
    added = [];
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush(j);
      i += 1;
      j += 1;
    } else if (
      i < a.length &&
      (j >= b.length ||
        (table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0))
    ) {
      removed.push(a[i] as string);
      i += 1;
    } else {
      added.push(j);
      j += 1;
    }
  }
  flush(b.length);
  return { blocks: b, changed, before: replaced, removed: dropped };
}
