"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "use-intl";

import { DASHBOARD_BANNER } from "@/constants/dashboard-banner";
import { localStorageKeys } from "@/constants/storage";
import type { DashboardBannerProps } from "@/types/components/dashboard-banner";

const dismissListeners = new Set<() => void>();
const dismissedInMemory = new Set<string>();

function subscribeToDismissal(callback: () => void) {
  dismissListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    dismissListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function isDismissed(key: string) {
  if (dismissedInMemory.has(key)) {
    return true;
  }
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function markDismissed(key: string) {
  try {
    localStorage.setItem(key, "true");
  } catch {
    dismissedInMemory.add(key);
  }
  for (const listener of dismissListeners) {
    listener();
  }
}

export function useDashboardBanner(): DashboardBannerProps | null {
  const t = useTranslations("common.labels");
  const banner = DASHBOARD_BANNER;
  const key = banner
    ? localStorageKeys.dashboardBannerDismissed(banner.id)
    : "";
  const dismissed = useSyncExternalStore(
    subscribeToDismissal,
    () => !key || isDismissed(key),
    () => true
  );

  if (!banner || dismissed) {
    return null;
  }

  return {
    action: banner.action,
    message: banner.message,
    ...(banner.dismissible === false
      ? {}
      : {
          dismissLabel: t("dismiss"),
          onDismiss: () => markDismissed(key),
        }),
  };
}
