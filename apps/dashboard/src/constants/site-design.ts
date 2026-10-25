import type {
  SiteBackgroundDecoration,
  SiteMiniPageProps,
} from "@/types/site-design";

export const SITE_APPEARANCE_MODES = ["system", "light", "dark"] as const;

export const SITE_BACKGROUND_DECORATIONS = [
  "none",
  "grid",
  "dots",
  "gradient",
] as const;

export const SITE_CODE_THEME_MODES = ["system", "dark", "custom"] as const;

export const SITE_TYPOGRAPHY_MODES = ["single", "pair"] as const;

export const SITE_BANNER_TYPES = ["info", "warning", "critical"] as const;

/** Hex approximations of the sites-builder banner presets, for swatches. */
export const SITE_BANNER_PRESET_COLORS = {
  warning: { light: "#9A5505", dark: "#864900" },
  critical: { light: "#C51E21", dark: "#AC1A1C" },
} as const;

export const SITE_FONT_FORMATS = ["woff2", "woff"] as const;

/** Select value for a family that isn't in the preset list. */
export const SITE_CUSTOM_FONT = "__custom";
export const SITE_DEFAULT_FONT = "__default";

export const SITE_FONT_WEIGHTS = [
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
] as const;

/** Google Fonts families offered as presets; any other family is custom. */
export const SITE_FONT_SUGGESTIONS = [
  "Inter",
  "Geist",
  "DM Sans",
  "Manrope",
  "Plus Jakarta Sans",
  "Figtree",
  "Onest",
  "Outfit",
  "Space Grotesk",
  "IBM Plex Sans",
  "Source Sans 3",
  "Work Sans",
  "Public Sans",
  "Lato",
  "Roboto",
  "Open Sans",
  "Poppins",
  "Nunito",
  "Montserrat",
  "Fraunces",
  "Newsreader",
  "Instrument Serif",
  "Lora",
  "Merriweather",
  "Playfair Display",
  "Source Serif 4",
  "EB Garamond",
  "Libre Baskerville",
  "Crimson Pro",
  "JetBrains Mono",
  "IBM Plex Mono",
  "Space Mono",
];

export const SITE_CODE_THEMES = [
  "github-light",
  "github-dark",
  "github-light-default",
  "github-dark-default",
  "min-light",
  "min-dark",
  "one-light",
  "one-dark-pro",
  "vitesse-light",
  "vitesse-dark",
  "catppuccin-latte",
  "catppuccin-mocha",
  "rose-pine-dawn",
  "rose-pine",
  "solarized-light",
  "solarized-dark",
  "material-theme-lighter",
  "material-theme-darker",
  "night-owl",
  "nord",
  "dracula",
  "tokyo-night",
  "poimandres",
] as const;

export const SITE_DEFAULT_CODE_LIGHT_THEME = "github-light";
export const SITE_DEFAULT_CODE_DARK_THEME = "github-dark";

export const SITE_DESIGN_PREVIEW_LIGHT_FOREGROUND = "#09090B";
export const SITE_DESIGN_PREVIEW_DARK_FOREGROUND = "#FAFAFA";

export const SITE_DESIGN_PREVIEW_DECORATION_CLASS_NAMES: Record<
  SiteBackgroundDecoration,
  string
> = {
  none: "",
  grid: "bg-[linear-gradient(to_right,color-mix(in_oklab,var(--mini-fg)_9%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--mini-fg)_9%,transparent)_1px,transparent_1px)] bg-size-[10px_10px]",
  dots: "bg-[radial-gradient(color-mix(in_oklab,var(--mini-fg)_22%,transparent)_0.75px,transparent_0.75px)] bg-size-[6px_6px]",
  gradient:
    "bg-[radial-gradient(120%_70%_at_50%_-10%,color-mix(in_oklab,var(--mini-accent)_32%,transparent),transparent_70%)] bg-no-repeat",
};

export const SITE_DESIGN_PREVIEW_NEUTRAL_CODE_CLASS_NAMES: Record<
  NonNullable<SiteMiniPageProps["code"]>,
  string
> = {
  light: "bg-black/20",
  dark: "bg-white/30",
  accent: "bg-[color-mix(in_oklab,var(--mini-fg)_25%,transparent)]",
};
