import type { ViewerResponse } from "@/types/leaderboard";
import type { MenuTab } from "@/types/session";

export const GAME_TITLE = "Notra Dogfight";
export const GAME_DESCRIPTION =
  "Pick an AI model, shoot down the others and climb the leaderboard. A pixel-art arcade shooter by Notra.";
export const SITE_URL = "https://play.usenotra.com";
/** The game's own link preview, a static image designed in Paper (`public/og.png`). */
export const GAME_CARD_URL = `${SITE_URL}/og.png`;
export const NOTRA_URL = "https://www.usenotra.com";
export const PRIVACY_URL = "https://www.usenotra.com/privacy";

export const STORAGE_KEYS = {
  model: "dogfight:model",
  muted: "dogfight:muted",
  pending: "dogfight:pending-run",
  best: "dogfight:local-best",
} as const;

export const AUTH_MESSAGES: Record<string, string> = {
  denied: "X sign-in was cancelled.",
  failed: "X sign-in didn't work. Try again.",
  unavailable: "X sign-in isn't set up here yet.",
};

export const MENU_TABS: readonly { value: MenuTab; label: string }[] = [
  { value: "play", label: "Play" },
  { value: "leaderboard", label: "Leaderboard" },
];

/** Shown when a request never reached the server. */
export const OFFLINE_MESSAGE = "Can't reach the server. Check your connection.";

/** How long a notice stays at the top of the screen. */
export const NOTICE_MS = 5000;

/** The controls line under Launch; it only wraps between controls. */
export const MENU_CONTROLS = [
  "Point the mouse to fly",
  "click to shoot",
  "shift boost",
  "space dodge",
  "E strike",
] as const;

/** The viewer after signing out or deleting their scores. */
export const SIGNED_OUT: ViewerResponse = {
  player: null,
  standing: { all: null, week: null },
  admin: false,
};
