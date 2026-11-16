import { useEffect, useState } from "react";

/** Counts up every `intervalMs` while `enabled`; callers wrap it with `%`. */
export function useCycleIndex(enabled: boolean, intervalMs: number): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIndex((current) => current + 1);
      }
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [enabled, intervalMs]);

  return index;
}
