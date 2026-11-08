export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export const OG_FONT_SUBSETS = [
  "latin",
  "latin-ext",
  "cyrillic",
  "greek",
] as const;
export const OG_FONT_WEIGHTS = [400, 500, 600, 700] as const;

/** Inter files of `@fontsource/inter`, one per subset and weight. */
export const OG_FONT_FILES = OG_FONT_SUBSETS.flatMap((subset) =>
  OG_FONT_WEIGHTS.map((weight) => ({
    name: `Inter ${subset}`,
    weight,
    file: `inter-${subset}-${weight}-normal.woff`,
  }))
);

export const OG_FONT_FAMILY = OG_FONT_SUBSETS.map(
  (subset) => `"Inter ${subset}"`
).join(", ");

/** Name `thumbnails.font` is loaded under; Inter still draws the glyphs it lacks. */
export const OG_CUSTOM_FONT_NAME = "Thumbnail";

export const OG_BACKGROUND_MIME_TYPES: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

/** Font files satori reads; it can't decompress WOFF2. */
export const OG_FONT_EXTENSIONS = [".ttf", ".otf", ".woff"] as const;

export const OG_THEME = {
  light: { background: "#ffffff", text: "#0a0a0a", muted: "#6b7280" },
  dark: { background: "#0a0a0a", text: "#fafafa", muted: "#a1a1aa" },
} as const;

export const OG_TITLE_SIZES = [
  { maxLength: 40, size: 72 },
  { maxLength: 70, size: 60 },
  { maxLength: Number.POSITIVE_INFINITY, size: 50 },
] as const;

export const OG_ARTICLE_AVATAR_SIZE = 50;
export const OG_ARTICLE_MAX_AVATARS = 4;

export const OG_AUTHOR_AVATAR_SIZE = 64;
export const OG_AUTHOR_LOGO_SIZE = 56;

/** Dates on cards are in UTC, so a post shows the same day everywhere. */
export const OG_SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
export const OG_SHORT_DATE_WITH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
export const OG_LONG_DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
