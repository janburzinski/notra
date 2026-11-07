import type { ThemeOption } from "../types/sidebar-theme";

/** Blume's own key: its pre-paint script reads it, and no key means "follow the OS". */
export const THEME_STORAGE_KEY = "blume-theme";

export const THEME_OPTIONS: ThemeOption[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];
