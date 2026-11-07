"use client";

import { useEffect, useRef } from "react";

/**
 * Adopts a value the browser put in the input before React hydrated, such as
 * a password manager's autofill or fast typing on a slow load. Without it the
 * field shows the text while form state stays empty, so submitting fails.
 */
export function usePrefilledInput(
  value: string,
  onChange: (value: string) => void
) {
  const ref = useRef<HTMLInputElement>(null);
  const initial = useRef({ value, onChange });

  useEffect(() => {
    const domValue = ref.current?.value;
    if (domValue && domValue !== initial.current.value) {
      initial.current.onChange(domValue);
    }
  }, []);

  return ref;
}
