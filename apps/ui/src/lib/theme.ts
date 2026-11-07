import { THEME_STORAGE_KEY } from "../constants/sidebar-theme";
import type { ThemeChoice } from "../types/sidebar-theme";

export const isThemeChoice = (value: string): value is ThemeChoice =>
  value === "system" || value === "light" || value === "dark";

export const readThemeChoice = (): ThemeChoice => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
};

/** Re-renders when the theme changes here, in the header toggle, or via the D hotkey. */
export const subscribeThemeChoice = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributeFilter: ["data-theme"],
  });
  window.addEventListener("storage", onChange);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onChange);
  };
};

/** Stores the choice where Blume's pre-paint script reads it and applies it. */
export const applyThemeChoice = (choice: ThemeChoice) => {
  const root = document.documentElement;
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const systemTheme = prefersDark ? "dark" : "light";
  const theme = choice === "system" ? systemTheme : choice;
  try {
    if (choice === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, choice);
    }
  } catch {
    // Blocked storage still switches the theme for this page.
  }
  // Same swap as Blume's header toggle: no transitions while colors flip.
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.append(style);
  root.dataset.theme = theme;
  // Reading a computed style forces the new colors to apply before the
  // transition block is removed.
  void window.getComputedStyle(root).opacity;
  setTimeout(() => style.remove(), 1);
};
