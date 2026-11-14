export const MARKDOWN_TYPES = new Set(["text/markdown", "text/x-markdown"]);
export const HTML_TYPES = new Set(["text/html", "application/xhtml+xml"]);

export const REPEATED_SLASHES = /\/{2,}/g;
/** Served for directory paths, so its own address is a duplicate. */
export const INDEX_PAGE = "index.html";
