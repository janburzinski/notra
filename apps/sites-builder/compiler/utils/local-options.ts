import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readSync,
  realpathSync,
  statSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

import {
  SITE_BUILD_LIMITS,
  SITE_CONFIG_FILENAME,
  SITE_SOURCE_ROOTS,
} from "@notra/sites-core/constants/sites";
import { siteBuildRequestSchema } from "@notra/sites-core/schemas/build";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import type { SiteBuildRequest } from "@notra/sites-core/types/build";
import type { SiteArea, SiteMounts } from "@notra/sites-core/types/deployment";
import { readConfigSections } from "@notra/sites-core/utils/config-sections";
import { createDefaultSiteConfig } from "@notra/sites-core/utils/default-config";
import { normalizeSiteMounts } from "@notra/sites-core/utils/mounts";

import {
  LOCAL_BUILD_ORIGIN,
  LOCAL_SITE_ID,
  SOURCE_READ_CHUNK_BYTES,
  UNREADABLE_SOURCE_CODES,
} from "../constants/cli";
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

// blog.json is read before source collection, so it gets the same guards:
// symlinks are not followed, only regular files are read, and the read stops
// at the single-file limit. O_NONBLOCK keeps a FIFO from blocking the open.
// Anything else counts as missing; collection then reports it.
function readSourceTextIfExists(path: string): string | null {
  let fd: number;
  try {
    fd = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
    );
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if (code && UNREADABLE_SOURCE_CODES.has(code)) {
      return null;
    }
    throw error;
  }
  try {
    if (!fstatSync(fd).isFile()) {
      return null;
    }
    const limit = SITE_BUILD_LIMITS.maxSingleFileBytes;
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const chunk = Buffer.allocUnsafe(SOURCE_READ_CHUNK_BYTES);
      const read = readSync(fd, chunk, 0, chunk.length, null);
      if (read === 0) {
        return Buffer.concat(chunks, total).toString("utf8");
      }
      total += read;
      if (total > limit) {
        return null;
      }
      chunks.push(chunk.subarray(0, read));
    }
  } finally {
    closeSync(fd);
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
// either, serve the sections blog.json sets, like a hosted build does, or
// else the requested section and those that have a folder, or both when
// neither does.
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
  const sections = readConfigSections(
    readSourceTextIfExists(join(siteRoot, SITE_CONFIG_FILENAME))
  );
  if (sections) {
    if (area && !sections[area]) {
      throw new UsageError(
        `--area ${area}: ${SITE_CONFIG_FILENAME} sections leave out ${area}. Add it there or pass --mount ${area}=<path>`
      );
    }
    return sections;
  }
  const blog = area === "blog" || isDirectory(join(siteRoot, "blog"));
  const changelog =
    area === "changelog" || isDirectory(join(siteRoot, "changelog"));
  return {
    ...(blog || !changelog ? { blog: "/blog" } : {}),
    ...(changelog || !blog ? { changelog: "/changelog" } : {}),
  };
}

/**
 * `notra dev` keeps the paths it started with. Returns the notice to print
 * when blog.json `sections` now set others, or null.
 */
export function sectionsRestartNotice(
  siteRoot: string,
  mounts: SiteMounts
): string | null {
  let sections: SiteMounts | null;
  try {
    sections = readConfigSections(
      readSourceTextIfExists(join(siteRoot, SITE_CONFIG_FILENAME))
    );
  } catch {
    return null;
  }
  if (
    !sections ||
    JSON.stringify(normalizeSiteMounts(sections)) ===
      JSON.stringify(normalizeSiteMounts(mounts))
  ) {
    return null;
  }
  const paths = Object.entries(sections)
    .map(([area, path]) => `${area} at ${path}`)
    .join(" and ");
  return `${SITE_CONFIG_FILENAME} sections now serve the ${paths}. Restart notra dev to preview the new paths.`;
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
