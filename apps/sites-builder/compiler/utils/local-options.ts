import { realpathSync, statSync } from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

import { SITE_SOURCE_ROOTS } from "@notra/sites-core/constants/sites";
import { siteBuildRequestSchema } from "@notra/sites-core/schemas/build";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import type { SiteBuildRequest } from "@notra/sites-core/types/build";
import type { SiteArea, SiteMounts } from "@notra/sites-core/types/deployment";
import { createDefaultSiteConfig } from "@notra/sites-core/utils/default-config";
import { normalizeSiteMounts } from "@notra/sites-core/utils/mounts";

import { LOCAL_BUILD_ORIGIN, LOCAL_SITE_ID } from "../constants/cli";
import { UsageError } from "./usage-error";

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

function isSiteArea(value: string): value is SiteArea {
  return value === "blog" || value === "changelog";
}

// `--mount blog=/newsroom`, repeatable. The sections listed are the ones served.
export function parseMountFlags(
  flags: readonly string[] = []
): SiteMounts | undefined {
  if (flags.length === 0) {
    return undefined;
  }
  const mounts: SiteMounts = {};
  for (const flag of flags) {
    const separator = flag.indexOf("=");
    const area = flag.slice(0, Math.max(separator, 0)).trim();
    const path = flag.slice(separator + 1).trim();
    if (separator === -1 || !isSiteArea(area)) {
      throw new UsageError(
        `--mount ${flag}: expected blog=<path> or changelog=<path>, like --mount blog=/newsroom`
      );
    }
    if (!path.startsWith("/")) {
      throw new UsageError(`--mount ${flag}: the path must start with /`);
    }
    if (mounts[area] !== undefined) {
      throw new UsageError(`--mount ${flag}: ${area} is mounted twice`);
    }
    mounts[area] = path;
  }
  try {
    return normalizeSiteMounts(mounts);
  } catch (error) {
    throw new UsageError(
      `--mount: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// --mount lists the sections to serve and replaces a target's mounts. Without
// either, preview the requested section and those that have a folder, or both
// when neither does.
export function localMounts(
  siteRoot: string,
  target?: SiteBuildRequest,
  area?: SiteArea,
  mounts?: SiteMounts
): SiteMounts {
  if (mounts) {
    if (area && !mounts[area]) {
      throw new UsageError(`--area ${area} needs a --mount ${area}=<path>`);
    }
    return mounts;
  }
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

function parseOrigin(origin: string): string {
  const url = URL.canParse(origin) ? new URL(origin) : null;
  if (!(url?.protocol === "http:" || url?.protocol === "https:")) {
    throw new UsageError(
      `--origin ${origin}: expected an http(s) URL, like https://example.com`
    );
  }
  return url.origin;
}

// A build without --target is a local check: drafts left out like a hosted
// build, but noindex so the output never gets indexed by accident. --origin and
// --mount replace the matching fields of a --target.
export function localBuildTarget(
  siteRoot: string,
  target: SiteBuildRequest | undefined,
  overrides: { origin?: string; mounts?: SiteMounts }
): SiteBuildRequest {
  const origin =
    overrides.origin === undefined ? undefined : parseOrigin(overrides.origin);
  if (target) {
    return {
      ...target,
      ...(origin ? { publicOrigin: origin } : {}),
      ...(overrides.mounts ? { mounts: overrides.mounts } : {}),
    };
  }
  return siteBuildRequestSchema.parse({
    siteId: LOCAL_SITE_ID,
    deploymentId: LOCAL_SITE_ID,
    publicOrigin: origin ?? LOCAL_BUILD_ORIGIN,
    mounts: localMounts(siteRoot, undefined, undefined, overrides.mounts),
    noindex: true,
    defaultConfig: localDefaultConfig(siteRoot),
  });
}

/** The real path of `path`, following symlinks; a folder that doesn't exist yet resolves through its nearest existing parent. */
function realPath(path: string): string {
  const missing: string[] = [];
  let existing = resolve(path);
  for (;;) {
    try {
      return join(realpathSync(existing), ...missing.reverse());
    } catch (error) {
      const parent = dirname(existing);
      if (
        (error as NodeJS.ErrnoException).code !== "ENOENT" ||
        parent === existing
      ) {
        throw error;
      }
      missing.push(basename(existing));
      existing = parent;
    }
  }
}

// The build empties --out first, so it may neither hold the site nor sit in one
// of its source folders (`--out blog` would delete the posts). Real paths are
// compared, so a symlink can't hide either.
export function assertOutsideSource(siteRoot: string, outDir: string) {
  const out = realPath(outDir);
  const source = realPath(siteRoot);
  const path = relative(out, source);
  const outside =
    path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path);
  const [firstSegment] = relative(source, out).split(sep);
  const inSourceFolder =
    outside &&
    firstSegment !== ".." &&
    SITE_SOURCE_ROOTS.has(firstSegment ?? "");
  if (!outside || inSourceFolder) {
    const problem = outside
      ? `is inside the site's ${firstSegment} folder`
      : "holds the site source";
    throw new UsageError(
      `--out ${outDir} ${problem}, and the build empties it first. Use a separate folder, like ${join(siteRoot, ".notra", "out")}`
    );
  }
}
