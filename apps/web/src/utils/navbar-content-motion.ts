import {
  NAVBAR_CONTENT_EXIT_TRANSITION,
  NAVBAR_CONTENT_SHIFT,
} from "@/constants/navbar-motion";
import type {
  NavbarContentMotion,
  NavbarContentMotionInput,
} from "@/types/navbar";

const INSTANT = { duration: 0 } as const;

/**
 * Where one group's panel goes when the hovered group changes. Every panel
 * stays mounted, so this replaces mounting the new one and unmounting the old.
 */
export function getNavbarContentMotion({
  label,
  activeGroup,
  previousGroup,
  direction,
  contentTransition,
}: NavbarContentMotionInput): NavbarContentMotion {
  // While the dropdown closes, the last group stays visible as it fades out.
  const shown = label === (activeGroup ?? previousGroup);
  const sliding = direction !== 0 && activeGroup !== null;

  if (shown && sliding) {
    return {
      animate: { x: [direction * NAVBAR_CONTENT_SHIFT, 0], opacity: [0, 1] },
      transition: contentTransition,
      visible: true,
    };
  }
  if (shown) {
    return {
      animate: { x: 0, opacity: 1 },
      transition: INSTANT,
      visible: true,
    };
  }
  if (sliding && label === previousGroup) {
    return {
      animate: { x: direction * -NAVBAR_CONTENT_SHIFT, opacity: 0 },
      transition: NAVBAR_CONTENT_EXIT_TRANSITION,
      visible: true,
    };
  }
  return { animate: { x: 0, opacity: 0 }, transition: INSTANT, visible: false };
}
