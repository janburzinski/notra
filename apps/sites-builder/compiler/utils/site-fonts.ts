import { cp, mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import { FONT_CACHE_DIR } from "@notra/sites-core/constants/fonts";
import {
  SITE_ASSETS_DIR,
  SITE_CONFIG_FILENAME,
} from "@notra/sites-core/constants/sites";
import type { SiteConfig } from "@notra/sites-core/types/site-config";
import {
  downloadSiteFonts,
  planSiteFonts,
} from "@notra/sites-core/utils/site-fonts";

import type { SiteFontsResult } from "../types/fonts";
import { exists, writeFileEnsured } from "./fs";

/**
 * Copies the site's Google Fonts into its public files. Builds in Upstash Boxes have no network,
 * so the server puts the downloaded fonts in the cache first; local builds download them here.
 */
export async function prepareSiteFonts(
  config: SiteConfig,
  workDir: string
): Promise<SiteFontsResult> {
  let stagingDir: string | undefined;
  let publicDir: string | undefined;
  try {
    const plan = await planSiteFonts(config.fonts);
    if (!plan) {
      return { publicFiles: [], diagnostics: [] };
    }
    const cacheRoot = join(workDir, FONT_CACHE_DIR);
    const cacheDir = join(cacheRoot, plan.key);
    const publicPath = `/${SITE_ASSETS_DIR}/fonts/${plan.key}`;
    publicDir = join(workDir, "site", "public", publicPath);
    if (!(await exists(cacheDir))) {
      await mkdir(cacheRoot, { recursive: true });
      stagingDir = await mkdtemp(join(cacheRoot, "batch-"));
      for (const file of await downloadSiteFonts(plan)) {
        await writeFileEnsured(join(stagingDir, file.name), file.data);
      }
      await rename(stagingDir, cacheDir);
      stagingDir = undefined;
    }
    const names = await readdir(cacheDir);
    const stylesheet = names.find((name) => name.endsWith(".css"));
    if (!stylesheet) {
      throw new Error("Cached font stylesheet is missing");
    }
    await cp(cacheDir, publicDir, { recursive: true });
    return {
      stylesheet: `${publicPath}/${stylesheet}`,
      publicFiles: names.map((name) => `${publicPath}/${name}`),
      diagnostics: [],
    };
  } catch (error) {
    await Promise.all(
      [stagingDir, publicDir]
        .filter((path) => path !== undefined)
        .map((path) => rm(path, { recursive: true, force: true }))
    );
    return {
      publicFiles: [],
      diagnostics: [
        {
          severity: "warning",
          file: SITE_CONFIG_FILENAME,
          code: "font_download",
          message: `Could not bundle site fonts; system fonts will be used. ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}
