/** A single sound the interface can ask for, e.g. `toggleOn`. */
export type UiSound =
  | "click"
  | "toggleOn"
  | "toggleOff"
  | "select"
  | "open"
  | "close"
  | "copy"
  | "send"
  | "destructive"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "slider";

export interface UiSoundVoice {
  context: BaseAudioContext;
  output: AudioNode;
  noise: AudioBuffer;
  /** Start time in the context's clock. */
  time: number;
  /** Slider position from 0 to 1, for sounds that follow it. */
  value: number;
}

export type UiSoundSynth = (voice: UiSoundVoice) => void;

export interface UiSoundRequest {
  sound: UiSound;
  value?: number;
}
