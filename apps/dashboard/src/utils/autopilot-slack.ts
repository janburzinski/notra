/** Escapes the characters Slack mrkdwn treats as control sequences. */
export function escapeSlackText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Keep generated copy on one line and escape after truncating, not mid-entity. */
export function compactSlackText(value: string, limit: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return escapeSlackText(
    text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
  );
}
