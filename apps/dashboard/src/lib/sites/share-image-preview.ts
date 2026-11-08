import "@tanstack/react-start/server-only";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import type { SiteArea } from "@notra/sites-core/types/deployment";
import type { SiteConfig } from "@notra/sites-core/types/site-config";
import { siteImageMimeType } from "@notra/sites-core/utils/image-drafts";
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
import { readShareImageAsset } from "@notra/sites-server/editor";
import { SiteInputError } from "@notra/sites-server/errors/sites";
import type { Site } from "@notra/sites-server/types/sites";

import {
  SITE_AREA_DEFAULT_TITLES,
  SITE_SHARE_PREVIEW_AUTHOR,
  SITE_SHARE_PREVIEW_POST,
} from "@/constants/site-share-image";
import type {
  SiteSharePreview,
  SiteSharePreviewInput,
  SiteSharePreviewWarning,
} from "@/types/site-share-image";

let interPromise: Promise<SatoriFont[]> | null = null;

function loadInter(): Promise<SatoriFont[]> {
  interPromise ??= import("@/constants/site-share-image-fonts").then(
    ({ SITE_SHARE_IMAGE_FONT_DATA }) =>
      OG_FONT_FILES.map(({ name, weight, file }) => ({
        name,
        weight,
        style: "normal" as const,
        data: Buffer.from(
          (SITE_SHARE_IMAGE_FONT_DATA[file] ?? "").split(",")[1] ?? "",
          "base64"
        ),
      }))
  );
  return interPromise;
}

function parseConfig(content: string): SiteConfig | null {
  try {
    const result = siteConfigSchema.safeParse(JSON.parse(content));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Reads a blog.json path the way the build does: only local files in public/. */
async function readAsset(
  site: Site,
  branch: string | undefined,
  path: string | undefined
): Promise<Buffer | null> {
  if (!path || /^https?:\/\//.test(path)) {
    return null;
  }
  return await readShareImageAsset(
    site,
    `public/${path.replace(/^\/+/, "")}`,
    branch
  ).catch((error: unknown) => {
    // A bad path is a setting mistake; anything else is a failed read to retry.
    if (error instanceof SiteInputError) {
      return null;
    }
    throw error;
  });
}

/** A local PNG, JPEG or SVG as a data URL, like the build embeds it. */
async function readImage(
  site: Site,
  branch: string | undefined,
  path: string | undefined
): Promise<string | undefined> {
  const extension = path?.slice(path.lastIndexOf(".")).toLowerCase() ?? "";
  const mimeType = OG_BACKGROUND_MIME_TYPES[extension];
  const bytes = mimeType ? await readAsset(site, branch, path) : null;
  return bytes
    ? `data:${mimeType};base64,${bytes.toString("base64")}`
    : undefined;
}

async function readCustomFont(
  site: Site,
  branch: string | undefined,
  path: string
): Promise<SatoriFont | null> {
  const bytes = isOgFontPath(path) ? await readAsset(site, branch, path) : null;
  return bytes ? await loadOgCustomFont(bytes) : null;
}

async function previewAuthor(
  site: Site,
  branch: string | undefined,
  config: SiteConfig
): Promise<OgAuthor> {
  const author = Object.values(config.authors)[0];
  if (!author) {
    return { ...SITE_SHARE_PREVIEW_AUTHOR };
  }
  return {
    name: author.name,
    title: author.title,
    avatar: await readImage(site, branch, author.avatar),
  };
}

/** The share image the next build would draw for a post or a section's home page. */
export async function renderSiteSharePreview(
  site: Site,
  input: SiteSharePreviewInput
): Promise<SiteSharePreview> {
  const config = parseConfig(input.config);
  if (!config) {
    return { image: null, warnings: [] };
  }
  const { branch } = input;
  const home = config.seo.image;
  // seo.image replaces the generated home page image, even with thumbnails off.
  if (input.page === "home" && home) {
    if (/^https?:\/\//.test(home)) {
      return { image: home, warnings: [] };
    }
    const bytes = await readAsset(site, branch, home);
    return bytes
      ? {
          image: `data:${siteImageMimeType(home)};base64,${bytes.toString("base64")}`,
          warnings: [],
        }
      : { image: null, warnings: [] };
  }
  const { thumbnails } = config;
  const [inter, logo, background, custom, author] = await Promise.all([
    loadInter(),
    readImage(site, branch, ogLogoPath(config)),
    readImage(site, branch, thumbnails.background),
    thumbnails.font ? readCustomFont(site, branch, thumbnails.font) : null,
    thumbnails.layout === "default"
      ? null
      : previewAuthor(site, branch, config),
  ]);
  const warnings: SiteSharePreviewWarning[] = [];
  if (thumbnails.background && !background) {
    warnings.push("background");
  }
  if (thumbnails.font && !custom) {
    warnings.push("font");
  }
  const style = ogStyle(config, {
    logo,
    background,
    domain: ogDomain(site.publicOrigin),
    customFont: Boolean(custom),
  });
  const area: SiteArea = site.mounts.blog === undefined ? "changelog" : "blog";
  const title = config[area]?.title ?? SITE_AREA_DEFAULT_TITLES[area];
  const card =
    input.page === "home"
      ? ogAreaCard({
          config,
          title,
          section: SITE_AREA_DEFAULT_TITLES[area],
          description: config[area]?.description ?? config.description,
          style,
        })
      : ogEntryCard({
          config,
          areaTitle: title,
          entry: {
            ...SITE_SHARE_PREVIEW_POST,
            date: new Date(),
            authors: author ? [author] : [],
          },
          style,
          now: new Date(),
        });
  const png = await renderOgPng(card, custom ? [custom, ...inter] : inter);
  return {
    image: `data:image/png;base64,${png.toString("base64")}`,
    warnings,
  };
}
