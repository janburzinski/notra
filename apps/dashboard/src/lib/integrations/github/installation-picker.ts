"use client";

import { useSyncExternalStore } from "react";

import type {
  GitHubInstallationChoice,
  GitHubInstallationPickerRequest,
} from "@/types/integrations/github";

let request: GitHubInstallationPickerRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Asks the mounted picker which existing installation to link. Without a
 * mounted picker (outside the dashboard shell) it falls back to a new install.
 */
export function chooseGitHubInstallation(
  params: Omit<GitHubInstallationPickerRequest, "resolve">
): Promise<GitHubInstallationChoice> {
  if (listeners.size === 0) {
    return Promise.resolve("new");
  }
  return new Promise((resolve) => {
    request?.resolve(null);
    request = { ...params, resolve };
    emit();
  });
}

export function settleGitHubInstallationChoice(
  choice: GitHubInstallationChoice
) {
  request?.resolve(choice);
  request = null;
  emit();
}

export function useGitHubInstallationPickerRequest() {
  return useSyncExternalStore(
    subscribe,
    () => request,
    () => null
  );
}
