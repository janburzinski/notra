/** Strings (keys end in ":"), true, false, null and numbers in pretty-printed JSON. */
export const CHAT_TOOL_JSON_TOKEN_RE =
  /"(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

/** Punctuation and spacing between JSON tokens. */
export const CHAT_TOOL_JSON_PLAIN_CLASS = "text-muted-foreground/70";
