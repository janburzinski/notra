import type { UiSoundSynthTable, UiSoundVoice } from "@/types/ui-sounds";

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

export const UI_SOUND_SYNTHS: UiSoundSynthTable = {
  click: {
    tap: {
      click: (voice) => {
        noise(voice, {
          filter: "bandpass",
          frequency: 3200,
          q: 1.5,
          duration: 0.018,
          gain: 0.9,
        });
        tone(voice, { frequency: 1600, to: 1100, duration: 0.03, gain: 0.08 });
      },
    },
    tick: {
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
    },
    pop: {
      click: (voice) => {
        tone(voice, {
          frequency: 520,
          to: 260,
          glide: 0.05,
          duration: 0.06,
          gain: 0.22,
        });
      },
    },
    knock: {
      click: (voice) => {
        tone(voice, {
          frequency: 760,
          to: 600,
          type: "triangle",
          duration: 0.045,
          gain: 0.22,
        });
        noise(voice, {
          filter: "bandpass",
          frequency: 1400,
          q: 4,
          duration: 0.03,
          gain: 0.9,
        });
      },
    },
  },
  toggle: {
    latch: {
      toggleOn: (voice) => {
        tone(voice, { frequency: 1500, duration: 0.022, gain: 0.16 });
        tone(voice, {
          frequency: 2100,
          start: 0.035,
          duration: 0.028,
          gain: 0.18,
        });
      },
      toggleOff: (voice) => {
        tone(voice, { frequency: 2100, duration: 0.022, gain: 0.16 });
        tone(voice, {
          frequency: 1400,
          start: 0.035,
          duration: 0.028,
          gain: 0.18,
        });
      },
    },
    snap: {
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
    },
    bubble: {
      toggleOn: (voice) => {
        tone(voice, {
          frequency: 380,
          to: 900,
          glide: 0.07,
          attack: 0.008,
          duration: 0.09,
          gain: 0.19,
        });
      },
      toggleOff: (voice) => {
        tone(voice, {
          frequency: 820,
          to: 360,
          glide: 0.07,
          attack: 0.008,
          duration: 0.09,
          gain: 0.18,
        });
      },
    },
    clack: {
      toggleOn: (voice) => {
        noise(voice, {
          filter: "bandpass",
          frequency: 2600,
          q: 3,
          duration: 0.022,
          gain: 1,
        });
        tone(voice, {
          frequency: 220,
          type: "square",
          duration: 0.025,
          gain: 0.05,
          lowpass: 1500,
        });
      },
      toggleOff: (voice) => {
        noise(voice, {
          filter: "bandpass",
          frequency: 1700,
          q: 3,
          duration: 0.022,
          gain: 1,
        });
        tone(voice, {
          frequency: 160,
          type: "square",
          duration: 0.025,
          gain: 0.05,
          lowpass: 1500,
        });
      },
    },
  },
  select: {
    blip: {
      select: (voice) => {
        tone(voice, { frequency: 1320, duration: 0.05, gain: 0.18 });
      },
    },
    chime: {
      select: (voice) => {
        tone(voice, { frequency: 1568, duration: 0.16, gain: 0.12 });
        tone(voice, { frequency: 2349, duration: 0.12, gain: 0.06 });
      },
    },
    pluck: {
      select: (voice) => {
        tone(voice, {
          frequency: 880,
          type: "triangle",
          attack: 0.002,
          duration: 0.1,
          gain: 0.24,
        });
        tone(voice, { frequency: 1760, duration: 0.05, gain: 0.05 });
      },
    },
    drop: {
      select: (voice) => {
        tone(voice, {
          frequency: 1250,
          to: 650,
          glide: 0.04,
          duration: 0.06,
          gain: 0.22,
        });
      },
    },
  },
  popup: {
    whoosh: {
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
    },
    slide: {
      open: (voice) => {
        tone(voice, {
          frequency: 480,
          to: 760,
          attack: 0.01,
          duration: 0.09,
          gain: 0.18,
        });
      },
      close: (voice) => {
        tone(voice, {
          frequency: 740,
          to: 460,
          attack: 0.005,
          duration: 0.08,
          gain: 0.16,
        });
      },
    },
    glass: {
      open: (voice) => {
        tone(voice, { frequency: 1047, duration: 0.12, gain: 0.1 });
        tone(voice, {
          frequency: 1568,
          start: 0.045,
          duration: 0.16,
          gain: 0.1,
        });
      },
      close: (voice) => {
        tone(voice, { frequency: 1568, duration: 0.1, gain: 0.09 });
        tone(voice, {
          frequency: 1047,
          start: 0.04,
          duration: 0.14,
          gain: 0.09,
        });
      },
    },
    air: {
      open: (voice) => {
        noise(voice, {
          filter: "lowpass",
          frequency: 1200,
          to: 4000,
          attack: 0.03,
          duration: 0.1,
          gain: 0.4,
        });
      },
      close: (voice) => {
        noise(voice, {
          filter: "lowpass",
          frequency: 3500,
          to: 900,
          attack: 0.015,
          duration: 0.09,
          gain: 0.3,
        });
      },
    },
  },
  copy: {
    ding: {
      copy: (voice) => {
        tone(voice, { frequency: 1760, duration: 0.22, gain: 0.15 });
        tone(voice, { frequency: 3520, duration: 0.08, gain: 0.035 });
      },
    },
    double: {
      copy: (voice) => {
        tone(voice, { frequency: 2400, duration: 0.022, gain: 0.17 });
        tone(voice, {
          frequency: 2400,
          start: 0.07,
          duration: 0.022,
          gain: 0.17,
        });
      },
    },
    sparkle: {
      copy: (voice) => {
        tone(voice, { frequency: 2093, duration: 0.06, gain: 0.1 });
        tone(voice, {
          frequency: 2637,
          start: 0.035,
          duration: 0.06,
          gain: 0.1,
        });
        tone(voice, {
          frequency: 3136,
          start: 0.07,
          duration: 0.08,
          gain: 0.1,
        });
      },
    },
    snip: {
      copy: (voice) => {
        noise(voice, {
          filter: "highpass",
          frequency: 5000,
          duration: 0.014,
          gain: 0.28,
        });
        noise(voice, {
          filter: "highpass",
          frequency: 6000,
          start: 0.05,
          duration: 0.014,
          gain: 0.25,
        });
      },
    },
  },
  send: {
    swoosh: {
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
    },
    rise: {
      send: (voice) => {
        tone(voice, {
          frequency: 440,
          to: 880,
          attack: 0.01,
          duration: 0.12,
          gain: 0.18,
        });
      },
    },
    hop: {
      send: (voice) => {
        tone(voice, { frequency: 660, duration: 0.06, gain: 0.15 });
        tone(voice, {
          frequency: 990,
          start: 0.055,
          duration: 0.09,
          gain: 0.16,
        });
      },
    },
    flick: {
      send: (voice) => {
        noise(voice, {
          filter: "bandpass",
          frequency: 2200,
          q: 2,
          duration: 0.03,
          gain: 0.7,
        });
        tone(voice, { frequency: 900, to: 1800, duration: 0.07, gain: 0.09 });
      },
    },
  },
  destructive: {
    thud: {
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
    },
    crunch: {
      destructive: (voice) => {
        noise(voice, {
          filter: "bandpass",
          frequency: 900,
          q: 1.4,
          attack: 0.002,
          duration: 0.12,
          gain: 0.7,
        });
        tone(voice, {
          frequency: 110,
          type: "square",
          duration: 0.08,
          gain: 0.05,
          lowpass: 1200,
        });
      },
    },
    descend: {
      destructive: (voice) => {
        tone(voice, {
          frequency: 659,
          type: "triangle",
          duration: 0.1,
          gain: 0.2,
        });
        tone(voice, {
          frequency: 440,
          type: "triangle",
          start: 0.09,
          duration: 0.16,
          gain: 0.2,
        });
      },
    },
    rustle: {
      destructive: (voice) => {
        noise(voice, {
          filter: "lowpass",
          frequency: 1600,
          to: 600,
          attack: 0.02,
          duration: 0.2,
          gain: 0.45,
        });
      },
    },
  },
  success: {
    chime: {
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
    },
    bright: {
      success: (voice) => {
        tone(voice, { frequency: 880, duration: 0.12, gain: 0.14 });
        tone(voice, {
          frequency: 1109,
          start: 0.08,
          duration: 0.25,
          gain: 0.14,
        });
      },
    },
    bell: {
      success: (voice) => {
        tone(voice, { frequency: 1319, duration: 0.5, gain: 0.14 });
        tone(voice, { frequency: 2638, duration: 0.3, gain: 0.035 });
        tone(voice, { frequency: 3640, duration: 0.2, gain: 0.03 });
      },
    },
    soft: {
      success: (voice) => {
        tone(voice, {
          frequency: 660,
          type: "triangle",
          attack: 0.01,
          duration: 0.18,
          gain: 0.18,
        });
        tone(voice, {
          frequency: 990,
          type: "triangle",
          start: 0.1,
          attack: 0.01,
          duration: 0.28,
          gain: 0.18,
        });
      },
    },
  },
  error: {
    buzz: {
      error: (voice) => {
        tone(voice, {
          frequency: 140,
          type: "sawtooth",
          attack: 0.005,
          duration: 0.2,
          gain: 0.12,
          lowpass: 900,
        });
        tone(voice, {
          frequency: 147,
          type: "sawtooth",
          attack: 0.005,
          duration: 0.2,
          gain: 0.12,
          lowpass: 900,
        });
      },
    },
    double: {
      error: (voice) => {
        tone(voice, {
          frequency: 330,
          type: "triangle",
          duration: 0.1,
          gain: 0.24,
        });
        tone(voice, {
          frequency: 330,
          type: "triangle",
          start: 0.13,
          duration: 0.14,
          gain: 0.24,
        });
      },
    },
    thunk: {
      error: (voice) => {
        tone(voice, { frequency: 220, to: 110, duration: 0.18, gain: 0.18 });
        noise(voice, {
          filter: "lowpass",
          frequency: 600,
          duration: 0.05,
          gain: 0.4,
        });
      },
    },
    minor: {
      error: (voice) => {
        tone(voice, {
          frequency: 622,
          type: "triangle",
          duration: 0.12,
          gain: 0.2,
        });
        tone(voice, {
          frequency: 523,
          type: "triangle",
          start: 0.1,
          duration: 0.22,
          gain: 0.2,
        });
      },
    },
  },
  warning: {
    alert: {
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
    },
    hum: {
      warning: (voice) => {
        tone(voice, {
          frequency: 440,
          attack: 0.01,
          duration: 0.25,
          gain: 0.13,
        });
        tone(voice, {
          frequency: 466,
          attack: 0.01,
          duration: 0.25,
          gain: 0.13,
        });
      },
    },
    tritone: {
      warning: (voice) => {
        tone(voice, {
          frequency: 740,
          type: "triangle",
          duration: 0.12,
          gain: 0.18,
        });
        tone(voice, {
          frequency: 523,
          type: "triangle",
          start: 0.11,
          duration: 0.2,
          gain: 0.18,
        });
      },
    },
    pulse: {
      warning: (voice) => {
        for (const start of [0, 0.08, 0.16]) {
          tone(voice, { frequency: 660, start, duration: 0.05, gain: 0.16 });
        }
      },
    },
  },
  info: {
    note: {
      info: (voice) => {
        tone(voice, { frequency: 988, duration: 0.2, gain: 0.15 });
      },
    },
    ping: {
      info: (voice) => {
        tone(voice, { frequency: 1568, duration: 0.3, gain: 0.12 });
        tone(voice, { frequency: 3136, duration: 0.1, gain: 0.03 });
      },
    },
    duo: {
      info: (voice) => {
        tone(voice, { frequency: 784, duration: 0.12, gain: 0.14 });
        tone(voice, {
          frequency: 1175,
          start: 0.09,
          duration: 0.2,
          gain: 0.14,
        });
      },
    },
    marimba: {
      info: (voice) => {
        tone(voice, {
          frequency: 523,
          attack: 0.002,
          duration: 0.25,
          gain: 0.15,
        });
        tone(voice, {
          frequency: 2093,
          attack: 0.002,
          duration: 0.04,
          gain: 0.07,
        });
      },
    },
  },
  slider: {
    tick: {
      slider: (voice) => {
        tone(voice, {
          frequency: 3000,
          attack: 0.001,
          duration: 0.009,
          gain: 0.12,
        });
      },
    },
    click: {
      slider: (voice) => {
        noise(voice, {
          filter: "bandpass",
          frequency: 2000,
          q: 2,
          duration: 0.009,
          gain: 0.6,
        });
      },
    },
    pitch: {
      slider: (voice) => {
        tone(voice, {
          frequency: 300 + voice.value * 900,
          duration: 0.03,
          gain: 0.13,
        });
      },
    },
    soft: {
      slider: (voice) => {
        tone(voice, { frequency: 1200, duration: 0.02, gain: 0.11 });
      },
    },
  },
};
