import { describe, expect, test } from "bun:test";

import type { SavedOgTemplate } from "@notra/ai/types/og-image";
import { fallbackOgTemplate } from "@notra/ai/utils/og-fallback";
import { findInvisibleOgLogos, renderOgImage } from "@notra/ai/utils/og-render";
import { loadRenderFont } from "@notra/ai/utils/render-font";
import sharp from "sharp";

async function inkSpan(pngBase64: string, top: number, bottom: number) {
  const { data, info } = await sharp(Buffer.from(pngBase64, "base64"))
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width;
  let right = -1;
  for (let y = top; y < bottom; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      if ((data[offset] ?? 255) < 128) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
  }
  return { left, right };
}

async function centeredCard() {
  const document: SavedOgTemplate = {
    version: 1,
    assets: {},
    warnings: [],
    fontBase64: Buffer.from(await loadRenderFont("Inter")).toString("base64"),
    template: {
      background: "#FFFFFF",
      font: { family: "Inter", weight: 400, url: null },
      title: {
        x: 80,
        y: 160,
        width: 1040,
        height: 300,
        color: "#000000",
        size: 64,
        minSize: 28,
        lineHeight: 1.1,
        letterSpacing: 0,
        align: "center",
      },
      layers: [
        {
          kind: "text",
          x: 300,
          y: 540,
          width: 600,
          height: 40,
          text: "{{domain}}",
          color: "#000000",
          size: 24,
          align: "center",
        },
      ],
    },
  };
  return renderOgImage(document, "Short centered title", {
    name: "Example",
    websiteUrl: "https://example.com",
  });
}

describe("findInvisibleOgLogos", () => {
  test("flags only the logo without ink, even over a busy background", async () => {
    const triangle = async (fill: string) =>
      `data:image/png;base64,${(
        await sharp(
          Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="52"><path fill="${fill}" d="M30 0 60 52H0z"/></svg>`
          )
        )
          .png()
          .toBuffer()
      ).toString("base64")}`;
    const document = {
      version: 1 as const,
      warnings: [],
      fontBase64: Buffer.from(await loadRenderFont("Inter")).toString("base64"),
      assets: {
        dark: await triangle("#000000"),
        light: await triangle("#ffffff"),
        blue: await triangle("#0000ff"),
      },
      template: {
        background: "#000000",
        font: { family: "Inter", weight: 400 as const, url: null },
        title: {
          x: 64,
          y: 200,
          width: 1072,
          height: 300,
          color: "#ffffff",
          size: 64,
          minSize: 28,
          lineHeight: 1.1,
          letterSpacing: 0,
          align: "left" as const,
        },
        layers: [
          // Saturated detail in the logo box, beside the shape, is not its ink.
          {
            kind: "rect" as const,
            x: 64,
            y: 60,
            width: 16,
            height: 12,
            color: "#0000ff",
            radius: 0,
            opacity: 1,
          },
          ...["dark", "light", "blue"].map((assetId, index) => ({
            kind: "image" as const,
            assetId,
            x: 64 + index * 120,
            y: 60,
            width: 60,
            height: 52,
            color: null,
            opacity: 1,
            fit: "contain" as const,
            crop: null,
          })),
        ],
      },
    };
    const brand = { name: "Example", websiteUrl: "https://example.com" };
    const { pngBase64 } = await renderOgImage(document, "Title", brand);
    expect(
      await findInvisibleOgLogos(document, "Title", brand, pngBase64)
    ).toEqual([1]);
  });
});

describe("renderOgImage alignment", () => {
  test("centers the title and labels on their rectangles", async () => {
    const { pngBase64 } = await centeredCard();
    const title = await inkSpan(pngBase64, 160, 460);
    const label = await inkSpan(pngBase64, 540, 580);
    expect(Math.abs((title.left + title.right) / 2 - 600)).toBeLessThan(6);
    expect(Math.abs((label.left + label.right) / 2 - 600)).toBeLessThan(6);
  });
});

describe("renderOgImage short titles", () => {
  // Satori's balance + break-word looped forever on these before the fix.
  test.each(["T", "Hi", "W", "I A"])("renders %p", async (title) => {
    const brand = {
      id: "",
      name: "Acme",
      websiteUrl: "https://acme.dev",
      guideline: null,
      assets: [],
    };
    const { lineCount } = await renderOgImage(
      await fallbackOgTemplate(brand),
      title,
      brand
    );
    expect(lineCount).toBe(1);
  });
});
