"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * Whether focus is anywhere inside the element, kept true while a press
 * inside lasts: shrinking under the pointer would move a button before the
 * click lands.
 */
export function useFocusWithin(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean
) {
  const [focusWithin, setFocusWithin] = useState(false);
  const pressedRef = useRef(false);
  useEffect(() => {
    const element = ref.current;
    if (!(enabled && element)) {
      return;
    }
    const settle = () => {
      pressedRef.current = false;
      setFocusWithin(element.contains(document.activeElement));
    };
    const press = () => {
      pressedRef.current = true;
      window.addEventListener("pointerup", settle, { once: true });
      window.addEventListener("pointercancel", settle, { once: true });
    };
    const focus = () => setFocusWithin(true);
    const blur = (event: FocusEvent) => {
      if (
        !(
          pressedRef.current ||
          (event.relatedTarget instanceof Node &&
            element.contains(event.relatedTarget))
        )
      ) {
        setFocusWithin(false);
      }
    };
    element.addEventListener("pointerdown", press);
    element.addEventListener("focusin", focus);
    element.addEventListener("focusout", blur);
    return () => {
      element.removeEventListener("pointerdown", press);
      element.removeEventListener("focusin", focus);
      element.removeEventListener("focusout", blur);
      window.removeEventListener("pointerup", settle);
      window.removeEventListener("pointercancel", settle);
    };
  }, [enabled, ref]);
  return focusWithin;
}
