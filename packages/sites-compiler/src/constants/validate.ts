export const TEXT_SOURCE_FILE = /\.(?:mdx?|jsx?|json|txt|css|svg)$/i;
export const MDX_FILE = /\.mdx$/i;
export const SCRIPT_FILE = /\.jsx?$/i;

export const COLLAPSED_WARNING_CODES: ReadonlySet<string> = new Set([
  "unknown_prop",
  "frontmatter_unknown_key",
]);
export const COLLAPSED_WARNING_EXAMPLES = 3;
