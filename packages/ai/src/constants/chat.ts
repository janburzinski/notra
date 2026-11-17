export const CHAT_ABORT_FLAG_TTL_SECONDS = 300;
export const CHAT_ACTIVE_STREAM_TTL_SECONDS = 600;
export const CHAT_ACTIVE_STREAM_REFRESH_INTERVAL_MS = 60_000;
export const CHAT_WORKFLOW_REQUEST_TTL_SECONDS = 60 * 60 * 24;
export const CHAT_LAST_STOPPED_TTL_SECONDS = 300;
export const CHAT_ABORT_POLL_INTERVAL_MS = 500;
export const CHAT_STREAM_MAX_LIFETIME_MS = 9 * 60 * 1000;
/** How long a mirrored turn counts as running without a status update. */
export const CHAT_MIRROR_RUNNING_TTL_SECONDS = 15 * 60;
/** Chats checked per MGET when listing running chats. */
export const CHAT_RUNNING_LOOKUP_BATCH = 100;
/**
 * Only chats active this recently can be streaming: sending saves the chat,
 * and no stream outlives a day, so older ones skip the Redis lookup.
 */
export const CHAT_RUNNING_LOOKUP_WINDOW_MS = 24 * 60 * 60 * 1000;
export const CHAT_TITLE_MAX_LENGTH = 80;
export const SLACK_RELAY_EVENT_TYPE = "notra_dashboard_message";
export const CHAT_PREVIEW_SAVE_TIMEOUT_MS = 30_000;
export const CHAT_INTEGRATIONS_CACHE_TTL_SECONDS = 300;
