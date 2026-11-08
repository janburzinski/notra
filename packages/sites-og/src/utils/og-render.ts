import { Resvg } from "@resvg/resvg-js";
import { createElement, type ReactElement } from "react";
import satori from "satori";

import {
  OG_CUSTOM_FONT_NAME,
  OG_FONT_EXTENSIONS,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from "../constants/og-images";
import type { SatoriFont } from "../types/og-images";

export async function renderOgPng(
  card: ReactElement,
  fonts: SatoriFont[]
): Promise<Buffer> {
  const svg = await satori(card, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts,
  });
  return new Resvg(svg, {
    fitTo: { mode: "width", value: OG_IMAGE_WIDTH },
  })
    .render()
    .asPng();
}

/** Whether `thumbnails.font` names a file satori can read. */
export function isOgFontPath(path: string): boolean {
  const lower = path.toLowerCase().replace(/[?#].*$/, "");
  return OG_FONT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * `thumbnails.font` as a satori font, or null when satori can't draw with it.
 * One file serves every weight, so titles and labels share its weight.
 */
export async function loadOgCustomFont(
  data: Uint8Array
): Promise<SatoriFont | null> {
  const font: SatoriFont = {
    name: OG_CUSTOM_FONT_NAME,
    weight: 400,
    style: "normal",
    data: Buffer.from(data),
  };
  try {
    await satori(
      createElement(
        "div",
        { style: { display: "flex", fontFamily: OG_CUSTOM_FONT_NAME } },
        "Aa"
      ),
      { width: 40, height: 40, fonts: [font] }
    );
    return font;
  } catch {
    return null;
  }
}
