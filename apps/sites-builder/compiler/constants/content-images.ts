/** Elements with this class hold post and changelog bodies; only their images are optimized. */
export const CONTENT_ROOT_CLASS = "mdx-content";

/** Raster formats that get resized copies. GIFs and SVGs are served as they are. */
export const CONTENT_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

/** Widths of the WebP copies; only those narrower than the original are made. */
export const CONTENT_IMAGE_WIDTHS = [640, 960, 1280, 1920, 2560] as const;

/**
 * Encoder settings, chosen so copies look like the original. Lossless sources
 * (screenshots, UI, diagrams) stay near-lossless so text and edges stay crisp;
 * already-lossy photos get a high quality with sharp chroma.
 */
export const CONTENT_IMAGE_WEBP = {
  lossless: { nearLossless: true, quality: 60 },
  lossy: { quality: 90, smartSubsample: true },
} as const;

export const CONTENT_IMAGE_LOSSLESS_FORMATS = new Set(["png"]);

/** Colour spaces whose ICC profile can travel with RGB WebP data; others are converted to sRGB. */
export const CONTENT_IMAGE_RGB_SPACES = new Set([
  "srgb",
  "rgb",
  "rgb16",
  "scrgb",
]);

/** Generated copies live with the hashed build assets, which are served as immutable. */
export const CONTENT_IMAGES_DIR = "_notra/assets/images";

/** Bumped when encoding settings change, so new settings never reuse old file names. */
export const CONTENT_IMAGE_SETTINGS_VERSION = "2";

/** Longest a single resize may take before the image keeps the copies made so far. */
export const CONTENT_IMAGE_ENCODE_TIMEOUT_SECONDS = 30;

/** Keeps very image-heavy sites inside the build timeout; the rest keep their originals. */
export const CONTENT_IMAGE_BUDGET = {
  maxImages: 500,
  maxDurationMs: 120_000,
  concurrency: 4,
} as const;
