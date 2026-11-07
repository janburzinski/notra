export const CHAT_STREAM_ID_HEADER = "x-chat-stream-id";
export const CHAT_STREAM_CURSOR_HEADER = "last-event-id";
export const CHAT_STREAM_MAX_EMPTY_RECONNECTS = 3;
export const CHAT_STREAM_HISTORY_LIMIT = 1000;

/**
 * Errors from the network or a crashed request rather than from Notra:
 * people see the friendly fallback instead.
 */
export const TECHNICAL_CHAT_ERROR =
  /fetch failed|failed to fetch|networkerror|network request failed|load failed|econn|etimedout|socket|internal server error|unexpected token|^\s*[{[]|^\w*error:/i;
