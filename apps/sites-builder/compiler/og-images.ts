import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join } from "node:path";

import { parseEntryFrontmatter } from "@notra/sites-compiler/frontmatter";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import { Resvg } from "@resvg/resvg-js";
import type { ReactElement } from "react";
import satori from "satori";

import { OG_MANIFEST_FILE } from "../src/constants/og";
import { configuredAreaTitle, withSiteName } from "../src/utils/area-titles";
import { OgAuthorCard } from "./components/og-author-card";
import { OgCard } from "./components/og-card";
import {
  OG_BACKGROUND_MIME_TYPES,
  OG_FONT_SUBSETS,
  OG_FONT_WEIGHTS,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_IMAGES_DIR,
} from "./constants/og-images";
import type {
  OgAuthor,
  OgBackgroundResult,
  OgImagesResult,
  OgManifest,
  SatoriFont,
  WriteOgImagesParams,
} from "./types/og-images";
import { writeFileEnsured } from "./utils/fs";

let fontsPromise: Promise<SatoriFont[]> | null = null;

function loadFonts(): Promise<SatoriFont[]> {
  fontsPromise ??= (async () => {
    const require = createRequire(import.meta.url);
    const specs = OG_FONT_SUBSETS.flatMap((subset) =>
      OG_FONT_WEIGHTS.map((weight) => ({ subset, weight }))
    );
    return Promise.all(
      specs.map(async ({ subset, weight }) => ({
        name: `Inter ${subset}`,
        weight,
        style: "normal" as const,
        data: await readFile(
          require.resolve(
            `@fontsource/inter/files/inter-${subset}-${weight}-normal.woff`
          )
        ),
      }))
    );
  })();
  return fontsPromise;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

async function loadBackground(
  params: WriteOgImagesParams
): Promise<OgBackgroundResult> {
  const path = params.config.thumbnails.background;
  if (!path) {
    return {};
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
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
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const mimeType = OG_BACKGROUND_MIME_TYPES[extname(normalized).toLowerCase()];
  if (!(mimeType && params.publicFiles.includes(normalized))) {
    return undefined;
  }
  const bytes = await readFile(
    join(params.workDir, "site", "public", normalized)
  );
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

type FrontmatterAuthor =
  | string
  | { id?: string; name: string; title?: string; avatar?: string };

async function firstAuthor(
  params: WriteOgImagesParams,
  value: FrontmatterAuthor | FrontmatterAuthor[] | undefined
): Promise<OgAuthor | undefined> {
  const ref = Array.isArray(value) ? value[0] : value;
  if (!ref) {
    return undefined;
  }
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

function authorWithFallback(
  author: OgAuthor | undefined,
  logo: string | undefined
): OgAuthor | undefined {
  return author && !author.avatar && logo
    ? { ...author, avatar: logo }
    : author;
}

function siteLogo(config: WriteOgImagesParams["config"]): string | undefined {
  const { logo, favicon } = config;
  const path = typeof logo === "string" ? logo : logo?.light;
  return path ?? (typeof favicon === "string" ? favicon : favicon?.light);
}

async function renderPng(
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

export async function writeOgImages(
  params: WriteOgImagesParams
): Promise<OgImagesResult> {
  const started = Date.now();
  const manifest: OgManifest = {};
  const diagnostics: SiteDiagnostic[] = [];
  const { config } = params;
  if (config.thumbnails.enabled && params.entries.length > 0) {
    const [fonts, background] = await Promise.all([
      loadFonts(),
      loadBackground(params),
    ]);
    if (background.diagnostic) {
      diagnostics.push(background.diagnostic);
    }
    const appearance = config.thumbnails.appearance;
    const logo = await publicImage(params, siteLogo(config));
    const accent =
      appearance === "dark"
        ? (config.colors.light ?? config.colors.primary)
        : config.colors.primary;
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
        if (!data || data.image || (data.draft && !params.includeDrafts)) {
          return;
        }
        const version = "version" in data ? data.version : undefined;
        const card =
          config.thumbnails.layout === "author"
            ? OgAuthorCard({
                label:
                  config.thumbnails.label ??
                  configuredAreaTitle(config, entry.area),
                title: data.title,
                domain: new URL(params.publicOrigin).hostname.replace(
                  /^www\./,
                  ""
                ),
                appearance,
                logo,
                author: await authorWithFallback(
                  "author" in data
                    ? await firstAuthor(params, data.author)
                    : undefined,
                  logo
                ),
                background: background.dataUri,
              })
            : OgCard({
                eyebrow: withSiteName(
                  config.name,
                  configuredAreaTitle(config, entry.area),
                  " · "
                ),
                title: data.title,
                footer: [version, formatDate(data.date)]
                  .filter(Boolean)
                  .join(" · "),
                appearance,
                accent,
                background: background.dataUri,
              });
        const png = await renderPng(card, fonts);
        const urlPath = `/${OG_IMAGES_DIR}/${entry.area}/${entry.slug}.png`;
        await writeFileEnsured(
          join(params.workDir, "site", "public", urlPath),
          png
        );
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
