const FRONTMATTER_REGEX = /^---\n[\s\S]*?\n---\n?/;
const MARKDOWN_LINK_TEXT_REGEX = /[\\[\]]/g;
const BACKSLASH_REGEX = /\\/g;
const TABLE_PIPE_REGEX = /\|/g;
const LINE_BREAK_REGEX = /\s*\n\s*/g;

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
