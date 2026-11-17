const SLACK_USER_MENTION_REGEX = /<@([A-Z0-9]+)(?:\|[^>]*)?>/gu;
const SLACK_CHANNEL_MENTION_REGEX = /<#[A-Z0-9]+\|([^>]*)>/gu;
const SLACK_SPECIAL_MENTION_REGEX = /<!(here|channel|everyone)[^>]*>/gu;
const SLACK_LABELLED_LINK_REGEX = /<((?:https?|mailto):[^|>]+)\|([^>]+)>/gu;
const SLACK_BARE_LINK_REGEX = /<((?:https?|mailto):[^>]+)>/gu;
const SLACK_ENTITY_REGEX = /&(amp|lt|gt);/gu;
const SLACK_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">" };

/**
 * Turns Slack's message markup into the Markdown the chat renders: mentions
 * become names, links become Markdown links, and escaped characters come back.
 */
export function slackMrkdwnToMarkdown(
  text: string,
  nameOf: (userId: string) => string | undefined
): string {
  return text
    .replace(
      SLACK_USER_MENTION_REGEX,
      (_match, userId: string) => `@${nameOf(userId) ?? "someone"}`
    )
    .replace(SLACK_CHANNEL_MENTION_REGEX, (_match, name: string) => `#${name}`)
    .replace(SLACK_SPECIAL_MENTION_REGEX, (_match, name: string) => `@${name}`)
    .replace(
      SLACK_LABELLED_LINK_REGEX,
      (_match, url: string, label: string) => `[${label}](${url})`
    )
    .replace(SLACK_BARE_LINK_REGEX, (_match, url: string) => url)
    .replace(
      SLACK_ENTITY_REGEX,
      (match, entity: string) => SLACK_ENTITIES[entity] ?? match
    )
    .trim();
}
