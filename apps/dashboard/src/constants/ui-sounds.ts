import type { UiSound, UiSoundSettings } from "@/types/ui-sounds";

/** Order here is the order of the rows in settings. */
export const UI_SOUND_VARIANTS = {
  click: ["tap", "tick", "pop", "knock"],
  toggle: ["latch", "snap", "bubble", "clack"],
  select: ["blip", "chime", "pluck", "drop"],
  popup: ["whoosh", "slide", "glass", "air"],
  copy: ["ding", "double", "sparkle", "snip"],
  send: ["swoosh", "rise", "hop", "flick"],
  destructive: ["thud", "crunch", "descend", "rustle"],
  success: ["chime", "bright", "bell", "soft"],
  error: ["buzz", "double", "thunk", "minor"],
  warning: ["alert", "hum", "tritone", "pulse"],
  info: ["note", "ping", "duo", "marimba"],
  slider: ["tick", "click", "pitch", "soft"],
} as const;

export const UI_SOUND_CATEGORY_SOUNDS = {
  click: ["click"],
  toggle: ["toggleOn", "toggleOff"],
  select: ["select"],
  popup: ["open", "close"],
  copy: ["copy"],
  send: ["send"],
  destructive: ["destructive"],
  success: ["success"],
  error: ["error"],
  warning: ["warning"],
  info: ["info"],
  slider: ["slider"],
} as const;

export const UI_SOUND_CATEGORIES = Object.keys(
  UI_SOUND_VARIANTS
) as (keyof typeof UI_SOUND_VARIANTS)[];

/**
 * One interaction can ask for several sounds at once (a menu item that is
 * picked and closes its menu). Only the highest one plays.
 */
export const UI_SOUND_PRIORITY: Record<UiSound, number> = {
  error: 100,
  warning: 95,
  copy: 92,
  success: 90,
  info: 85,
  destructive: 70,
  send: 65,
  open: 50,
  toggleOn: 45,
  toggleOff: 45,
  select: 40,
  close: 30,
  slider: 20,
  click: 10,
};

export const DEFAULT_UI_SOUND_SETTINGS: UiSoundSettings = {
  enabled: false,
  volume: 60,
  variants: {
    click: "tick",
    toggle: "snap",
    select: "blip",
    popup: "whoosh",
    copy: "ding",
    send: "swoosh",
    destructive: "thud",
    success: "chime",
    error: "thunk",
    warning: "alert",
    info: "duo",
    slider: "soft",
  },
};

/** Requests closer together than this are one interaction. */
export const UI_SOUND_BATCH_MS = 24;
/** Popups only make a sound this soon after a click or key press. */
export const UI_SOUND_GESTURE_WINDOW_MS = 600;
export const UI_SOUND_SLIDER_INTERVAL_MS = 40;
/** A preview mutes the sounds its own click would make. */
export const UI_SOUND_PREVIEW_QUIET_MS = 200;
/** Gap between the two halves of a paired preview (on → off). */
export const UI_SOUND_PAIR_GAP_S = 0.32;
