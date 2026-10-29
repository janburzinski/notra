export interface SlackInfoChannelEvent {
  emoji: string;
  title: string;
  /** Empty values are left out of the message. */
  fields: Record<string, string | null | undefined>;
}
