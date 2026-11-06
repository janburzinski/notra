import {
  SITE_ENTRY_FILE,
  SITE_ENTRY_INDEX_SUFFIX,
  SITE_ENTRY_PATH_VARIANTS,
  SITE_ENTRY_SLUG,
  SURROUNDING_SLASHES,
} from "../constants/entries";
import type { SiteArea } from "../types/deployment";
import type { SiteEntryFile, SiteEntryPagePathInput } from "../types/entries";
import { joinMountPath } from "./mounts";

/** Reads a site-relative file path (`blog/2026/launch.mdx`) as an entry. */
export function parseSiteEntryFile(path: string): SiteEntryFile | null {
  const match = SITE_ENTRY_FILE.exec(path);
  if (!match) {
    return null;
  }
  const [, area, rest, format] = match;
  if (!(area && rest && format)) {
    return null;
  }
  if (rest.split("/").some((segment) => segment.startsWith("_"))) {
    return null;
  }
  const slug = rest.endsWith(SITE_ENTRY_INDEX_SUFFIX)
    ? rest.slice(0, -SITE_ENTRY_INDEX_SUFFIX.length)
    : rest;
  return {
    area: area as SiteArea,
    slug,
    format: format as SiteEntryFile["format"],
  };
}

/**
 * The public path a repository entry file is served at, following the same
 * rules as the build. Null when the file isn't a page of a mounted area.
 */
export function siteEntryPagePath(
  input: SiteEntryPagePathInput
): string | null {
  const root = input.rootDirectory.replace(SURROUNDING_SLASHES, "");
  const prefix = root ? `${root}/` : "";
  const entry = input.filePath.startsWith(prefix)
    ? parseSiteEntryFile(input.filePath.slice(prefix.length))
    : null;
  const mount = entry ? input.mounts[entry.area] : undefined;
  if (!(entry && mount && SITE_ENTRY_SLUG.test(entry.slug))) {
    return null;
  }
  return joinMountPath(mount, entry.slug);
}

/** Every path a page's visits can be recorded under. */
export function siteEntryTrafficPaths(pagePath: string): string[] {
  return SITE_ENTRY_PATH_VARIANTS.map((suffix) => `${pagePath}${suffix}`);
}
