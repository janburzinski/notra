export interface SlackVoiceBilling {
  chargeAiCredits: boolean;
  useMarkup: boolean;
}

export interface SlackVoiceTranscription {
  /** Joined text of every clip that transcribed, or `null` if none did. */
  transcript: string | null;
  /** Clips that failed to download or transcribe. */
  failed: number;
}
