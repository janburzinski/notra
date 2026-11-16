const FRONTMATTER_REGEX = /^---\n[\s\S]*?\n---\n?/;
const MARKDOWN_LINK_TEXT_REGEX = /[\\[\]]/g;
const BACKSLASH_REGEX = /\\/g;
const TABLE_PIPE_REGEX = /\|/g;
const LINE_BREAK_REGEX = /\s*\n\s*/g;
const BLOCKQUOTE_PREFIX_REGEX = /^>\s*/;
const BOLD_ONLY_LINE_REGEX = /^\*\*[^*]+\*\*$/;

export function textResponse(content: string, status = 200) {
  return new Response(content, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

export function markdownSection(title: string, lines: string[]) {
  return [`## ${title}`, "", ...lines, ""].join("\n");
}

export function readMarkdownMeta(markdown: string) {
  const lines = markdown.split("\n");
  const titleIndex = lines.findIndex((line) => line.startsWith("# "));
  const description = lines
    .slice(titleIndex + 1)
    .find(
      (line) =>
        line.trim() !== "" &&
        !line.startsWith("#") &&
        !BOLD_ONLY_LINE_REGEX.test(line.trim())
    );
  return {
    title: lines[titleIndex]?.slice(2).trim() ?? "",
    description: description?.replace(BLOCKQUOTE_PREFIX_REGEX, "").trim() ?? "",
  };
}

export function stripFrontmatter(source: string) {
  return source.replace(FRONTMATTER_REGEX, "").trim();
}

export function escapeMarkdownLinkText(text: string) {
  return text.replace(MARKDOWN_LINK_TEXT_REGEX, "\\$&");
}

export interface MarkdownTableColumn {
  header: string;
  align?: "left" | "right";
}

function tableCell(value: string): string {
  return value
    .replace(LINE_BREAK_REGEX, " ")
    .replace(BACKSLASH_REGEX, "\\\\")
    .replace(TABLE_PIPE_REGEX, "\\|");
}

export function markdownTable(
  columns: MarkdownTableColumn[],
  rows: string[][]
): string {
  const divider = columns.map((column) =>
    column.align === "right" ? "---:" : "---"
  );
  return [
    `| ${columns.map((column) => column.header).join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(tableCell).join(" | ")} |`),
  ].join("\n");
}

export function demoteMarkdownHeadings(source: string) {
  let inFence = false;
  return source
    .split("\n")
    .map((line) => {
      if (line.startsWith("```")) {
        inFence = !inFence;
      }
      return !inFence && line.startsWith("#") ? `#${line}` : line;
    })
    .join("\n");
}
