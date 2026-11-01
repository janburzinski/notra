type SlackBlockValue =
  | string
  | number
  | boolean
  | null
  | readonly SlackBlockValue[]
  | { readonly [key: string]: SlackBlockValue };

export interface SlackBlock {
  readonly [key: string]: SlackBlockValue;
}

export interface PostAutopilotSlackMessageInput {
  organizationId: string;
  encryptedBotToken: string;
  destination: { teamId: string; channelId: string };
  text: string;
  blocks: readonly SlackBlock[];
  /** Stable UUID reused when a run retries delivery; not an exactly-once guarantee. */
  clientMessageId?: string;
}

export interface PostAutopilotSlackMessageResult {
  channel: string;
  ts: string;
  teamId: string;
}
