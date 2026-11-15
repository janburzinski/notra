import matter from "gray-matter";

import {
  AUTOPILOT_CONTENT_IMAGE_TYPES,
  AUTOPILOT_CONTENT_STATIC_DIRS,
} from "@/constants/autopilot-brief";
import type { AutopilotFindingPost } from "@/types/autopilot";

const FRONTMATTER_OPTIONS = {
  language: "yaml",
  engines: {
    javascript: () => {
      throw new Error("JavaScript frontmatter is not supported");
    },
  },
} satisfies matter.GrayMatterOption<string, never>;

/** `![alt](src "title")`, with the source optionally in angle brackets. */
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
/** A URL with a scheme (https:, data:) or protocol-relative: not a repository path. */
const EXTERNAL_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Splits a post file into its title, description and Markdown body. A file
 * whose frontmatter does not parse is shown as it is.
 */
export function parsePostFile(
  raw: string
): Pick<AutopilotFindingPost, "title" | "description" | "body"> {
  try {
    const parsed = matter(raw, FRONTMATTER_OPTIONS);
    const data = parsed.data as Record<string, unknown>;
    return {
      title: text(data.title),
      description: text(data.description) ?? text(data.summary),
      body: parsed.content.trim(),
    };
  } catch {
    return { title: null, description: null, body: raw.trim() };
  }
}

/** Repository paths a post's Markdown shows as images, each once. */
export function postImageSources(body: string): string[] {
  const sources = new Set<string>();
  for (const match of body.matchAll(MARKDOWN_IMAGE)) {
    const source = match[1];
    if (source && !EXTERNAL_URL.test(source)) {
      sources.add(source);
    }
  }
  return [...sources];
}

/** Points the Markdown images whose source is in `replacements` at a new source. */
export function replaceImageSources(
  body: string,
  replacements: Map<string, string>
): string {
  return body.replace(MARKDOWN_IMAGE, (image: string, source: string) => {
    const replacement = replacements.get(source);
    if (!replacement) {
      return image;
    }
    // The alt text can't hold "](", so the source is the first match after it.
    const target = image.indexOf("](") + 2;
    return `${image.slice(0, target)}${image.slice(target).replace(source, replacement)}`;
  });
}

/** The MIME type of an image the modal can inline, or null for any other file. */
export function imageMimeType(path: string): string | null {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return AUTOPILOT_CONTENT_IMAGE_TYPES[extension] ?? null;
}

function joinPath(segments: string[]): string | null {
  const parts: string[] = [];
  for (const segment of segments) {
    if (segment === "..") {
      if (parts.length === 0) {
        return null;
      }
      parts.pop();
    } else if (segment && segment !== ".") {
      parts.push(segment);
    }
  }
  return parts.join("/");
}

function decodePath(source: string) {
  const path = source.split(/[?#]/)[0] ?? "";
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

/**
 * Which of the pull request's image files a post's image source points at.
 * `./a.png` resolves against the post's folder; `/images/a.png` is served
 * from the site root, so it may live under `public/` or `static/` at any
 * depth. Failing that, the one image with the same file name. Null when
 * nothing matches or the match is ambiguous.
 */
export function resolvePostImagePath(
  postPath: string,
  source: string,
  imagePaths: string[]
): string | null {
  const path = decodePath(source);
  if (!path || EXTERNAL_URL.test(path)) {
    return null;
  }
  if (path.startsWith("/")) {
    const fromRoot = joinPath(path.split("/"));
    const served = imagePaths.filter(
      (candidate) =>
        candidate === fromRoot ||
        AUTOPILOT_CONTENT_STATIC_DIRS.some(
          (dir) =>
            candidate === `${dir}/${fromRoot}` ||
            candidate.endsWith(`/${dir}/${fromRoot}`)
        )
    );
    if (served.length === 1) {
      return served[0] ?? null;
    }
  } else {
    const resolved = joinPath([
      ...postPath.split("/").slice(0, -1),
      ...path.split("/"),
    ]);
    if (resolved && imagePaths.includes(resolved)) {
      return resolved;
    }
  }
  const name = path.split("/").pop();
  const sameName = imagePaths.filter(
    (candidate) => candidate === name || candidate.endsWith(`/${name}`)
  );
  return sameName.length === 1 ? (sameName[0] ?? null) : null;
}
