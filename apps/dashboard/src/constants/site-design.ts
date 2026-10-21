export const SITE_APPEARANCE_MODES = ["system", "light", "dark"] as const;

export const SITE_BACKGROUND_DECORATIONS = [
  "none",
  "grid",
  "dots",
  "gradient",
] as const;

export const SITE_CODE_THEME_MODES = ["system", "dark", "custom"] as const;

export const SITE_TYPOGRAPHY_MODES = ["single", "pair"] as const;

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
