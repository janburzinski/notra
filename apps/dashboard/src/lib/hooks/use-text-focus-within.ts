"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

function isTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement
  );
}

/**
 * Whether you're writing inside the element: it turns on when a text field
 * inside takes focus, not a button such as "+", and stays on while focus
 * moves to the buttons beside it or a press inside lasts, so nothing shrinks
 * under the pointer before the click lands.
 */
export function useTextFocusWithin(
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
      if (!element.contains(document.activeElement)) {
        setFocusWithin(false);
      }
    };
    const press = () => {
      pressedRef.current = true;
      window.addEventListener("pointerup", settle, { once: true });
      window.addEventListener("pointercancel", settle, { once: true });
    };
    const focus = (event: FocusEvent) => {
      if (isTextField(event.target)) {
        setFocusWithin(true);
      }
    };
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
