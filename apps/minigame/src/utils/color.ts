import { WHITE } from "@/constants/game";
import type { Rgb } from "@/types/game";

const BLACK: Rgb = [0, 0, 0];

export function rgbCss([r, g, b]: Rgb) {
  return `rgb(${r} ${g} ${b})`;
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** The colours behind ship art's `#`, `+` and `-`: the model's colour, lit and shaded, unless it has its own. */
export function artTones(rgb: Rgb, custom?: Record<string, Rgb>) {
  return (
    custom ?? {
      "#": rgb,
      "+": mix(rgb, WHITE, 0.4),
      "-": mix(rgb, BLACK, 0.35),
    }
  );
}
