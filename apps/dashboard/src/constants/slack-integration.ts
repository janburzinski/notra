export const SLACK_OAUTH_STATE_TTL_SECONDS = 600;

export const SLACK_BOT_SCOPES = [
  "assistant:write",
  "app_mentions:read",
  "chat:write",
  "channels:history",
  "channels:read",
  "channels:manage",
  "groups:history",
  "groups:read",
  "im:history",
  "files:read",
  "files:write",
  "reactions:read",
  "reactions:write",
  "users:read",
  "users:read.email",
].join(",");

export const SLACK_CHANNEL_CACHE_TTL_SECONDS = 60 * 60;

export const NOTRA_CONSOLE_DEFAULT_URL = "https://console.usenotra.com";

export const SLACK_INFO_CHANNEL_TIMEOUT_MS = 5000;

export const SLACK_MEMBER_CACHE_TTL_MS = 60_000;

export const SLACK_MEMBER_CACHE_MAX_ENTRIES = 500;

export const SLACK_MISSING_SCOPE_KEY_PREFIX = "slack:missing-scope:";

export const SLACK_MISSING_SCOPE_TTL_SECONDS = 60 * 60 * 24 * 30;

/** How mentions of the Notra app read in a Slack thread shown in a chat. */
export const SLACK_ASSISTANT_NAME = "Notra";
/** Messages read when filling an empty Slack chat; matches the chat's cap. */
export const SLACK_THREAD_BACKFILL_LIMIT = 200;
/** Characters of the first message kept in a Slack chat's title, like the agent. */
export const SLACK_CHAT_TITLE_PREVIEW_LENGTH = 49;
/** How long a Slack thread that couldn't be loaded waits before a retry. */
export const SLACK_THREAD_BACKFILL_RETRY_SECONDS = 10 * 60;
