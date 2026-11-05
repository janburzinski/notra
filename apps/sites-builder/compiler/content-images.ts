import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

import { joinMountPath } from "@notra/sites-core/utils/mounts";

import {
  CONTENT_IMAGE_BUDGET,
  CONTENT_IMAGE_ENCODE_TIMEOUT_SECONDS,
  CONTENT_IMAGE_EXTENSIONS,
  CONTENT_IMAGE_LOSSLESS_FORMATS,
  CONTENT_IMAGE_RGB_SPACES,
  CONTENT_IMAGE_SETTINGS_VERSION,
  CONTENT_IMAGE_WEBP,
  CONTENT_IMAGE_WIDTHS,
  CONTENT_IMAGES_DIR,
} from "./constants/content-images";
import type {
  ContentImageTag,
  ContentImageVariants,
  OptimizeContentImagesParams,
  OptimizeContentImagesResult,
  SharpFactory,
} from "./types/content-images";
import { isAnimatedPng } from "./utils/animated-png";
import {
  addContentImageSrcsets,
  findContentImages,
} from "./utils/content-image-tags";

async function importSharp(): Promise<SharpFactory> {
  return (await import("sharp")).default;
}

/** The mount a built path belongs to: the longest one it sits under. */
function mountOf(path: string, mounts: readonly string[]): string | null {
  return (
    [...mounts]
      .filter(
        (mount) =>
          mount === "/" || path === mount || path.startsWith(`${mount}/`)
      )
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}

/** The output file an <img src> points at, if it is a raster image this build published. */
function outputFile(
  outDir: string,
  src: string,
  mounts: readonly string[]
): string | null {
  let path: string;
  try {
    path = decodeURI(src);
  } catch {
    return null;
  }
  if (
    path.split("/").some((segment) => segment === "." || segment === "..") ||
    !mountOf(path, mounts) ||
    path.includes("/_notra/") ||
    !CONTENT_IMAGE_EXTENSIONS.has(extname(path).toLowerCase())
  ) {
    return null;
  }
  const file = resolve(outDir, `.${path}`);
  return relative(outDir, file).startsWith("..") ? null : file;
}

/** Where copies of an image go: `<mount>/_notra/assets/images`, next to the section's other assets. */
function assetsUrl(src: string, mounts: readonly string[]): string {
  return joinMountPath(
    mountOf(decodeURI(src), mounts) ?? "/",
    CONTENT_IMAGES_DIR
  );
}

async function makeVariants(
  sharp: SharpFactory,
  outDir: string,
  mounts: readonly string[],
  src: string,
  file: string,
  deadline: number,
  now: () => number
): Promise<{
  variants: ContentImageVariants;
  created: number;
  outOfTime?: boolean;
}> {
  const none = { variants: null, created: 0 };
  const data = await readFile(file);
  const metadata = await sharp(data).metadata();
  const width = metadata.autoOrient?.width ?? metadata.width;
  if (!width || (metadata.pages ?? 1) > 1 || isAnimatedPng(data)) {
    return none;
  }
  const widths = CONTENT_IMAGE_WIDTHS.filter((candidate) => candidate < width);
  if (widths.length === 0) {
    return none;
  }
  const hash = createHash("sha256")
    .update(CONTENT_IMAGE_SETTINGS_VERSION)
    .update(data)
    .digest("hex")
    .slice(0, 10);
  const stem =
    basename(file, extname(file))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "image";
  const encoding = CONTENT_IMAGE_LOSSLESS_FORMATS.has(metadata.format ?? "")
    ? CONTENT_IMAGE_WEBP.lossless
    : CONTENT_IMAGE_WEBP.lossy;
  // Wide-gamut images (Display P3 photos and screenshots) keep their profile, or browsers would show them duller.
  const keepProfile = Boolean(
    metadata.icc && CONTENT_IMAGE_RGB_SPACES.has(metadata.space ?? "")
  );
  const baseUrl = assetsUrl(src, mounts);
  const directory = join(outDir, `.${baseUrl}`);
  await mkdir(directory, { recursive: true });
  const candidates: { url: string; width: number }[] = [];
  for (const target of widths) {
    if (now() > deadline) {
      if (candidates.length === 0) {
        return { ...none, outOfTime: true };
      }
      break;
    }
    let output: Buffer;
    try {
      const pipeline = sharp(data)
        .timeout({ seconds: CONTENT_IMAGE_ENCODE_TIMEOUT_SECONDS })
        .autoOrient()
        .resize({ width: target, withoutEnlargement: true });
      output = await (keepProfile ? pipeline.keepIccProfile() : pipeline)
        .webp(encoding)
        .toBuffer();
    } catch (error) {
      // Keep what's already written; with nothing written, the image is reported as failed.
      if (candidates.length === 0) {
        throw error;
      }
      break;
    }
    // A copy that isn't smaller than the original helps nobody, and wider ones won't be either.
    if (output.byteLength >= data.byteLength) {
      break;
    }
    const name = `${stem}-${hash}-${target}.webp`;
    await writeFile(join(directory, name), output);
    candidates.push({ url: `${baseUrl}/${name}`, width: target });
  }
  if (candidates.length === 0) {
    return none;
  }
  return {
    variants: [...candidates, { url: src, width }],
    created: candidates.length,
  };
}

/**
 * Gives images inside post and changelog content a srcset of smaller WebP
 * copies. The original stays as src and as the widest candidate, so a copy
 * that is skipped, fails or isn't supported falls back to what the author
 * published. Never fails the build: problems become warnings.
 */
export async function optimizeContentImages(
  params: OptimizeContentImagesParams
): Promise<OptimizeContentImagesResult> {
  const now = params.now ?? Date.now;
  const started = now();
  const result: OptimizeContentImagesResult = {
    pages: new Map(),
    diagnostics: [],
    images: 0,
    variants: 0,
    durationMs: 0,
  };
  const tagsByPage = new Map<string, ContentImageTag[]>();
  const sources = new Map<string, string>();
  for (const [urlPath, html] of params.pageHtml) {
    const tags = findContentImages(html).filter((tag) => {
      const file = outputFile(params.outDir, tag.src, params.mounts);
      if (file) {
        sources.set(tag.src, file);
      }
      return file !== null;
    });
    if (tags.length > 0) {
      tagsByPage.set(urlPath, tags);
    }
  }
  if (sources.size === 0) {
    return result;
  }

  let sharp: SharpFactory;
  try {
    sharp = await (params.loadSharp ?? importSharp)();
  } catch (error) {
    result.diagnostics.push({
      severity: "warning",
      file: null,
      code: "content_images_unavailable",
      message: `Images in posts were published without smaller copies: the image library could not load (${error instanceof Error ? error.message : String(error)}).`,
    });
    result.durationMs = now() - started;
    return result;
  }

  const budget = params.budget ?? CONTENT_IMAGE_BUDGET;
  const variants = new Map<string, ContentImageVariants>();
  const failed: string[] = [];
  const queue = [...sources].slice(0, budget.maxImages);
  let skippedForBudget = sources.size - queue.length;
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      if (now() - started > budget.maxDurationMs) {
        skippedForBudget += 1;
        continue;
      }
      const [src, file] = next;
      try {
        // A src that names no file is the author's broken link, not ours to report.
        if (!(await stat(file).catch(() => null))?.isFile()) {
          continue;
        }
        const made = await makeVariants(
          sharp,
          params.outDir,
          params.mounts,
          src,
          file,
          started + budget.maxDurationMs,
          now
        );
        if (made.outOfTime) {
          skippedForBudget += 1;
          continue;
        }
        variants.set(src, made.variants);
        if (made.variants) {
          result.images += 1;
          result.variants += made.created;
        }
      } catch {
        failed.push(src);
      }
    }
  };
  await Promise.all(Array.from({ length: budget.concurrency }, worker));

  for (const [urlPath, tags] of tagsByPage) {
    if (!tags.some((tag) => variants.get(tag.src))) {
      continue;
    }
    const html = params.pageHtml.get(urlPath) ?? "";
    result.pages.set(
      urlPath,
      addContentImageSrcsets(html, tags, (src) => variants.get(src) ?? null)
    );
  }
  if (failed.length > 0) {
    result.diagnostics.push({
      severity: "warning",
      file: null,
      code: "content_image_failed",
      message: `${failed.length} image${failed.length === 1 ? "" : "s"} could not be read and kept only the original: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? ", …" : ""}`,
    });
  }
  if (skippedForBudget > 0) {
    result.diagnostics.push({
      severity: "warning",
      file: null,
      code: "content_images_budget",
      message: `${skippedForBudget} image${skippedForBudget === 1 ? "" : "s"} in posts kept only the original because the build reached its image limit (${budget.maxImages} images or ${budget.maxDurationMs / 1000} seconds).`,
    });
  }
  result.durationMs = now() - started;
  return result;
}
