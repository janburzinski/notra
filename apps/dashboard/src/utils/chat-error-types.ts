export interface HandleStandaloneChatErrorOptions {
  setChatError: (message: string | null) => void;
  setPendingMessageId?: (messageId: string | null) => void;
  messages: ChatErrorMessages;
}

export interface ChatErrorMessages {
  usageLimit: string;
  fallback: string;
  /** When the browser is offline; the fallback otherwise. */
  offline?: string;
}
