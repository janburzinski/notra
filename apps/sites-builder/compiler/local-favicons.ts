import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  SITE_FAVICON_DIR,
  SITE_FAVICON_FALLBACK_SVG,
  SITE_FAVICON_MAX_BYTES,
} from "@notra/sites-core/constants/sites";
import { joinMountPath } from "@notra/sites-core/utils/mounts";
import { googleFaviconUrl } from "@notra/utils/google-favicon";

import { LOCAL_FAVICON_FETCH_TIMEOUT_MS } from "./constants/build";
import type { FaviconFetch, WriteLocalFaviconsParams } from "./types/build";

async function fetchFavicon(
  host: string,
  fetcher: FaviconFetch
): Promise<Uint8Array | null> {
  const url = googleFaviconUrl(host);
  if (!url) {
    return null;
  }
  try {
    const response = await fetcher(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(LOCAL_FAVICON_FETCH_TIMEOUT_MS),
    });
    if (!response.headers.get("Content-Type")?.startsWith("image/")) {
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return response.ok &&
      bytes.byteLength > 0 &&
      bytes.byteLength <= SITE_FAVICON_MAX_BYTES
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * The globe as a PNG: a static server sends this extensionless file without
 * an image type, and browsers only recognise raster images by their bytes.
 */
async function fallbackIcon(): Promise<Uint8Array> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(Buffer.from(SITE_FAVICON_FALLBACK_SVG), { density: 288 })
      .resize(64, 64)
      .png()
      .toBuffer();
  } catch {
    return new TextEncoder().encode(SITE_FAVICON_FALLBACK_SVG);
  }
}

/**
 * On Notra the worker answers `<mount>/_notra/favicon/<host>` for the footer's
 * website link. A local build has no worker, so it writes the file itself.
 */
export async function writeLocalFavicons(
  params: WriteLocalFaviconsParams
): Promise<void> {
  const icon =
    (await fetchFavicon(params.host, params.fetch ?? fetch)) ??
    (await fallbackIcon());
  await Promise.all(
    params.mounts.map(async (mount) => {
      const file = join(
        params.outDir,
        joinMountPath(mount, `${SITE_FAVICON_DIR}/${params.host}`)
      );
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, icon);
    })
  );
}
