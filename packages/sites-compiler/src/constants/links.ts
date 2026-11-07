import type { SiteArea } from "@notra/sites-core/types/deployment";

export const LINK_ATTRIBUTE = "href";

/** Element props that load a file, for HTML tags and the built-in components. */
export const ASSET_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  img: ["src"],
  video: ["src", "poster"],
  source: ["src"],
  Card: ["img"],
  Video: ["src", "poster"],
};

/** Elements whose srcset (srcSet in JSX) lists image candidates. */
export const SRCSET_ELEMENTS: ReadonlySet<string> = new Set(["img", "source"]);

export const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

export const HTML_TAG = /<([a-z][a-z\d-]*)\b([^>]*)>/gi;

// Quoted, single-quoted or unquoted, as HTML allows.
export const HTML_ATTRIBUTE =
  /\s([a-z][a-z\d-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;

/** Starts a fragment directive, like #intro:~:text=Hello, which isn't part of the ID. */
export const FRAGMENT_DIRECTIVE = ":~:";

/** closestName only accepts two edits, so longer or shorter paths can't match. */
export const SUGGESTION_MAX_LENGTH_DIFFERENCE = 2;

/** The theme's author pages, such as /blog/author/jan. */
export const AUTHOR_PAGES_PATH = "author";

/**
 * First path segments under a mount whose pages or files depend on the build
 * (tag and author pages, generated assets, the 404 page), so a check of the
 * source alone can't tell whether they exist.
 */
export const BUILT_ROUTE_SEGMENTS: ReadonlySet<string> = new Set([
  "tags",
  AUTHOR_PAGES_PATH,
  "_notra",
  ".well-known",
  "404",
]);

/** Files the build only writes from public/ or under _notra/. */
export const MEDIA_FILE =
  /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp|m4v|mov|mp4|ogv|webm)$/i;

export const CHROME_AREAS: readonly SiteArea[] = ["blog", "changelog"];

/** Where each slot renders: an area's index, its entry pages or its author pages. */
export const SLOT_PAGES: Readonly<
  Record<
    string,
    { area: SiteArea; on: "index" | "entries" | "authors" } | "every"
  >
> = {
  "blog-hero": { area: "blog", on: "index" },
  "changelog-hero": { area: "changelog", on: "index" },
  "author-hero": { area: "blog", on: "authors" },
  "before-post": { area: "blog", on: "entries" },
  "after-post": { area: "blog", on: "entries" },
  sidebar: { area: "blog", on: "entries" },
  "after-changelog-entry": { area: "changelog", on: "entries" },
  "before-footer": "every",
};
