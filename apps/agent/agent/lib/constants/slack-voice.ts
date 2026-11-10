/** Speech-to-text model for Slack voice messages, via Vercel AI Gateway. */
export const SLACK_VOICE_TRANSCRIPTION_MODEL = "openai/gpt-transcribe";

/** Gateway list price of the model above, billed per second of audio. */
export const SLACK_VOICE_COST_USD_PER_SECOND = 0.000_075;

/** OpenAI's upload limit for transcription. */
export const SLACK_VOICE_MAX_BYTES = 25 * 1024 * 1024;

/** Voice clips transcribed per message; the rest are ignored. */
export const SLACK_VOICE_MAX_FILES = 3;

export const SLACK_VOICE_TIMEOUT_MS = 60_000;

/** Slack's `files[].subtype` for clips recorded in the composer. */
export const SLACK_AUDIO_CLIP_SUBTYPE = "slack_audio";

export const SLACK_VOICE_TRANSCRIBING_STATUS = "Listening…";

export const SLACK_VOICE_FAILED_MESSAGE =
  "I couldn't transcribe that voice message. Try recording it again, or type it out.";
