"use client";

import { useEffect, useState } from "react";

const APPLE_PLATFORM_PATTERN = /Mac|iPhone|iPad|iPod/i;

export function useIsApplePlatform(): boolean {
  const [isApple, setIsApple] = useState(true);

  useEffect(() => {
    const platform = navigator.platform || navigator.userAgent;
    setIsApple(APPLE_PLATFORM_PATTERN.test(platform));
  }, []);

  return isApple;
}
