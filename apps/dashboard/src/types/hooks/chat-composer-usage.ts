export interface UseChatComposerUsageResult {
  /** Clears the composer's own error and asks the host to clear its one. */
  clearError: () => void;
  /** Checks the credits right before sending; sets the error when out. */
  ensureCanSend: () => boolean;
  isUsageBlocked: boolean;
  remainingChatCredits: number | null;
  setInternalError: (error: string | null) => void;
  shouldShowLowCredits: boolean;
  usageLimitError: string | null;
}
