import { OG_HEX_COLOR, OG_NAMED_PAINTS } from "@notra/ai/constants/og-image";

/** Comparable six-digit hex for the paint forms logos actually ship with. */
function normalizePaint(value: string) {
  const paint = value.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(paint);
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  }
  return OG_NAMED_PAINTS[paint] ?? paint;
}

/** Recolor only explicitly painted, single-color SVGs, never masks or multicolor artwork. */
export function recolorOgSvg(svg: string, color?: string | null) {
  if (
    !color ||
    !OG_HEX_COLOR.test(color) ||
    /<(?:mask|linearGradient|radialGradient|pattern)\b/i.test(svg)
  ) {
    return svg;
  }
  // Clip paths only define geometry; their fill (often white) is never painted.
  const painted = svg.replace(/<clipPath\b[\s\S]*?<\/clipPath>/gi, "");
  const shapes =
    painted.match(
      /<(?:path|rect|circle|ellipse|polygon|polyline|line)\b[^>]*>/gi
    ) ?? [];
  if (
    !shapes.length ||
    shapes.some((shape) => !/\bfill="[^"]+"/i.test(shape))
  ) {
    return svg;
  }
  const paints = new Set(
    [...painted.matchAll(/\b(?:fill|stroke)="([^"]+)"/gi)]
      .map((match) => normalizePaint(match[1] ?? ""))
      .filter(
        (paint) =>
          paint && !["none", "transparent", "currentcolor"].includes(paint)
      )
  );
  const paint = [...paints][0];
  if (paints.size !== 1 || !paint || !OG_HEX_COLOR.test(paint)) {
    return svg;
  }
  return svg.replace(
    /\b(fill|stroke)="([^"]+)"/gi,
    (match, attribute: string, value: string) =>
      normalizePaint(value) === paint ? `${attribute}="${color}"` : match
  );
}
