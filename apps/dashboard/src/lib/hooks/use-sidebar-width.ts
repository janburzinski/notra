"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_EVENT,
} from "@/constants/nav";
import { localStorageKeys } from "@/constants/storage";
import type { UseSidebarWidthResult } from "@/types/components/sidebar-resize-handle";

function getStoredSidebarWidth() {
  try {
    const storedWidth = Number(
      window.localStorage.getItem(localStorageKeys.sidebarWidth)
    );
    return Number.isFinite(storedWidth) &&
      storedWidth >= SIDEBAR_MIN_WIDTH &&
      storedWidth <= SIDEBAR_MAX_WIDTH
      ? storedWidth
      : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

function getServerSidebarWidth() {
  return SIDEBAR_DEFAULT_WIDTH;
}

function subscribeToSidebarWidth(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SIDEBAR_WIDTH_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SIDEBAR_WIDTH_EVENT, onChange);
  };
}

export function useSidebarWidth(): UseSidebarWidthResult {
  const storedWidth = useSyncExternalStore(
    subscribeToSidebarWidth,
    getStoredSidebarWidth,
    getServerSidebarWidth
  );
  const [pendingWidth, setPendingWidth] = useState<number | null>(null);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const sidebarWidth = pendingWidth ?? storedWidth;

  const startSidebarResize = useCallback(() => {
    setSidebarResizing(true);
  }, []);

  const finishSidebarResize = useCallback((width: number) => {
    let persisted = false;
    try {
      window.localStorage.setItem(localStorageKeys.sidebarWidth, String(width));
      persisted = true;
    } catch {
      // Resizing still works for the current session without persistence.
    }
    if (persisted) {
      window.dispatchEvent(new Event(SIDEBAR_WIDTH_EVENT));
      setPendingWidth(null);
    } else {
      setPendingWidth(width);
    }
    setSidebarResizing(false);
  }, []);

  return {
    finishSidebarResize,
    setSidebarWidth: setPendingWidth,
    sidebarResizing,
    sidebarWidth,
    startSidebarResize,
  };
}
