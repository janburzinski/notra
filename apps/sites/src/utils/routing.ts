import { LLMS_LINKS } from "@notra/sites-core/constants/request-paths";
import type {
  SiteManifest,
  SiteManifestFile,
} from "@notra/sites-core/types/deployment";
import { joinMountPath } from "@notra/sites-core/utils/mounts";
import {
  normalizeRequestPath,
  resolveFile,
} from "@notra/sites-core/utils/request-paths";

import {
  HTML_TYPES,
  INDEX_PAGE,
  MARKDOWN_TYPES,
  REPEATED_SLASHES,
} from "../constants/routing";

/**
 * The one address of a page, when the request used another that serves the
 * same file: `//`, a trailing slash or `/index.html`. Each would otherwise be a
 * duplicate of the page for search engines. Works on the raw path, so the
 * redirect never changes how the rest of the address is encoded.
 */
export function canonicalPagePath(
  files: Map<string, SiteManifestFile>,
  pathname: string
): string | null {
  const withoutSlash = (path: string) =>
    path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
  let target = withoutSlash(pathname.replace(REPEATED_SLASHES, "/"));
  if (target.endsWith(`/${INDEX_PAGE}`)) {
    target = withoutSlash(target.slice(0, -INDEX_PAGE.length));
  }
  if (target === pathname) {
    return null;
  }
  const from = normalizeRequestPath(pathname);
  const to = normalizeRequestPath(target);
  if (from === null || to === null) {
    return null;
  }
  const file = resolveFile(files, from);
  return file?.path.endsWith(".html") && resolveFile(files, to) === file
    ? target
    : null;
}

export function markdownTwin(
  files: Map<string, SiteManifestFile>,
  file: SiteManifestFile
): SiteManifestFile | null {
  return file.path.endsWith("/index.html")
    ? (files.get(`${file.path.slice(0, -".html".length)}.md`) ?? null)
    : null;
}

export function twinPagePath(twinPath: string): string | null {
  if (!twinPath.endsWith("/index.md")) {
    return null;
  }
  return twinPath.slice(0, -"/index.md".length) || "/";
}

export function markdownAlternatePath(
  files: Map<string, SiteManifestFile>,
  twinPath: string,
  mount: string | undefined
): string {
  const pagePath = twinPagePath(twinPath);
  return pagePath &&
    pagePath !== "/" &&
    pagePath !== mount &&
    !files.has(`${pagePath}.md`)
    ? `${pagePath}.md`
    : twinPath;
}

export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) {
    return false;
  }
  let markdown = 0;
  let html = 0;
  for (const part of accept.split(",")) {
    const [type = "", ...parameters] = part.trim().toLowerCase().split(";");
    const qParameter = parameters
      .map((parameter) => parameter.trim())
      .find((parameter) => parameter.startsWith("q="));
    const quality = qParameter ? Number(qParameter.slice(2)) : 1;
    if (Number.isNaN(quality)) {
      continue;
    }
    if (MARKDOWN_TYPES.has(type.trim())) {
      markdown = Math.max(markdown, quality);
    } else if (HTML_TYPES.has(type.trim())) {
      html = Math.max(html, quality);
    }
  }
  return markdown > 0 && markdown >= html;
}

export function llmsLinkHeader(
  files: Map<string, SiteManifestFile>,
  mount: string
): string | null {
  const links = LLMS_LINKS.filter(({ file }) =>
    files.has(joinMountPath(mount, file))
  ).map(({ file, rel }) => `<${joinMountPath(mount, file)}>; rel="${rel}"`);
  return links.length > 0 ? links.join(", ") : null;
}
