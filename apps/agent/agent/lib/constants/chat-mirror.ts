export const MIRRORED_CHANNEL_KINDS = new Set(["channel:slack"]);

export const MIRROR_DELTA_THROTTLE_MS = 400;

export const MIRROR_DELTA_THROTTLE_MAX_ENTRIES = 200;

export const MIRROR_TOOL_OUTPUT_MAX_CHARS = 4000;

export const MIRROR_TOOL_NAME_OVERRIDES: Record<string, string> = {
  create_linkedin_post: "createLinkedInPost",
  search_web: "webSearch",
  web_search: "webSearch",
  web_fetch: "fetchWebpage",
};

/** How long a Slack person's name and photo are reused before a new lookup. */
export const SLACK_AUTHOR_CACHE_TTL_MS = 60 * 60 * 1000;
/** Slack people remembered at once; the oldest is dropped past this. */
export const SLACK_AUTHOR_CACHE_MAX_ENTRIES = 1000;
