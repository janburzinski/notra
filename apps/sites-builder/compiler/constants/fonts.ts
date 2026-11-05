// Arial's metrics (as in Capsize and Astro's fonts API): the local font the
// fallback faces resize so text keeps its size and breaks until fonts load.
export const FONT_FALLBACK_LOCAL = "Arial";
export const FONT_FALLBACK_METRICS = {
  ascent: 1854,
  descent: -434,
  lineGap: 67,
  unitsPerEm: 2048,
  xWidthAvg: 913,
} as const;
export const GOOGLE_FONT_FACE_RE =
  /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g;
