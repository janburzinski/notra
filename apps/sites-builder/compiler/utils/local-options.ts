import { statSync } from "node:fs";
import { basename, join } from "node:path";

import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import type { SiteBuildRequest } from "@notra/sites-core/types/build";
import type { SiteArea, SiteMounts } from "@notra/sites-core/types/deployment";
import { createDefaultSiteConfig } from "@notra/sites-core/utils/default-config";

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return false;
    }
    throw error;
  }
}

// Without a target, preview the requested section and those that have a folder, or both when neither does.
export function localMounts(
  siteRoot: string,
  target?: SiteBuildRequest,
  area?: SiteArea
): SiteMounts {
  if (target) {
    return target.mounts;
  }
  const blog = area === "blog" || isDirectory(join(siteRoot, "blog"));
  const changelog =
    area === "changelog" || isDirectory(join(siteRoot, "changelog"));
  return {
    ...(blog || !changelog ? { blog: "/blog" } : {}),
    ...(changelog || !blog ? { changelog: "/changelog" } : {}),
  };
}

export function localDefaultConfig(
  siteRoot: string,
  target?: SiteBuildRequest
) {
  return (
    target?.defaultConfig ??
    createDefaultSiteConfig(
      basename(siteRoot)
        .trim()
        .slice(0, siteConfigSchema.shape.name.maxLength ?? 80)
        .trim() || "Local site"
    )
  );
}
