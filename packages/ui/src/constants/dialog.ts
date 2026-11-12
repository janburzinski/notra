/**
 * Enter and exit for dialog surfaces, as interruptible Base UI transitions:
 * 200ms in, 150ms out on a strong ease-out. The popup also scales from 0.96;
 * reduced motion keeps only the fade.
 */
export const DIALOG_POPUP_MOTION_CLASS_NAME =
  "transition-[opacity,scale] duration-200 ease-out data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-[0.96] motion-safe:data-starting-style:scale-[0.96]";

export const DIALOG_BACKDROP_MOTION_CLASS_NAME =
  "transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:opacity-0";
