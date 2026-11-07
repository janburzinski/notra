export const TEXT_SOURCE_FILE = /\.(?:mdx?|jsx?|json|txt|css|svg)$/i;
export const MDX_FILE = /\.mdx$/i;
export const SCRIPT_FILE = /\.jsx?$/i;

export const COLLAPSED_WARNING_CODES: ReadonlySet<string> = new Set([
  "unknown_prop",
  "frontmatter_unknown_key",
]);
export const COLLAPSED_WARNING_EXAMPLES = 3;

/** Author links blog.json still accepts with any scheme; newer ones must be http(s). */
export const ANY_SCHEME_AUTHOR_LINK_FIELDS = [
  "url",
  "x",
  "linkedin",
  "github",
  "youtube",
] as const;
