import { type ParserPlugin, parse, parseExpression } from "@babel/parser";

import {
  AUTOPILOT_COPY_ACTIVE,
  AUTOPILOT_COPY_FILE,
  AUTOPILOT_COPY_LINK,
  AUTOPILOT_COPY_NAMES,
} from "@/constants/autopilot-landing";
import type { AutopilotCopyCheck } from "@/types/autopilot-templates-runtime";

interface AstNode {
  type: string;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}

const PLACEHOLDER = "\u0000";

interface CopyRange {
  start: number;
  end: number;
  text: string;
  metadata: boolean;
}

/** Elements whose contents are code, never copy. */
const INERT_ELEMENTS = new Set(["script", "style"]);
/** Where a page's title and description live. */
const METADATA_NAMES = new Set(["metadata", "generateMetadata"]);
/** Wrappers that don't change what a value is, e.g. `[…] as const`. */
const WRAPPERS = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "ParenthesizedExpression",
]);
const SKIPPED_KEYS = new Set([
  "loc",
  "extra",
  "comments",
  "leadingComments",
  "trailingComments",
  "innerComments",
  "errors",
  "start",
  "end",
  "range",
]);

function isNode(value: unknown): value is AstNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function nameOf(node: unknown): string | null {
  if (!isNode(node)) {
    return null;
  }
  if (node.type === "Identifier" || node.type === "JSXIdentifier") {
    return typeof node.name === "string" ? node.name : null;
  }
  if (node.type === "StringLiteral") {
    return typeof node.value === "string" ? node.value : null;
  }
  return node.type === "JSXNamespacedName" ? nameOf(node.name) : null;
}

/** Whether a prop, key or variable name holds visible text, by its last word. */
function isCopyName(name: string | null) {
  const last = name
    ?.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .at(-1)
    ?.toLowerCase();
  return last ? AUTOPILOT_COPY_NAMES.has(last) : false;
}

/**
 * Whether a string sits where visible text goes: a JSX child, a text prop
 * such as `alt` or `title`, or the value of a key or variable named for text,
 * directly or in an array (`features: ["…", "…"]`).
 */
function isCopyPlace(node: AstNode, ancestors: AstNode[]) {
  let child: AstNode = node;
  let index = ancestors.length - 1;
  const up = () => {
    let parent = ancestors[index];
    while (parent && WRAPPERS.has(parent.type)) {
      child = parent;
      index -= 1;
      parent = ancestors[index];
    }
    return parent;
  };
  let parent = up();
  if (parent?.type === "ArrayExpression") {
    child = parent;
    index -= 1;
    parent = up();
  }
  // `{"…"}` belongs to the element or attribute it sits in.
  if (parent?.type === "JSXExpressionContainer") {
    child = parent;
    index -= 1;
    parent = up();
  }
  switch (parent?.type) {
    case "JSXElement":
    case "JSXFragment":
      return true;
    case "JSXAttribute":
      return parent.value === child && isCopyName(nameOf(parent.name));
    case "ObjectProperty":
      return (
        parent.value === child &&
        parent.computed !== true &&
        isCopyName(nameOf(parent.key))
      );
    case "VariableDeclarator":
      return parent.init === child && isCopyName(nameOf(parent.id));
    default:
      return false;
  }
}

/** The text a literal holds, decoded, or null when it isn't a plain literal. */
function literalText(node: AstNode) {
  if (node.type === "JSXText" || node.type === "StringLiteral") {
    return typeof node.value === "string" ? node.value : null;
  }
  if (
    node.type === "TemplateLiteral" &&
    Array.isArray(node.expressions) &&
    node.expressions.length === 0 &&
    Array.isArray(node.quasis)
  ) {
    const [quasi] = node.quasis as { value?: { cooked?: string | null } }[];
    return quasi?.value?.cooked ?? null;
  }
  return null;
}

function elementName(node: AstNode) {
  if (node.type !== "JSXElement" || !isNode(node.openingElement)) {
    return null;
  }
  return nameOf(node.openingElement.name)?.toLowerCase() ?? null;
}

/** Whether copy is the page's title or description rather than text on it. */
function isMetadata(ancestors: AstNode[]) {
  return ancestors.some(
    (node) =>
      elementName(node) === "title" ||
      ((node.type === "VariableDeclarator" ||
        node.type === "FunctionDeclaration") &&
        METADATA_NAMES.has(nameOf(node.id) ?? ""))
  );
}

/** Where a node's copy sits in the source and what it says, or null when it holds none. */
function copyRange(node: AstNode, ancestors: AstNode[]): CopyRange | null {
  const { start, end } = node;
  const text = literalText(node);
  if (typeof start !== "number" || typeof end !== "number" || text === null) {
    return null;
  }
  const copy =
    node.type === "JSXText" ? text.trim() !== "" : isCopyPlace(node, ancestors);
  return copy ? { start, end, text, metadata: isMetadata(ancestors) } : null;
}

/** A node's own values, e.g. an identifier's name; layout whitespace in JSX text is ignored. */
function nodeValues(node: AstNode) {
  const values = Object.entries(node).flatMap(([key, value]) => {
    if (
      SKIPPED_KEYS.has(key) ||
      (typeof value === "object" && value !== null)
    ) {
      return [];
    }
    if (
      node.type === "JSXText" &&
      key === "value" &&
      typeof value === "string"
    ) {
      return [
        [
          key,
          /\n/.test(value) && !value.trim() ? "" : value.replace(/\s+/g, " "),
        ],
      ];
    }
    return [[key, value]];
  });
  return JSON.stringify(values);
}

function parserPlugins(path: string): ParserPlugin[] {
  if (path.endsWith(".tsx")) {
    return ["typescript", "jsx"];
  }
  return /\.[cm]?ts$/.test(path) ? ["typescript"] : ["jsx"];
}

/**
 * The file's copy and everything else: each piece of visible text, and the
 * syntax tree in order with that text replaced by a placeholder. Two versions
 * with the same skeleton differ only in copy, comments, quotes and layout;
 * a line break that changes what the code does changes the tree.
 */
function readCopy(path: string, source: string) {
  const root: unknown = path.endsWith(".json")
    ? parseExpression(source)
    : parse(source, { sourceType: "module", plugins: parserPlugins(path) });
  const ranges: CopyRange[] = [];
  const skeleton: { key: string; start: number }[] = [];
  const visit = (
    value: unknown,
    label: string,
    ancestors: AstNode[],
    inert: boolean,
    at: number
  ) => {
    if (Array.isArray(value)) {
      skeleton.push({ key: `${label}[${value.length}]`, start: at });
      for (const item of value) {
        visit(item, label, ancestors, inert, at);
      }
      return;
    }
    if (!isNode(value)) {
      // Template parts compare by what they say, not how they are escaped.
      const plain =
        typeof value === "object" && value !== null && "cooked" in value
          ? (value as { cooked?: unknown }).cooked
          : value;
      skeleton.push({ key: `${label}=${JSON.stringify(plain)}`, start: at });
      return;
    }
    const start = typeof value.start === "number" ? value.start : at;
    const range = inert ? null : copyRange(value, ancestors);
    if (range) {
      ranges.push(range);
      skeleton.push({ key: `${label}=${PLACEHOLDER}`, start });
      return;
    }
    skeleton.push({
      key: `${label}=${value.type}${nodeValues(value)}`,
      start,
    });
    const next = [...ancestors, value];
    const inertInside = inert || INERT_ELEMENTS.has(elementName(value) ?? "");
    for (const [key, child] of Object.entries(value)) {
      if (
        !SKIPPED_KEYS.has(key) &&
        typeof child === "object" &&
        child !== null
      ) {
        visit(child, key, next, inertInside, start);
      }
    }
  };
  visit(root, "", [], false, 0);
  return { skeleton, ranges };
}

/** The first line of the new file whose code differs from the old one, or null. */
function firstCodeChange(
  before: ReturnType<typeof readCopy>,
  after: ReturnType<typeof readCopy>,
  source: string
) {
  const length = Math.max(before.skeleton.length, after.skeleton.length);
  for (let index = 0; index < length; index += 1) {
    if (before.skeleton[index]?.key !== after.skeleton[index]?.key) {
      const start = after.skeleton[index]?.start ?? source.length;
      const lineStart = source.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = source.indexOf("\n", start);
      return source
        .slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
        .trim();
    }
  }
  return null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function plainCopy(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The text a new version of a file changes, when that is all it changes:
 * code, imports, class names, links and structure must stay as they are.
 */
export function findCopyChanges(params: {
  path: string;
  previous: string | null;
  next: string;
}): AutopilotCopyCheck {
  const { path, previous, next } = params;
  if (!AUTOPILOT_COPY_FILE.test(path)) {
    return {
      ok: false,
      reason:
        "Autopilot can only change copy in JavaScript, TypeScript or JSON files.",
    };
  }
  if (previous === null) {
    return {
      ok: false,
      reason: "Only change the copy of files that exist; never create files.",
    };
  }
  let before: ReturnType<typeof readCopy>;
  try {
    before = readCopy(path, previous);
  } catch {
    return {
      ok: false,
      reason: "This file can't be parsed, so its copy can't be checked.",
    };
  }
  let after: ReturnType<typeof readCopy>;
  try {
    after = readCopy(path, next);
  } catch (error) {
    return {
      ok: false,
      reason: `The new file doesn't parse (${errorMessage(error)}). Escape quotes and braces in the text you write.`,
    };
  }
  const changed = firstCodeChange(before, after, next);
  if (changed !== null) {
    return {
      ok: false,
      reason: `Only visible text may change, never code, links, class names or structure, and no elements may be added or removed. This line changes more than text: ${changed}`,
    };
  }
  const changes = after.ranges.flatMap((range, index) => {
    const old = before.ranges[index]?.text ?? "";
    return range.text === old
      ? []
      : [{ path, before: old, after: range.text, metadata: range.metadata }];
  });
  for (const change of changes) {
    const old = plainCopy(change.before);
    const now = plainCopy(change.after);
    const link = [old, now].find((text) => AUTOPILOT_COPY_LINK.test(text));
    if (link !== undefined) {
      return {
        ok: false,
        reason: `"${link}" is a link or path, not copy; leave it as it is.`,
      };
    }
    if (AUTOPILOT_COPY_ACTIVE.test(now)) {
      return {
        ok: false,
        reason: `"${now}" contains script or event handler text, which copy never needs.`,
      };
    }
  }
  return {
    ok: true,
    changes: changes.map((change) => ({
      path,
      before: plainCopy(change.before),
      after: plainCopy(change.after),
      metadata: change.metadata,
    })),
  };
}
