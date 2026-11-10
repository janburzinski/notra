/**
 * Rows hold Slack user IDs, so they are purged once the console can no longer
 * show them. Its longest range is 90 UTC days, which starts up to a day before
 * now minus 90 days.
 */
export const SLACK_AGENT_REQUEST_RETENTION_DAYS = 91;

export const SLACK_AGENT_REQUEST_TRIGGERS = [
  "mention",
  "direct_message",
  "thread_reply",
] as const;

/**
 * `blocked` is a mention in a channel the workspace has not enabled. A request
 * stays `pending` until its turn ends, so a stale one never got an answer.
 */
export const SLACK_AGENT_REQUEST_STATUSES = [
  "blocked",
  "pending",
  "completed",
  "failed",
  "cancelled",
] as const;
