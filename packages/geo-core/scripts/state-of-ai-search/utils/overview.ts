import type {
  StateOfAiSearchOverview,
  StateOfAiSearchOverviewBlock,
} from "../../../../../apps/web/src/types/state-of-ai-search";
import {
  OVERVIEW_HEADING_MAX_LENGTH,
  OVERVIEW_LABEL_MIN_ITEMS,
  OVERVIEW_LIST_ITEM,
} from "../constants/collection";
import type { RawAnswer } from "../shared";

/** A standalone short line without sentence punctuation, such as "Top Tools". */
function isHeading(line: string): boolean {
  return line.length <= OVERVIEW_HEADING_MAX_LENGTH && !/[.:?!,;]$/.test(line);
}

/** Keep the captured answer's paragraphs, headings and bullet lists. */
function overviewBlocks(text: string): StateOfAiSearchOverviewBlock[] {
  const blocks: StateOfAiSearchOverviewBlock[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];
  let lone = "";
  const flush = () => {
    // A numbered line on its own ("1. Frontend hosting") titles the list after it.
    if (items.length === 1 && /^\d/.test(lone) && isHeading(lone)) {
      paragraph = [lone];
      items = [];
    }
    if (paragraph.length === 1 && isHeading(paragraph[0] ?? "")) {
      blocks.push({ type: "heading", text: paragraph[0] ?? "" });
    } else if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" "), refs: [] });
    }
    if (items.length > 0) {
      blocks.push({
        type: "list",
        items: items.map((item) => ({ text: item, refs: [] })),
      });
    }
    paragraph = [];
    items = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const item = OVERVIEW_LIST_ITEM.exec(line);
    if (!line) {
      flush();
    } else if (item?.[1]) {
      if (paragraph.length > 0) {
        flush();
      }
      lone = line;
      // Bullets drop their marker; numbers carry meaning, so numbered items keep them.
      items.push(/^\d/.test(line) ? line : item[1]);
    } else {
      if (items.length > 0) {
        flush();
      }
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

const alnum = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Google can print a source label after each item name ("Neon Bytebase: …").
 * Only when every item of a list ends its lead that way (the label repeats the
 * first word or names a cited site) is it a capture artifact, so drop it.
 */
function stripSourceLabels(
  blocks: StateOfAiSearchOverviewBlock[],
  sources: RawAnswer["sources"]
): void {
  const sites = new Set(
    sources.map((source) => alnum(source.domain.split(".").at(-2) ?? ""))
  );
  for (const block of blocks) {
    if (
      block.type !== "list" ||
      block.items.length < OVERVIEW_LABEL_MIN_ITEMS
    ) {
      continue;
    }
    const leads = block.items.map((item) => {
      const separator = item.text.indexOf(":");
      const words = item.text
        .slice(0, Math.max(separator, 0))
        .trim()
        .split(" ");
      const last = words.at(-1) ?? "";
      const label =
        separator > 0 &&
        words.length > 1 &&
        !last.startsWith("(") &&
        (alnum(last) === alnum(words[0] ?? "") || sites.has(alnum(last)));
      return label ? { separator, last } : null;
    });
    if (leads.every(Boolean)) {
      block.items.forEach((item, index) => {
        const lead = leads[index];
        if (lead) {
          item.text = `${item.text.slice(0, lead.separator - lead.last.length).trimEnd()}${item.text.slice(lead.separator)}`;
        }
      });
    }
  }
}

/** DOM captures keep sources at answer level, so cite them once, on the first text block. */
export function reportOverviewFallback(
  answer: RawAnswer,
  text: string
): StateOfAiSearchOverview {
  const blocks = overviewBlocks(text);
  stripSourceLabels(blocks, answer.sources);
  const refs = answer.sources.map((_, index) => index);
  const first = blocks.find((block) => block.type !== "heading");
  if (first?.type === "paragraph") {
    first.refs = refs;
  } else if (first?.type === "list" && first.items[0]) {
    first.items[0].refs = refs;
  }
  return {
    query: answer.prompt,
    blocks,
    references: answer.sources.map((source, index) => ({
      index,
      title: source.title ?? source.domain,
      url: source.url,
      source: source.domain,
    })),
  };
}
