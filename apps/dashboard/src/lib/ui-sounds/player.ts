import {
  UI_SOUND_BATCH_MS,
  UI_SOUND_GAIN,
  UI_SOUND_PREVIEW_QUIET_MS,
  UI_SOUND_PRIORITY,
  UI_SOUND_SLIDER_INTERVAL_MS,
} from "@/constants/ui-sounds";
import { getUiSoundsEnabled } from "@/lib/ui-sounds/store";
import { createNoiseBuffer, UI_SOUND_SYNTHS } from "@/lib/ui-sounds/synth";
import type { UiSound, UiSoundRequest } from "@/types/ui-sounds";

interface AudioOutput {
  context: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
}

let audio: AudioOutput | null = null;
let pending: UiSoundRequest | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let quietUntil = 0;
let lastSliderAt = Number.NEGATIVE_INFINITY;

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
  master.gain.value = UI_SOUND_GAIN;
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

function render(output: AudioOutput, sound: UiSound, value: number) {
  const { context, master, noise } = output;
  UI_SOUND_SYNTHS[sound]({
    context,
    output: master,
    noise,
    time: context.currentTime,
    value,
  });
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
  render(audio, request.sound, request.value ?? 0.5);
}

/**
 * Asks for a sound. Requests that arrive together (a menu item that is picked
 * and closes its menu) play once, as the one with the highest priority.
 */
export function playUiSound(sound: UiSound, value?: number) {
  if (
    typeof document === "undefined" ||
    document.hidden ||
    !getUiSoundsEnabled() ||
    performance.now() < quietUntil
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
 * mutes the click sound that control would also make.
 */
export function previewUiSound(sound: UiSound) {
  pending = null;
  quietUntil = performance.now() + UI_SOUND_PREVIEW_QUIET_MS;
  const output = unlockUiSounds();
  if (output) {
    render(output, sound, 0.5);
  }
}
