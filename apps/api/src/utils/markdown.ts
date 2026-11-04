import { sanitizeMarkdownHtml } from "@notra/ai/utils/sanitize";
import { marked } from "marked";

const TITLE_REGEX = /^#\s+(.+)$/m;

export function extractTitleFromMarkdown(markdown: string): string | null {
  const titleMatch = markdown.match(TITLE_REGEX);
  return titleMatch?.[1]?.trim() || null;
}

export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  return sanitizeMarkdownHtml(await marked.parse(markdown));
}
