import { renderElementToImages } from "@notra/ai/utils/repo-image-render";
import { db } from "@notra/db/drizzle";
import {
  brandGuidelineAssets,
  brandGuidelineColors,
  brandGuidelines,
} from "@notra/db/schema";
import { asc, eq } from "drizzle-orm";

import {
  AUTOPILOT_HERO_IMAGE_BACKGROUND,
  AUTOPILOT_HERO_IMAGE_FALLBACK_ACCENT,
  AUTOPILOT_HERO_LOGO_MAX_BYTES,
  AUTOPILOT_HERO_LOGO_TIMEOUT_MS,
} from "@/constants/autopilot";

const PROTOCOL = /^https?:\/\//;
const TRAILING_SLASH = /\/$/;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const ACCENT_NAME = /accent|primary|brand/i;
const NEUTRAL_COLORS = new Set(["#fff", "#ffffff", "#000", "#000000"]);
const LOGO_MIME: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** The brand's accent color and logo from its guidelines, when it has them. */
async function loadBrandVisuals(brandSettingsId: string | null) {
  if (!brandSettingsId) {
    return { accent: AUTOPILOT_HERO_IMAGE_FALLBACK_ACCENT, logo: null };
  }
  const guideline = await db.query.brandGuidelines.findFirst({
    columns: { id: true },
    where: eq(brandGuidelines.brandSettingsId, brandSettingsId),
  });
  if (!guideline) {
    return { accent: AUTOPILOT_HERO_IMAGE_FALLBACK_ACCENT, logo: null };
  }
  const [colors, assets] = await Promise.all([
    db
      .select({
        name: brandGuidelineColors.name,
        value: brandGuidelineColors.lightValue,
        usage: brandGuidelineColors.usage,
      })
      .from(brandGuidelineColors)
      .where(eq(brandGuidelineColors.guidelineId, guideline.id))
      .orderBy(asc(brandGuidelineColors.sortOrder)),
    db
      .select({
        url: brandGuidelineAssets.url,
        format: brandGuidelineAssets.format,
      })
      .from(brandGuidelineAssets)
      .where(eq(brandGuidelineAssets.guidelineId, guideline.id))
      .orderBy(asc(brandGuidelineAssets.sortOrder)),
  ]);
  const usable = colors.filter(
    (color) =>
      HEX_COLOR.test(color.value) &&
      !NEUTRAL_COLORS.has(color.value.toLowerCase())
  );
  const accent =
    usable.find((color) => ACCENT_NAME.test(`${color.name} ${color.usage}`))
      ?.value ??
    usable[0]?.value ??
    AUTOPILOT_HERO_IMAGE_FALLBACK_ACCENT;
  const asset = assets.find((row) => row.format && LOGO_MIME[row.format]);
  return { accent, logo: asset ? await fetchLogo(asset) : null };
}

/** Embeds the logo as a data URI; a slow or large logo is simply left out. */
async function fetchLogo(asset: { url: string; format: string | null }) {
  try {
    const response = await fetch(asset.url, {
      signal: AbortSignal.timeout(AUTOPILOT_HERO_LOGO_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > AUTOPILOT_HERO_LOGO_MAX_BYTES) {
      return null;
    }
    const mime = LOGO_MIME[asset.format ?? ""] ?? "image/png";
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Renders the 1200x630 hero/OG image for a post: brand, title and site on the
 * brand's accent. A fixed template, so it costs no tokens and always works.
 * Returns the PNG as base64.
 */
export async function renderPostHeroImage(params: {
  title: string;
  brandName: string;
  websiteUrl: string | null;
  brandSettingsId: string | null;
}) {
  const { accent, logo } = await loadBrandVisuals(params.brandSettingsId);
  const title = params.title.trim();
  const domain = params.websiteUrl
    ? params.websiteUrl.replace(PROTOCOL, "").replace(TRAILING_SLASH, "")
    : "";
  const { pngBase64 } = await renderElementToImages(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        backgroundColor: AUTOPILOT_HERO_IMAGE_BACKGROUND,
        backgroundImage: `radial-gradient(circle at 88% 12%, ${accent}66 0%, ${AUTOPILOT_HERO_IMAGE_BACKGROUND} 60%)`,
        color: "#ffffff",
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {logo ? (
          <img
            alt=""
            height={48}
            src={logo}
            style={{ width: 48, height: 48, objectFit: "contain" }}
            width={48}
          />
        ) : null}
        <span style={{ fontSize: 30, fontWeight: 700 }}>
          {params.brandName}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: title.length > 70 ? 52 : 64,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: -1.5,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 24,
          color: "#a1a1aa",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 44,
            height: 6,
            borderRadius: 3,
            backgroundColor: accent,
          }}
        />
        <span>{domain}</span>
      </div>
    </div>
  );
  return pngBase64;
}
