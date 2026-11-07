import {
  CHAT_TOOL_JSON_PLAIN_CLASS,
  CHAT_TOOL_JSON_TOKEN_RE,
} from "@/constants/chat-tool-json";

function tokenClass(token: string) {
  if (token.startsWith('"')) {
    return token.endsWith(":") ? "text-muted-foreground" : "text-foreground";
  }
  if (token === "null") {
    return "text-muted-foreground/60 italic";
  }
  if (token === "true" || token === "false") {
    return "text-foreground";
  }
  return "text-foreground tabular-nums";
}

/** Pretty-printed JSON as spans: keys, strings, numbers and null each colored. */
export function highlightJsonTokens(text: string) {
  const parts: { text: string; className: string; key: string }[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CHAT_TOOL_JSON_TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, start),
        className: CHAT_TOOL_JSON_PLAIN_CLASS,
        key: `plain-${lastIndex}-${start}`,
      });
    }
    const token = match[0];
    parts.push({
      text: token,
      className: tokenClass(token),
      key: `token-${start}-${token.length}`,
    });
    lastIndex = start + token.length;
  }
  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      className: CHAT_TOOL_JSON_PLAIN_CLASS,
      key: `plain-${lastIndex}-${text.length}`,
    });
  }
  return parts;
}
