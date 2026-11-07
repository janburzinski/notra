import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import {
  joinMountPath,
  resolveAreaForPath,
} from "@notra/sites-core/utils/mounts";
import {
  matchRedirect,
  siteRedirectRules,
} from "@notra/sites-core/utils/redirects";
import {
  normalizeRequestPath,
  resolveFile,
  resolveMarkdownFile,
  wellKnownLlmsTxtTarget,
} from "@notra/sites-core/utils/request-paths";

import {
  SUGGESTION_MAX_LENGTH_DIFFERENCE,
  URL_SCHEME,
} from "./constants/links";
import type {
  LinkCheckContext,
  LinkTarget,
  SiteContentLink,
} from "./types/links";
import { closestName } from "./utils/closest-name";

// Follows the Sites worker's routes for a normalized path, after redirects.
function isServed(
  files: ReadonlyMap<string, string>,
  mounts: LinkCheckContext["mounts"],
  path: string
): boolean {
  const area = resolveAreaForPath(mounts, path);
  if (
    path === "/robots.txt" ||
    (area &&
      area.mount !== "/" &&
      path === joinMountPath(area.mount, "robots.txt")) ||
    wellKnownLlmsTxtTarget(files, path)
  ) {
    return true;
  }
  return (
    path !== joinMountPath(area?.mount ?? "/", "404.md") &&
    (resolveMarkdownFile(files, path) ?? resolveFile(files, path)) !== null
  );
}

function linkTarget(
  url: string,
  pagePath: string,
  origin: URL
): LinkTarget | null {
  const written = url.trim();
  if (!written || written.startsWith("#") || written.includes("{{")) {
    return null;
  }
  const absolute = written.startsWith("//") || URL_SCHEME.test(written);
  let resolved: URL;
  try {
    resolved = new URL(written, new URL(pagePath, origin));
  } catch {
    return null;
  }
  if (
    absolute &&
    !(
      resolved.host === origin.host &&
      (resolved.protocol === "https:" || resolved.protocol === "http:")
    )
  ) {
    return null;
  }
  const path = normalizeRequestPath(resolved.pathname);
  return path === null
    ? null
    : { path, rootPath: !absolute && written.startsWith("/") };
}

function hint(
  path: string,
  candidates: readonly string[],
  prefix = ""
): string {
  const suggestion = closestName(
    path,
    candidates.filter(
      (candidate) =>
        Math.abs(candidate.length - path.length) <=
        SUGGESTION_MAX_LENGTH_DIFFERENCE
    )
  );
  return suggestion ? ` Did you mean ${prefix}${suggestion}?` : "";
}

/**
 * Warns about links to pages under the site's mounts that the build didn't
 * produce, and about images that aren't in public/. Paths outside the mounts
 * may belong to another website on the same domain, so links there are skipped.
 */
export function brokenLinkDiagnostics(
  links: readonly SiteContentLink[],
  context: LinkCheckContext
): SiteDiagnostic[] {
  const origin = new URL(context.publicOrigin);
  const redirects = siteRedirectRules(context.redirects);
  const pages = [...context.files]
    .filter((file) => file.endsWith("/index.html"))
    .map((file) => file.slice(0, -"/index.html".length) || "/");
  const publicFiles = [...context.publicFiles];
  const files = new Map([...context.files].map((file) => [file, file]));
  const diagnostics: SiteDiagnostic[] = [];
  for (const link of links) {
    const mount = context.mounts[link.area];
    const pagePath = mount && joinMountPath(mount, link.slug);
    // Drafts and entries of areas that aren't mounted aren't published.
    if (!(pagePath && isServed(files, context.mounts, pagePath))) {
      continue;
    }
    const target = linkTarget(link.url, pagePath, origin);
    if (
      !target ||
      (target.rootPath && context.publicFiles.has(target.path)) ||
      matchRedirect(redirects, target.path)
    ) {
      continue;
    }
    const owner = resolveAreaForPath(context.mounts, target.path);
    if (owner && isServed(files, context.mounts, target.path)) {
      continue;
    }
    if (!owner && !(link.kind === "image" && target.rootPath)) {
      continue;
    }
    const written = link.url.trim().split("#")[0];
    const shown =
      written === target.path ? target.path : `${written} (${target.path})`;
    const location = {
      severity: "warning" as const,
      file: link.file,
      line: link.line,
      ...(link.column === undefined ? {} : { column: link.column }),
    };
    if (link.kind === "link") {
      diagnostics.push({
        ...location,
        code: "link_broken",
        message: `Broken link to ${shown}: no page, file or redirect has this path.${hint(target.path, pages)}`,
      });
      continue;
    }
    const prefix =
      owner && owner.mount !== "/" && target.path.startsWith(`${owner.mount}/`)
        ? owner.mount
        : "";
    const publicPath = target.path.slice(prefix.length);
    diagnostics.push({
      ...location,
      code: "image_missing",
      message: `Missing image ${shown}: there is no public${publicPath} in the repository.${hint(publicPath, publicFiles, prefix)}`,
    });
  }
  return diagnostics;
}
