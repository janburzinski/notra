import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { fromBuffer } from "@capsizecss/unpack";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import type { SiteConfig } from "@notra/sites-core/types/site-config";

import type { FontFallback, FontRole } from "../../src/types/theme";
import {
  coversWeight,
  fontRoles,
  isSiteFontPath,
  metricsFace,
} from "../../src/utils/theme-fonts";
import {
  FONT_FALLBACK_LOCAL,
  FONT_FALLBACK_METRICS,
  GOOGLE_FONT_FACE_RE,
} from "../constants/fonts";
import type {
  FontMetrics,
  SiteFontFallbacksParams,
  SiteFontFallbacksResult,
} from "../types/fonts";

// Keyed by file contents so `notra dev` reads each font once per change.
const metricsCache = new Map<string, FontMetrics>();

async function fontMetrics(bytes: Buffer): Promise<FontMetrics> {
  const key = createHash("sha256").update(bytes).digest("hex");
  const cached = metricsCache.get(key);
  if (cached) {
    return cached;
  }
  const { ascent, descent, lineGap, unitsPerEm, xWidthAvg } =
    await fromBuffer(bytes);
  if (!(unitsPerEm > 0 && xWidthAvg > 0 && ascent > 0)) {
    throw new Error("The font file has no usable metrics");
  }
  const metrics = { ascent, descent, lineGap, unitsPerEm, xWidthAvg };
  metricsCache.set(key, metrics);
  return metrics;
}

function percent(value: number): number {
  return Math.round(value * 10_000) / 100;
}

/** Capsize's fallback math: scale Arial to the font's average width, then fix its vertical metrics. */
function fallbackFor(family: string, metrics: FontMetrics): FontFallback {
  const sizeAdjust =
    metrics.xWidthAvg /
    metrics.unitsPerEm /
    (FONT_FALLBACK_METRICS.xWidthAvg / FONT_FALLBACK_METRICS.unitsPerEm);
  const em = metrics.unitsPerEm * sizeAdjust;
  return {
    family,
    local: FONT_FALLBACK_LOCAL,
    sizeAdjust: percent(sizeAdjust),
    ascentOverride: percent(metrics.ascent / em),
    descentOverride: percent(Math.abs(metrics.descent) / em),
    lineGapOverride: percent(metrics.lineGap / em),
  };
}

/** The latin, upright file a downloaded Google stylesheet serves for a family and weight. */
function googleFontFile(
  css: string,
  family: string,
  weight: number
): string | undefined {
  const faces = [...css.matchAll(GOOGLE_FONT_FACE_RE)]
    .map(([, subset, body = ""]) => ({
      subset,
      family: /font-family:\s*['"]?([^;'"]+)/.exec(body)?.[1]?.trim(),
      style: /font-style:\s*(\w+)/.exec(body)?.[1] ?? "normal",
      weight: /font-weight:\s*([\d ]+)/.exec(body)?.[1],
      url: /url\(\s*["']?([^\s"')]+)/.exec(body)?.[1],
    }))
    .filter(
      (face) =>
        face.family?.toLowerCase() === family.toLowerCase() &&
        face.style === "normal" &&
        face.url
    );
  const matching = faces.filter((face) => coversWeight(face.weight, weight));
  const face =
    matching.find((item) => item.subset === "latin") ??
    matching[0] ??
    faces.find((item) => item.subset === "latin") ??
    faces[0];
  return face?.url;
}

async function roleFontFile(
  role: FontRole,
  params: SiteFontFallbacksParams
): Promise<string | undefined> {
  const face = metricsFace(role);
  if (face?.source) {
    if (!isSiteFontPath(face.source)) {
      return undefined;
    }
    const path = `/${face.source.replace(/[?#].*$/, "").replace(/^\/+/, "")}`;
    if (!params.publicFiles.has(path)) {
      throw new Error(`${face.source} is not a file in public/`);
    }
    return join(params.siteRoot, "public", path);
  }
  if (role.faces.some((item) => item.source) || !params.stylesheet) {
    return undefined;
  }
  const stylesheet = join(params.workDir, "site", "public", params.stylesheet);
  const file = googleFontFile(
    await readFile(stylesheet, "utf8"),
    role.family,
    role.weight
  );
  // The downloader rewrites every file to ./font-<hash>.<ext> beside the stylesheet.
  return file?.startsWith("./")
    ? join(dirname(stylesheet), file.slice(2))
    : undefined;
}

/**
 * Size a local fallback font to each body and heading font, so text keeps its
 * size and line breaks while the web font loads. Never fails the build.
 */
export async function siteFontFallbacks(
  config: SiteConfig,
  params: SiteFontFallbacksParams
): Promise<SiteFontFallbacksResult> {
  const result: SiteFontFallbacksResult = { fallbacks: [], diagnostics: [] };
  const families = new Set<string>();
  for (const role of fontRoles(config.fonts)) {
    if (families.has(role.family)) {
      continue;
    }
    families.add(role.family);
    try {
      const file = await roleFontFile(role, params);
      if (file) {
        result.fallbacks.push(
          fallbackFor(role.family, await fontMetrics(await readFile(file)))
        );
      }
    } catch (error) {
      result.diagnostics.push({
        severity: "warning",
        file: SITE_CONFIG_FILENAME,
        code: "font_fallback",
        message: `Could not measure ${role.family} for its fallback font, so text may shift when it loads. ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  return result;
}
