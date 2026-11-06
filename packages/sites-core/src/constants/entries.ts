export const SITE_ENTRY_FILE = /^(blog|changelog)\/(.+)\.(mdx?)$/;
export const SITE_ENTRY_SLUG = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/;
export const SITE_ENTRY_INDEX_SUFFIX = "/index";
export const SURROUNDING_SLASHES = /^\/+|\/+$/g;

/**
 * Every URL a built entry answers with a 200, besides the page itself: the
 * Markdown twin agents are pointed to (llms.txt, the `Link` header) and the
 * files the page is stored as.
 */
export const SITE_ENTRY_PATH_VARIANTS = [
  "",
  ".md",
  "/index.md",
  "/index.html",
  "/index",
] as const;
