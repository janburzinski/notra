import {
  Download04Icon,
  GridViewIcon,
  PuzzleIcon,
  Upload04Icon,
} from "@hugeicons/core-free-icons";

export const INTEGRATION_TAB_VALUES = [
  "all",
  "input",
  "output",
  "extension",
] as const;

export const INTEGRATION_CATEGORY_TABS = [
  { value: "all", icon: GridViewIcon },
  { value: "input", icon: Download04Icon },
  { value: "output", icon: Upload04Icon },
  { value: "extension", icon: PuzzleIcon },
] as const;

export const INTEGRATION_CARD_DITHER_HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;
export const INTEGRATION_CARD_DITHER_FADE_OUT_DURATION = 300;

export const INTEGRATIONS_WITH_CONNECT_DIALOG = new Set<string>([
  "github",
  "linear",
  "granola",
  "slack",
  "google-search-console",
]);
