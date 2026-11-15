import {
  ARTIFACT_FENCE_CLOSE,
  ARTIFACT_FENCE_OPEN,
  ARTIFACT_FENCED_TYPES,
  ARTIFACT_FRONTMATTER_KEYS,
  ARTIFACT_FRONTMATTER_LINE,
  ARTIFACT_JSON_LINE_WIDTH,
  ARTIFACT_LIMITS,
  ARTIFACT_MARKDOWN_FENCE,
} from "@notra/ai/constants/artifacts";
import {
  artifactBlockSchema,
  artifactContentSchema,
} from "@notra/ai/schemas/artifact";
import type {
  ArtifactBlock,
  ArtifactContent,
  ArtifactFileIssue,
  ParsedArtifactFile,
} from "@notra/ai/types/artifact";

const FENCED = new Set<string>(ARTIFACT_FENCED_TYPES);
const FRONTMATTER_KEYS = new Set<string>(ARTIFACT_FRONTMATTER_KEYS);

/**
 * JSON that stays on one line while it fits and breaks into one entry per
 * line when it doesn't, so a table row or a metric is its own line in a diff.
 */
function compactJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(compactJson).join(", ")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => `${JSON.stringify(key)}: ${compactJson(entry)}`);
    return entries.length > 0 ? `{ ${entries.join(", ")} }` : "{}";
  }
  return JSON.stringify(value);
}

function formatJson(value: unknown, indent = ""): string {
  const compact = compactJson(value);
  if (
    value === null ||
    typeof value !== "object" ||
    indent.length + compact.length <= ARTIFACT_JSON_LINE_WIDTH
  ) {
    return compact;
  }
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((item) => `${inner}${formatJson(item, inner)}`);
    return `[\n${items.join(",\n")}\n${indent}]`;
  }
  const entries = Object.entries(value).filter(
    ([, entry]) => entry !== undefined
  );
  if (entries.length === 0) {
    return "{}";
  }
  const lines = entries.map(
    ([key, entry]) =>
      `${inner}${JSON.stringify(key)}: ${formatJson(entry, inner)}`
  );
  return `{\n${lines.join(",\n")}\n${indent}}`;
}

/**
 * One line of frontmatter: newlines would end the value early, and a value
 * that is itself quoted is written as JSON so reading it keeps the quotes.
 */
function frontmatterValue(text: string) {
  const value = text.replace(/\s+/g, " ").trim();
  return value.startsWith('"') ? JSON.stringify(value) : value;
}

/** The marker of a code fence the Markdown opens and never closes. */
function unclosedFence(markdown: string) {
  let open: string | null = null;
  for (const line of markdown.split("\n")) {
    const marker = ARTIFACT_MARKDOWN_FENCE.exec(line.trim())?.[1];
    if (!marker) {
      continue;
    }
    if (!open) {
      open = marker;
    } else if (
      marker.startsWith(open.charAt(0)) &&
      marker.length >= open.length &&
      line.trim() === marker
    ) {
      open = null;
    }
  }
  return open;
}

function serializeBlock(block: ArtifactBlock) {
  if (block.type === "text") {
    // An open code fence would swallow every block after it when read back.
    const markdown = block.markdown.trim();
    const open = unclosedFence(markdown);
    return open
      ? `${markdown}\n${open.charAt(0).repeat(open.length)}`
      : markdown;
  }
  const { type, ...body } = block;
  return `\`\`\`${type}\n${formatJson(body)}\n\`\`\``;
}

/** The artifact as the one Markdown file its repository holds. */
export function serializeArtifactFile(content: ArtifactContent): string {
  const frontmatter = [
    "---",
    `title: ${frontmatterValue(content.title)}`,
    ...(content.summary
      ? [`summary: ${frontmatterValue(content.summary)}`]
      : []),
    "---",
  ].join("\n");
  return `${[frontmatter, ...content.blocks.map(serializeBlock)].join("\n\n")}\n`;
}

/** A value the writer quoted reads as what is inside the quotes. */
function unquote(raw: string) {
  const value = raw.trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed === "string") {
        return parsed;
      }
    } catch {
      // Not JSON: the quotes are part of the text.
    }
  }
  return value;
}

function issueText(error: {
  issues: { path: PropertyKey[]; message: string }[];
}) {
  return error.issues
    .map((issue) =>
      issue.path.length > 0
        ? `${issue.path.map(String).join(".")}: ${issue.message}`
        : issue.message
    )
    .join("; ");
}

/**
 * Reads an artifact file. Every problem is reported with its line, so a
 * writer can fix exactly that line; `strict` callers reject the file when
 * there are any, readers keep the blocks that are fine.
 */
export function parseArtifactFile(text: string): ParsedArtifactFile {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const issues: ArtifactFileIssue[] = [];
  const meta: Record<string, string> = {};
  const blocks: ArtifactBlock[] = [];
  const blockLines: number[] = [];
  let index = 0;

  while (index < lines.length && lines[index]?.trim() === "") {
    index += 1;
  }
  if (lines[index]?.trim() === "---") {
    const start = index + 1;
    index += 1;
    while (index < lines.length && lines[index]?.trim() !== "---") {
      const line = lines[index] ?? "";
      const match = ARTIFACT_FRONTMATTER_LINE.exec(line);
      if (match?.[1] && FRONTMATTER_KEYS.has(match[1])) {
        meta[match[1]] = unquote(match[2] ?? "");
      } else if (line.trim() !== "") {
        issues.push({
          line: index + 1,
          message: `Frontmatter only takes ${ARTIFACT_FRONTMATTER_KEYS.join(" and ")}, one per line`,
        });
      }
      index += 1;
    }
    if (index >= lines.length) {
      issues.push({
        line: start,
        message: "The frontmatter has no closing ---",
      });
    }
    index += 1;
  } else {
    issues.push({
      line: index + 1,
      message: "The file must start with --- frontmatter holding the title",
    });
  }

  let textLines: string[] = [];
  let textStart = index + 1;
  let markdownFence: { char: string; length: number; line: number } | null =
    null;

  const flushText = () => {
    const markdown = textLines.join("\n").trim();
    if (markdown) {
      blocks.push({ type: "text", markdown });
      blockLines.push(textStart);
    }
    textLines = [];
  };

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (markdownFence) {
      const kind = ARTIFACT_FENCE_OPEN.exec(line)?.[1];
      if (kind && FENCED.has(kind)) {
        issues.push({
          line: index + 1,
          message: `The ${kind} block starts inside the code fence opened on line ${markdownFence.line}; close that fence first`,
        });
      }
      textLines.push(line);
      const marker = ARTIFACT_MARKDOWN_FENCE.exec(line.trim())?.[1];
      if (
        marker?.startsWith(markdownFence.char) &&
        marker.length >= markdownFence.length &&
        line.trim() === marker
      ) {
        markdownFence = null;
      }
      index += 1;
      continue;
    }
    const fence = ARTIFACT_FENCE_OPEN.exec(line);
    if (fence?.[1] && FENCED.has(fence[1])) {
      flushText();
      const type = fence[1];
      const start = index + 1;
      const body: string[] = [];
      index += 1;
      while (
        index < lines.length &&
        !ARTIFACT_FENCE_CLOSE.test(lines[index] ?? "")
      ) {
        body.push(lines[index] ?? "");
        index += 1;
      }
      if (index >= lines.length) {
        issues.push({
          line: start,
          message: `The ${type} block has no closing \`\`\``,
        });
      } else {
        let json: unknown;
        try {
          json = JSON.parse(body.join("\n"));
        } catch (error) {
          issues.push({
            line: start,
            message: `The ${type} block is not valid JSON: ${(error as Error).message}`,
          });
        }
        if (json !== undefined) {
          const parsed = artifactBlockSchema.safeParse(
            json !== null && typeof json === "object" && !Array.isArray(json)
              ? { ...json, type }
              : json
          );
          if (parsed.success) {
            blocks.push(parsed.data);
            blockLines.push(start);
          } else {
            issues.push({
              line: start,
              message: `The ${type} block is invalid: ${issueText(parsed.error)}`,
            });
          }
        }
      }
      index += 1;
      textStart = index + 1;
      continue;
    }
    const marker = ARTIFACT_MARKDOWN_FENCE.exec(line.trim())?.[1];
    if (marker) {
      markdownFence = {
        char: marker.charAt(0),
        length: marker.length,
        line: index + 1,
      };
    }
    if (textLines.length === 0 && line.trim() === "") {
      textStart = index + 2;
    } else {
      textLines.push(line);
    }
    index += 1;
  }
  if (markdownFence) {
    issues.push({
      line: markdownFence.line,
      message: `A ${markdownFence.char.repeat(markdownFence.length)} code fence in the text is never closed, so everything after it reads as text`,
    });
  }
  flushText();

  const candidate = {
    title: meta.title ?? "",
    ...(meta.summary ? { summary: meta.summary } : {}),
    blocks,
  };
  const checked = artifactContentSchema.safeParse(candidate);
  if (checked.success) {
    return { content: checked.data, issues };
  }
  for (const issue of checked.error.issues) {
    const [field, blockIndex] = issue.path;
    const line =
      field === "blocks" && typeof blockIndex === "number"
        ? (blockLines[blockIndex] ?? 1)
        : 1;
    issues.push({
      line,
      message: `${issue.path.map(String).join(".") || "file"}: ${issue.message}`,
    });
  }
  // A reader still shows what it can: the valid blocks, up to the limits.
  const title = meta.title?.slice(0, ARTIFACT_LIMITS.title);
  return {
    content:
      title && blocks.length > 0
        ? {
            title,
            summary: meta.summary?.slice(0, ARTIFACT_LIMITS.summary),
            blocks: blocks.slice(0, ARTIFACT_LIMITS.blocks),
          }
        : null,
    issues,
  };
}
