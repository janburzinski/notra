import type { UiSound } from "@/types/ui-sounds";

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

/** Requests closer together than this are one interaction. */
export const UI_SOUND_BATCH_MS = 24;
/** Popups only make a sound this soon after a click or key press. */
export const UI_SOUND_GESTURE_WINDOW_MS = 600;
export const UI_SOUND_SLIDER_INTERVAL_MS = 40;
/** A preview mutes the sounds its own click would make. */
export const UI_SOUND_PREVIEW_QUIET_MS = 200;
/** Click peaks land around -18 dBFS: present, not loud. */
export const UI_SOUND_GAIN = 0.58;
