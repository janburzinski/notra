"use client";

import { useSyncExternalStore } from "react";

import type { AutopilotOnboardingSession } from "@/types/autopilot-onboarding";

const fresh = (): AutopilotOnboardingSession => ({
  answers: null,
  thinking: false,
  pending: null,
  thought: new Set(),
  phase: "chat",
  tasks: [],
  asking: false,
  readingUp: false,
  settingUp: false,
  refreshed: Promise.resolve(),
});

/**
 * Ollie's chat per workspace, kept outside the page: an answer he's reading
 * or a setup that's running carries on while you look at another page, and
 * the chat picks it up when you come back.
 */
const sessions = new Map<string, AutopilotOnboardingSession>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readOnboardingSession(organizationId: string) {
  let session = sessions.get(organizationId);
  if (!session) {
    session = fresh();
    sessions.set(organizationId, session);
  }
  return session;
}

export function patchOnboardingSession(
  organizationId: string,
  patch:
    | Partial<AutopilotOnboardingSession>
    | ((
        current: AutopilotOnboardingSession
      ) => Partial<AutopilotOnboardingSession>)
) {
  const current = readOnboardingSession(organizationId);
  sessions.set(organizationId, {
    ...current,
    ...(typeof patch === "function" ? patch(current) : patch),
  });
  for (const listener of listeners) {
    listener();
  }
}

/** A finished or abandoned chat: the next one starts from the beginning. */
export function resetOnboardingSession(organizationId: string) {
  sessions.delete(organizationId);
  for (const listener of listeners) {
    listener();
  }
}

export function useAutopilotOnboardingSession(organizationId: string) {
  return useSyncExternalStore(
    subscribe,
    () => readOnboardingSession(organizationId),
    () => readOnboardingSession(organizationId)
  );
}
