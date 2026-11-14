import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join } from "node:path";

import { parseEntryFrontmatter } from "@notra/sites-compiler/frontmatter";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import {
  OG_BACKGROUND_MIME_TYPES,
  OG_FONT_FILES,
} from "@notra/sites-og/constants/og-images";
import type { OgAuthor, SatoriFont } from "@notra/sites-og/types/og-images";
import {
  ogAreaCard,
  ogDomain,
  ogEntryCard,
  ogLogoPath,
  ogStyle,
} from "@notra/sites-og/utils/og-card";
import {
  isOgFontPath,
  loadOgCustomFont,
  renderOgPng,
} from "@notra/sites-og/utils/og-render";
import type { ReactElement } from "react";

import { AREA_DEFAULT_TITLES } from "../src/constants/areas";
import { OG_MANIFEST_FILE } from "../src/constants/og";
import { configuredAreaTitle } from "../src/utils/area-titles";
import { isShareableImage } from "../src/utils/images";
import { OG_IMAGES_DIR } from "./constants/og-images";
import type {
  FrontmatterAuthor,
  OgBackgroundResult,
  OgFontResult,
  OgImagesResult,
  OgManifest,
  WriteOgImagesParams,
} from "./types/og-images";
import { writeFileEnsured } from "./utils/fs";

let fontsPromise: Promise<SatoriFont[]> | null = null;

function loadFonts(): Promise<SatoriFont[]> {
  fontsPromise ??= (async () => {
    const require = createRequire(import.meta.url);
    return Promise.all(
      OG_FONT_FILES.map(async ({ name, weight, file }) => ({
        name,
        weight,
        style: "normal" as const,
        data: await readFile(
          require.resolve(`@fontsource/inter/files/${file}`)
        ),
      }))
    );
  })();
  return fontsPromise;
}

function publicPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

async function loadBackground(
  params: WriteOgImagesParams
): Promise<OgBackgroundResult> {
  const path = params.config.thumbnails.background;
  if (!path) {
    return {};
  }
  const normalized = publicPath(path);
  const mimeType = OG_BACKGROUND_MIME_TYPES[extname(normalized).toLowerCase()];
  if (!(mimeType && params.publicFiles.includes(normalized))) {
    return {
      diagnostic: {
        severity: "warning",
        file: SITE_CONFIG_FILENAME,
        code: "thumbnail_background",
        message: `thumbnails.background: ${path} is not a PNG, JPEG or SVG file in public/. Share images are generated without it.`,
      },
    };
  }
  const bytes = await readFile(
    join(params.workDir, "site", "public", normalized)
  );
  return { dataUri: `data:${mimeType};base64,${bytes.toString("base64")}` };
}

async function publicImage(
  params: WriteOgImagesParams,
  path: string | undefined
): Promise<string | undefined> {
  if (!path || /^https?:\/\//.test(path)) {
    return undefined;
  }
  const normalized = publicPath(path);
  const mimeType = OG_BACKGROUND_MIME_TYPES[extname(normalized).toLowerCase()];
  if (!(mimeType && params.publicFiles.includes(normalized))) {
    return undefined;
  }
  const bytes = await readFile(
    join(params.workDir, "site", "public", normalized)
  );
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function resolveAuthor(
  params: WriteOgImagesParams,
  ref: FrontmatterAuthor
): Promise<OgAuthor | undefined> {
  const id = typeof ref === "string" ? ref : ref.id;
  const configured =
    id && Object.hasOwn(params.config.authors, id)
      ? params.config.authors[id]
      : undefined;
  const inline = typeof ref === "string" ? undefined : ref;
  const name =
    configured?.name ??
    inline?.name ??
    (typeof ref === "string" ? ref : undefined);
  if (!name) {
    return undefined;
  }
  return {
    name,
    title: configured?.title ?? inline?.title,
    avatar: await publicImage(params, configured?.avatar ?? inline?.avatar),
  };
}

async function resolveAuthors(
  params: WriteOgImagesParams,
  value: FrontmatterAuthor | FrontmatterAuthor[] | undefined
): Promise<OgAuthor[]> {
  const refs = value === undefined ? [] : [value].flat();
  const authors = await Promise.all(
    refs.map((ref) => resolveAuthor(params, ref))
  );
  return authors.filter((author) => author !== undefined);
}

/** `thumbnails.font` from public/, or a warning when it can't be used. */
async function loadCustomFont(
  params: WriteOgImagesParams
): Promise<OgFontResult> {
  const path = params.config.thumbnails.font;
  if (!path) {
    return {};
  }
  const normalized = publicPath(path);
  const warning = (reason: string): OgFontResult => ({
    diagnostic: {
      severity: "warning",
      file: SITE_CONFIG_FILENAME,
      code: "thumbnail_font",
      message: `thumbnails.font: ${path} ${reason}. Share images use Inter instead.`,
    },
  });
  if (!(isOgFontPath(normalized) && params.publicFiles.includes(normalized))) {
    return warning("is not a TTF, OTF or WOFF file in public/");
  }
  const font = await loadOgCustomFont(
    await readFile(join(params.workDir, "site", "public", normalized))
  );
  return font ? { font } : warning("couldn't be read as a font");
}

async function writeCard(
  params: WriteOgImagesParams,
  card: ReactElement,
  fonts: SatoriFont[],
  urlPath: string
): Promise<void> {
  await writeFileEnsured(
    join(params.workDir, "site", "public", urlPath),
    await renderOgPng(card, fonts)
  );
}

export async function writeOgImages(
  params: WriteOgImagesParams
): Promise<OgImagesResult> {
  const started = Date.now();
  const manifest: OgManifest = {};
  const diagnostics: SiteDiagnostic[] = [];
  const { config } = params;
  if (config.thumbnails.enabled) {
    const [inter, background, custom, logo] = await Promise.all([
      loadFonts(),
      loadBackground(params),
      loadCustomFont(params),
      publicImage(params, ogLogoPath(config)),
    ]);
    for (const diagnostic of [background.diagnostic, custom.diagnostic]) {
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }
    const fonts = custom.font ? [custom.font, ...inter] : inter;
    const style = ogStyle(config, {
      logo,
      background: background.dataUri,
      domain: ogDomain(params.publicOrigin),
      customFont: Boolean(custom.font),
    });
    const now = new Date();
    // A raster seo.image replaces the generated section cards; posts keep
    // their own. An SVG one can't be shared, so the cards are still made.
    const ownSiteImage = config.seo.image && isShareableImage(config.seo.image);
    const areas = ownSiteImage ? [] : params.areas;
    await Promise.all(
      areas.map(async (area) => {
        const urlPath = `/${OG_IMAGES_DIR}/${area}.png`;
        const card = ogAreaCard({
          config,
          title: configuredAreaTitle(config, area),
          section: AREA_DEFAULT_TITLES[area],
          description: config[area]?.description ?? config.description,
          style,
        });
        await writeCard(params, card, fonts, urlPath);
        manifest[area] = urlPath;
      })
    );
    await Promise.all(
      params.entries.map(async (entry) => {
        const source = await readFile(
          join(
            params.workDir,
            "entries",
            entry.area,
            `${entry.slug}.${entry.format}`
          ),
          "utf8"
        );
        const { data } = parseEntryFrontmatter(entry.path, entry.area, source);
        // Pages with an SVG cover still get a PNG card to share.
        const ownImage = data?.image && isShareableImage(data.image);
        if (!data || ownImage || (data.draft && !params.includeDrafts)) {
          return;
        }
        const card = ogEntryCard({
          config,
          areaTitle: configuredAreaTitle(config, entry.area),
          entry: {
            title: data.title,
            description: data.description,
            date: data.date,
            version: "version" in data ? data.version : undefined,
            tags: data.tags,
            authors:
              config.thumbnails.layout !== "default" && "author" in data
                ? await resolveAuthors(params, data.author)
                : [],
          },
          style,
          now,
        });
        const urlPath = `/${OG_IMAGES_DIR}/${entry.area}/${entry.slug}.png`;
        await writeCard(params, card, fonts, urlPath);
        manifest[`${entry.area}/${entry.slug}`] = urlPath;
      })
    );
  }
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))
  );
  await writeFileEnsured(
    join(params.workDir, OG_MANIFEST_FILE),
    `${JSON.stringify(sorted, null, 2)}\n`
  );
  return { manifest: sorted, diagnostics, durationMs: Date.now() - started };
}
