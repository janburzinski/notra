export type LandingPreview =
  | "badges"
  | "button"
  | "chat-minimap"
  | "composer"
  | "data-table"
  | "dropdown-menu"
  | "duotone-tooltip"
  | "icon-tabs"
  | "listicle-outreach"
  | "marketing-button"
  | "select"
  | "shimmer"
  | "sidebar"
  | "sonner"
  | "step-slider"
  | "tooltip"
  | "workflow-builder"
  | "workflow-node";

/** How many collage cells a tile covers: `lg` is 2×2, `wide` 2×1, `tall` 1×2. */
export type LandingTileSize = "sm" | "wide" | "tall" | "lg";

export interface LandingComponentTile {
  href: string;
  preview: LandingPreview;
  /** Shrinks a preview that is wider than its tile. */
  scale?: number;
  size: LandingTileSize;
  title: string;
}

/** The title card, placed in the collage like any other tile. */
export interface LandingIntroTile {
  preview: "intro";
  size: LandingTileSize;
}

export type LandingTile = LandingComponentTile | LandingIntroTile;

export interface LandingInstallCommand {
  items: string[];
  prefix: string;
}

export interface LandingIntro {
  description: string;
  install: LandingInstallCommand;
}
