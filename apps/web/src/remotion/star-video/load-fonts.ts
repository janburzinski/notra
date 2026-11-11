import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

import { TABULAR_FONT_NAME, TABULAR_FONT_WEIGHT } from "./constants";

const FONT_WEIGHTS = ["400", "600", "700", "800"] as const;

let started = false;

export function ensureStarVideoFonts(): void {
  if (started || typeof FontFace === "undefined") {
    return;
  }
  started = true;

  for (const weight of FONT_WEIGHTS) {
    loadFont({
      family: "Inter",
      url: staticFile(`fonts/inter-${weight}.woff2`),
      weight,
      format: "woff2",
    });
  }

  loadFont({
    family: TABULAR_FONT_NAME,
    url: staticFile(`fonts/inter-${TABULAR_FONT_WEIGHT}.woff2`),
    weight: TABULAR_FONT_WEIGHT,
    format: "woff2",
    featureSettings: '"tnum"',
  });
}
