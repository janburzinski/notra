import type { Rgb } from "@/types/game";

/** The size X and most link previews show a large card at. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** A rank only moves when someone posts a score, so cards can sit in the CDN for a few minutes. */
export const CARD_CACHE_CONTROL =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=3600";

export const CARD_COLORS = {
  line: [59, 47, 102],
  ink: [244, 240, 255],
  ink2: [196, 184, 232],
  ink3: [142, 129, 184],
  violet: [167, 139, 250],
  gold: [253, 224, 71],
} as const satisfies Record<string, Rgb>;
