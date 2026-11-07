export const LINK_ATTRIBUTE = "href";

/** Element props that load a file, for HTML tags and the built-in components. */
export const ASSET_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  img: ["src"],
  video: ["src", "poster"],
  source: ["src"],
  Card: ["img"],
  Video: ["src", "poster"],
};

export const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

export const HTML_TAG = /<([a-z][a-z\d-]*)\b([^>]*)>/gi;

// Quoted, single-quoted or unquoted, as HTML allows.
export const HTML_ATTRIBUTE =
  /\s([a-z][a-z\d-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;

/** closestName only accepts two edits, so longer or shorter paths can't match. */
export const SUGGESTION_MAX_LENGTH_DIFFERENCE = 2;
