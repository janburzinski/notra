import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import type { SiteFontCache } from "@notra/sites-core/types/fonts";
import {
  downloadSiteFonts,
  planSiteFonts,
} from "@notra/sites-core/utils/site-fonts";

import { publishedConfig } from "./editor";
import type { SandboxUploadFile } from "./types/build";
import type { SiteRepositoryAccess } from "./types/github";
import type { Site } from "./types/sites";
import { googleFontsEndpoints } from "./utils/provider-urls";
import { repositoryPath } from "./utils/root-directory";

const decoder = new TextDecoder();

/**
 * Downloads the Google Fonts a build needs, because builds run in Boxes without network access.
 * The config is resolved like the builder does: a previewed blog.json, the committed one, or the
 * default config when the repository has none. Returns null when the site uses no Google Fonts.
 */
export async function prefetchSiteFonts(params: {
  site: Site;
  commitSha: string;
  access: SiteRepositoryAccess;
  overlayFiles: SandboxUploadFile[];
  defaultConfig: unknown;
  signal?: AbortSignal;
}): Promise<SiteFontCache | null> {
  const configPath = repositoryPath(
    params.site.rootDirectory,
    SITE_CONFIG_FILENAME
  );
  const draft = params.overlayFiles.find((file) => file.path === configPath);
  const committed = draft
    ? decoder.decode(draft.data)
    : await publishedConfig(params.site, params.commitSha, params.access);
  const parsed = siteConfigSchema.safeParse(
    committed ? JSON.parse(committed) : params.defaultConfig
  );
  if (!parsed.success) {
    return null;
  }
  const plan = await planSiteFonts(parsed.data.fonts);
  return plan
    ? {
        key: plan.key,
        files: await downloadSiteFonts(plan, {
          signal: params.signal,
          endpoints: googleFontsEndpoints(),
        }),
      }
    : null;
}
