import {
  UI_SOUND_BATCH_MS,
  UI_SOUND_CATEGORIES,
  UI_SOUND_CATEGORY_SOUNDS,
  UI_SOUND_PAIR_GAP_S,
  UI_SOUND_PREVIEW_QUIET_MS,
  UI_SOUND_PRIORITY,
  UI_SOUND_SLIDER_INTERVAL_MS,
} from "@/constants/ui-sounds";
import { getUiSoundSettings } from "@/lib/ui-sounds/store";
import { createNoiseBuffer, UI_SOUND_SYNTHS } from "@/lib/ui-sounds/synth";
import type {
  UiSound,
  UiSoundCategory,
  UiSoundRequest,
  UiSoundSynth,
} from "@/types/ui-sounds";

interface AudioOutput {
  context: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
}

const CATEGORY_OF = new Map<UiSound, UiSoundCategory>(
  UI_SOUND_CATEGORIES.flatMap((category) =>
    UI_SOUND_CATEGORY_SOUNDS[category].map(
      (sound) => [sound, category] as const
    )
  )
);

let audio: AudioOutput | null = null;
let pending: UiSoundRequest | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let quietUntil = 0;
let lastSliderAt = Number.NEGATIVE_INFINITY;

// Default volume (60) lands click peaks around -18 dBFS: present, not loud.
const MAX_GAIN = 1.6;

/** Perceived loudness grows roughly with the square of the gain. */
function volumeToGain(volume: number) {
  return (volume / 100) ** 2 * MAX_GAIN;
}

function createOutput(): AudioOutput | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") {
    return null;
  }
  const context = new AudioContext({ latencyHint: "interactive" });
  // Keeps overlapping sounds from clipping.
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
  const master = context.createGain();
  master.connect(limiter).connect(context.destination);
  return { context, master, noise: createNoiseBuffer(context) };
}

/**
 * Browsers only let audio start from a click or key press, so this runs in
 * those handlers. Elsewhere sounds are dropped rather than queued up.
 */
export function unlockUiSounds() {
  audio ??= createOutput();
  if (audio?.context.state === "suspended") {
    audio.context.resume().catch(() => undefined);
  }
  return audio;
}

function getVariantSynths(
  category: UiSoundCategory,
  variant: string
): Partial<Record<UiSound, UiSoundSynth>> | undefined {
  const variants: Record<
    string,
    Partial<Record<UiSound, UiSoundSynth>> | undefined
  > = UI_SOUND_SYNTHS[category];
  return variants[variant];
}

function getSynth(sound: UiSound): UiSoundSynth | null {
  const category = CATEGORY_OF.get(sound);
  if (!category) {
    return null;
  }
  const choice = getUiSoundSettings().variants[category];
  if (choice === "off") {
    return null;
  }
  return getVariantSynths(category, choice)?.[sound] ?? null;
}

function render(
  output: AudioOutput,
  synths: readonly UiSoundSynth[],
  value: number
) {
  const { context, master, noise } = output;
  master.gain.setValueAtTime(
    volumeToGain(getUiSoundSettings().volume),
    context.currentTime
  );
  for (const [index, synth] of synths.entries()) {
    synth({
      context,
      output: master,
      noise,
      time: context.currentTime + index * UI_SOUND_PAIR_GAP_S,
      value,
    });
  }
}

function flush() {
  flushTimer = null;
  const request = pending;
  pending = null;
  if (!request || performance.now() < quietUntil) {
    return;
  }
  // Never resume here: a suspended context would replay every sound at once
  // when it finally starts.
  if (audio?.context.state !== "running") {
    return;
  }
  const synth = getSynth(request.sound);
  if (synth) {
    render(audio, [synth], request.value ?? 0.5);
  }
}

/**
 * Asks for a sound. Requests that arrive together (a menu item that is picked
 * and closes its menu) play once, as the one with the highest priority.
 */
export function playUiSound(sound: UiSound, value?: number) {
  if (
    typeof document === "undefined" ||
    document.hidden ||
    !getUiSoundSettings().enabled ||
    performance.now() < quietUntil ||
    // A muted category must not win over the click that came with it.
    !getSynth(sound)
  ) {
    return;
  }
  if (sound === "slider") {
    const now = performance.now();
    if (now - lastSliderAt < UI_SOUND_SLIDER_INTERVAL_MS) {
      return;
    }
    lastSliderAt = now;
  }
  if (!pending || UI_SOUND_PRIORITY[sound] > UI_SOUND_PRIORITY[pending.sound]) {
    pending = { sound, value };
  }
  flushTimer ??= setTimeout(flush, UI_SOUND_BATCH_MS);
}

/**
 * Plays from a settings control right away, even before sounds are on, and
 * mutes the click, select and close sounds that control would also make.
 */
function playPreview(synths: readonly UiSoundSynth[]) {
  pending = null;
  quietUntil = performance.now() + UI_SOUND_PREVIEW_QUIET_MS;
  const output = unlockUiSounds();
  if (output && synths.length > 0) {
    render(output, synths, 0.5);
  }
}

/** Plays every sound of a variant, e.g. on then off for a toggle. */
export function previewUiSoundVariant(
  category: UiSoundCategory,
  variant: string
) {
  const sounds = getVariantSynths(category, variant);
  if (sounds) {
    playPreview(
      UI_SOUND_CATEGORY_SOUNDS[category].flatMap((sound) => sounds[sound] ?? [])
    );
  }
}

/** Plays one sound with the current settings, for a settings control. */
export function previewUiSound(sound: UiSound) {
  const synth = getSynth(sound);
  playPreview(synth ? [synth] : []);
}
