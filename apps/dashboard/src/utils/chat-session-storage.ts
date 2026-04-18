"use client";

const LAST_ACTIVE_CHAT_KEY_PREFIX = "chat:last-active:";
const INTENTIONAL_NEW_CHAT_FLAG_PREFIX = "chat:intentional-new:";

function buildLastActiveChatKey(organizationSlug: string) {
  return `${LAST_ACTIVE_CHAT_KEY_PREFIX}${organizationSlug}`;
}

function buildIntentionalNewChatFlagKey(organizationSlug: string) {
  return `${INTENTIONAL_NEW_CHAT_FLAG_PREFIX}${organizationSlug}`;
}

function isBrowser() {
  return typeof window !== "undefined";
}

export function readLastActiveChatId(organizationSlug: string): string | null {
  if (!isBrowser()) {
    return null;
  }

  const value = window.localStorage.getItem(
    buildLastActiveChatKey(organizationSlug)
  );

  return value && value.length > 0 ? value : null;
}

export function writeLastActiveChatId(
  organizationSlug: string,
  chatId: string
) {
  if (!isBrowser()) {
    return;
  }

  const key = buildLastActiveChatKey(organizationSlug);
  if (window.localStorage.getItem(key) === chatId) {
    return;
  }
  window.localStorage.setItem(key, chatId);
}

export function clearLastActiveChatId(
  organizationSlug: string,
  chatId?: string | null
) {
  if (!isBrowser()) {
    return;
  }

  const key = buildLastActiveChatKey(organizationSlug);
  if (!chatId || window.localStorage.getItem(key) === chatId) {
    window.localStorage.removeItem(key);
  }
}

export function markIntentionalNewChat(organizationSlug: string) {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(
    buildIntentionalNewChatFlagKey(organizationSlug),
    "1"
  );
}

export function consumeIntentionalNewChat(organizationSlug: string) {
  if (!isBrowser()) {
    return false;
  }

  const key = buildIntentionalNewChatFlagKey(organizationSlug);
  const hasFlag = window.sessionStorage.getItem(key) === "1";

  if (hasFlag) {
    window.sessionStorage.removeItem(key);
  }

  return hasFlag;
}
