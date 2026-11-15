"use client";

import { useEffect, useState } from "react";

/**
 * Counts how often the page came back from the background. Browsers throttle
 * or pause animation frames in hidden tabs, so animations started there can
 * stop mid-way; keying a subtree by this number remounts it in a clean state.
 */
export function useVisibilityEpoch(): number {
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setEpoch((current) => current + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return epoch;
}
