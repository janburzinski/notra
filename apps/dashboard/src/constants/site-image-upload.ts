/** Benchmarked against PNG, mozjpeg and AVIF: ~1% of a gradient PNG, ~20% of a photo. */
export const SITE_BACKGROUND_WEBP_QUALITY = 82;

export const SITE_IMAGE_MAX_INPUT_PIXELS = 40_000_000;

/** Browser-side scale-down before upload; the server encodes the final file. */
export const SITE_IMAGE_PREUPLOAD_WEBP_QUALITY = 0.92;
