import type { UiSound, UiSoundSynth, UiSoundVoice } from "@/types/ui-sounds";

// Exponential ramps can't reach zero, so envelopes start and end here.
const SILENT = 0.0001;
const DEFAULT_ATTACK = 0.003;
const NOISE_SECONDS = 1;

interface ToneOptions {
  frequency: number;
  /** Glides to this frequency over `glide` seconds (default: the duration). */
  to?: number;
  glide?: number;
  type?: OscillatorType;
  start?: number;
  attack?: number;
  duration: number;
  gain: number;
  lowpass?: number;
}

interface NoiseOptions {
  filter: BiquadFilterType;
  frequency: number;
  to?: number;
  q?: number;
  start?: number;
  attack?: number;
  duration: number;
  gain: number;
}

function envelope(
  voice: UiSoundVoice,
  start: number,
  attack: number,
  duration: number,
  gain: number
) {
  const node = voice.context.createGain();
  node.gain.setValueAtTime(SILENT, start);
  node.gain.exponentialRampToValueAtTime(gain, start + attack);
  node.gain.exponentialRampToValueAtTime(SILENT, start + duration);
  node.connect(voice.output);
  return node;
}

function tone(voice: UiSoundVoice, options: ToneOptions) {
  const { context } = voice;
  const start = voice.time + (options.start ?? 0);
  const end = start + options.duration;
  const oscillator = context.createOscillator();
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(options.frequency, start);
  if (options.to !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(
      options.to,
      start + (options.glide ?? options.duration)
    );
  }
  const gain = envelope(
    voice,
    start,
    options.attack ?? DEFAULT_ATTACK,
    options.duration,
    options.gain
  );
  if (options.lowpass === undefined) {
    oscillator.connect(gain);
  } else {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = options.lowpass;
    oscillator.connect(filter).connect(gain);
  }
  oscillator.start(start);
  oscillator.stop(end + 0.01);
  oscillator.addEventListener("ended", () => gain.disconnect(), {
    once: true,
  });
}

function noise(voice: UiSoundVoice, options: NoiseOptions) {
  const { context } = voice;
  const start = voice.time + (options.start ?? 0);
  const end = start + options.duration;
  const source = context.createBufferSource();
  source.buffer = voice.noise;
  const filter = context.createBiquadFilter();
  filter.type = options.filter;
  filter.Q.value = options.q ?? 1;
  filter.frequency.setValueAtTime(options.frequency, start);
  if (options.to !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(options.to, end);
  }
  const gain = envelope(
    voice,
    start,
    options.attack ?? 0.001,
    options.duration,
    options.gain
  );
  source.connect(filter).connect(gain);
  source.start(start);
  source.stop(end + 0.01);
  source.addEventListener("ended", () => gain.disconnect(), { once: true });
}

/** Seeded so every play of a noise sound is the same sound. */
export function createNoiseBuffer(context: BaseAudioContext) {
  const length = Math.floor(context.sampleRate * NOISE_SECONDS);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x2f_6b_1d_57;
  for (let index = 0; index < length; index += 1) {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    data[index] = (seed / 4_294_967_296) * 2 - 1;
  }
  return buffer;
}

export const UI_SOUND_SYNTHS: Record<UiSound, UiSoundSynth> = {
  click: (voice) => {
    tone(voice, {
      frequency: 2600,
      attack: 0.001,
      duration: 0.014,
      gain: 0.2,
    });
    tone(voice, {
      frequency: 5200,
      attack: 0.001,
      duration: 0.007,
      gain: 0.05,
    });
  },
  toggleOn: (voice) => {
    noise(voice, {
      filter: "highpass",
      frequency: 4000,
      duration: 0.012,
      gain: 0.2,
    });
    tone(voice, { frequency: 1100, to: 1700, duration: 0.045, gain: 0.15 });
  },
  toggleOff: (voice) => {
    noise(voice, {
      filter: "highpass",
      frequency: 3000,
      duration: 0.012,
      gain: 0.18,
    });
    tone(voice, { frequency: 1500, to: 950, duration: 0.045, gain: 0.15 });
  },
  select: (voice) => {
    tone(voice, { frequency: 1320, duration: 0.05, gain: 0.18 });
  },
  open: (voice) => {
    noise(voice, {
      filter: "bandpass",
      frequency: 500,
      to: 2600,
      q: 1.2,
      attack: 0.04,
      duration: 0.14,
      gain: 0.65,
    });
  },
  close: (voice) => {
    noise(voice, {
      filter: "bandpass",
      frequency: 2400,
      to: 450,
      q: 1.2,
      attack: 0.02,
      duration: 0.12,
      gain: 0.55,
    });
  },
  copy: (voice) => {
    tone(voice, { frequency: 1760, duration: 0.22, gain: 0.15 });
    tone(voice, { frequency: 3520, duration: 0.08, gain: 0.035 });
  },
  send: (voice) => {
    noise(voice, {
      filter: "bandpass",
      frequency: 400,
      to: 3200,
      q: 0.9,
      attack: 0.06,
      duration: 0.2,
      gain: 0.5,
    });
    tone(voice, {
      frequency: 600,
      to: 1200,
      attack: 0.04,
      duration: 0.15,
      gain: 0.04,
    });
  },
  destructive: (voice) => {
    tone(voice, {
      frequency: 170,
      to: 70,
      glide: 0.12,
      duration: 0.16,
      gain: 0.22,
    });
    noise(voice, {
      filter: "lowpass",
      frequency: 400,
      duration: 0.06,
      gain: 0.3,
    });
  },
  success: (voice) => {
    tone(voice, { frequency: 1047, duration: 0.25, gain: 0.1 });
    tone(voice, {
      frequency: 1319,
      start: 0.06,
      duration: 0.25,
      gain: 0.1,
    });
    tone(voice, {
      frequency: 1568,
      start: 0.12,
      duration: 0.35,
      gain: 0.1,
    });
  },
  error: (voice) => {
    tone(voice, { frequency: 220, to: 110, duration: 0.18, gain: 0.18 });
    noise(voice, {
      filter: "lowpass",
      frequency: 600,
      duration: 0.05,
      gain: 0.4,
    });
  },
  warning: (voice) => {
    tone(voice, {
      frequency: 880,
      type: "triangle",
      duration: 0.09,
      gain: 0.18,
    });
    tone(voice, {
      frequency: 880,
      type: "triangle",
      start: 0.14,
      duration: 0.12,
      gain: 0.18,
    });
  },
  info: (voice) => {
    tone(voice, { frequency: 784, duration: 0.12, gain: 0.14 });
    tone(voice, {
      frequency: 1175,
      start: 0.09,
      duration: 0.2,
      gain: 0.14,
    });
  },
  slider: (voice) => {
    tone(voice, { frequency: 1200, duration: 0.02, gain: 0.11 });
  },
};
