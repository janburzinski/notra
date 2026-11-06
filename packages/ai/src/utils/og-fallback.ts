import {
  OG_FALLBACK_LOGO_TIMEOUT_MS,
  OG_HEX_COLOR,
} from "@notra/ai/constants/og-image";
import { ogFallbackGuidelineSchema } from "@notra/ai/schemas/og-image";
import type {
  OgBrandContext,
  OgLayerBox,
  SavedOgTemplate,
} from "@notra/ai/types/og-image";
import {
  fitOgLogoBox,
  loadOgAsset,
  trimOgLogo,
} from "@notra/ai/utils/og-asset";
import { loadRenderFont } from "@notra/ai/utils/render-font";
import sharp from "sharp";

type Guideline = ReturnType<typeof ogFallbackGuidelineSchema.parse>;

/** Scales the logo into the header, left-aligned and vertically centered. */
function headerBox(width: number, height: number, maxWidth: number) {
  const scale = Math.min(maxWidth / width, 56 / height);
  const box: OgLayerBox = {
    x: 64,
    y: Math.round(54 + (56 - height * scale) / 2),
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
  return fitOgLogoBox(box, width, height);
}

/** The light-background logo, preferring the symbol as the Sites starter does. */
async function loadHeaderLogo(guideline: Guideline) {
  const kind = guideline.assets.some((asset) => asset.kind === "logo")
    ? "logo"
    : "wordmark";
  const candidates = guideline.assets.filter((asset) => asset.kind === kind);
  const asset =
    candidates.find((candidate) => candidate.variant === "light") ??
    candidates[0];
  if (!asset) {
    return null;
  }
  try {
    const data = await trimOgLogo(
      await loadOgAsset(
        asset.url,
        null,
        null,
        undefined,
        AbortSignal.timeout(OG_FALLBACK_LOGO_TIMEOUT_MS)
      )
    );
    const { width, height } = await sharp(
      Buffer.from(data.split(",")[1] ?? "", "base64")
    ).metadata();
    if (!(width && height)) {
      return null;
    }
    const wordmark = kind === "wordmark";
    return {
      data,
      wordmark,
      box: headerBox(width, height, wordmark ? 360 : 56),
    };
  } catch {
    return null;
  }
}

/**
 * Plain typography, plus the brand's saved primary color and logo when it has
 * them: missing evidence must not invent a brand aesthetic.
 */
export async function fallbackOgTemplate(
  brand: OgBrandContext
): Promise<SavedOgTemplate> {
  const parsed = ogFallbackGuidelineSchema.safeParse(brand.guideline);
  const guideline = parsed.success ? parsed.data : { colors: [], assets: [] };
  const accent = ["primary", "accent"]
    .map(
      (role) =>
        guideline.colors.find(
          (color) => color.role === role && OG_HEX_COLOR.test(color.lightValue)
        )?.lightValue
    )
    .find(Boolean);
  const [font, logo] = await Promise.all([
    loadRenderFont("Inter"),
    loadHeaderLogo(guideline),
  ]);
  const nameX = logo ? logo.box.x + logo.box.width + 20 : 64;
  return {
    version: 1,
    assets: logo ? { logo: logo.data } : {},
    warnings: [
      "Brand template unavailable; using a plain typography fallback.",
    ],
    fontBase64: Buffer.from(font).toString("base64"),
    template: {
      background: "#FFFFFF",
      font: { family: "Inter", weight: 400, url: null },
      title: {
        x: 64,
        y: 170,
        width: 1072,
        height: 330,
        color: "#1E1E1E",
        size: 64,
        minSize: 28,
        lineHeight: 1.12,
        letterSpacing: -1.2,
        align: "left",
      },
      layers: [
        ...(accent
          ? [
              {
                kind: "rect" as const,
                x: 0,
                y: 0,
                width: 1200,
                height: 12,
                color: accent,
                radius: 0,
                opacity: 1,
              },
            ]
          : []),
        ...(logo
          ? [
              {
                kind: "image" as const,
                decorative: false,
                color: null,
                ...logo.box,
                assetId: "logo",
                opacity: 1,
                fit: "contain" as const,
                crop: null,
              },
            ]
          : []),
        ...(logo?.wordmark
          ? []
          : [
              {
                kind: "text" as const,
                x: nameX,
                // Centered on the logo; 30px is the text box for 24px type.
                y: logo
                  ? logo.box.y + Math.round((logo.box.height - 30) / 2)
                  : 54,
                width: 1136 - nameX,
                height: logo ? 30 : 60,
                text: brand.name.slice(0, 80),
                color: "#1E1E1E",
                size: 24,
                align: "left" as const,
              },
            ]),
        {
          kind: "text",
          x: 64,
          y: 530,
          width: 1072,
          height: 68,
          text: "{{domain}}",
          color: "#666666",
          size: 16,
          align: "left",
        },
      ],
    },
  };
}
