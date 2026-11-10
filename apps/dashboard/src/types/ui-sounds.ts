import type {
  UI_SOUND_CATEGORY_SOUNDS,
  UI_SOUND_VARIANTS,
} from "@/constants/ui-sounds";

/** A group of sounds that share one variant picker in settings. */
export type UiSoundCategory = keyof typeof UI_SOUND_VARIANTS;

type UiSoundVariant<C extends UiSoundCategory = UiSoundCategory> =
  (typeof UI_SOUND_VARIANTS)[C][number];

/** A single sound the interface can ask for, e.g. `toggleOn`. */
export type UiSound =
  (typeof UI_SOUND_CATEGORY_SOUNDS)[UiSoundCategory][number];

type UiSoundCategorySound<C extends UiSoundCategory> =
  (typeof UI_SOUND_CATEGORY_SOUNDS)[C][number];

/** `off` mutes one category while the others keep playing. */
export type UiSoundChoice<C extends UiSoundCategory = UiSoundCategory> =
  | UiSoundVariant<C>
  | "off";

export interface UiSoundSettings {
  enabled: boolean;
  /** 0–100 */
  volume: number;
  variants: { [C in UiSoundCategory]: UiSoundChoice<C> };
}

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

export type UiSoundSynthTable = {
  [C in UiSoundCategory]: {
    [V in UiSoundVariant<C>]: { [S in UiSoundCategorySound<C>]: UiSoundSynth };
  };
};

export interface UiSoundRequest {
  sound: UiSound;
  value?: number;
}
