import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { SiteArea, SiteMounts } from "@notra/sites-core/types/deployment";
import {
  joinMountPath,
  listMountedAreas,
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
  BUILT_ROUTE_SEGMENTS,
  FRAGMENT_DIRECTIVE,
  MEDIA_FILE,
  SUGGESTION_MAX_LENGTH_DIFFERENCE,
  URL_SCHEME,
} from "./constants/links";
import type {
  LinkCheckContext,
  LinkPage,
  LinkResolver,
  LinkTarget,
  SiteContentLink,
  SourceLinkCheckContext,
} from "./types/links";
import { closestName } from "./utils/closest-name";

// Follows the Sites worker's routes for a normalized path, after redirects.
function isServed(
  files: ReadonlyMap<string, string>,
  mounts: SiteMounts,
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

function pagePath(mounts: SiteMounts, page: LinkPage): string | null {
  const mount = mounts[page.area];
  return mount === undefined ? null : joinMountPath(mount, page.slug ?? "");
}

function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

/** Where a link points, or null when it leaves the site or depends on the page it's shown on. */
function linkTarget(
  url: string,
  page: string | null,
  origin: URL
): LinkTarget | null {
  const written = url.trim();
  if (!written || written.includes("{{")) {
    return null;
  }
  const absolute = written.startsWith("//") || URL_SCHEME.test(written);
  const rootPath = !absolute && written.startsWith("/");
  if (page === null && !absolute && !rootPath) {
    return null;
  }
  let resolved: URL;
  try {
    resolved = new URL(written, new URL(page ?? "/", origin));
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
  // The browser drops a fragment directive (:~:text=…) before it looks for the ID.
  const rawFragment = resolved.hash
    ? (resolved.hash.slice(1).split(FRAGMENT_DIRECTIVE)[0] ?? "")
    : null;
  return {
    path: normalizeRequestPath(resolved.pathname),
    pathname: resolved.pathname,
    rootPath,
    rawFragment,
    fragment: rawFragment === null ? null : decodeFragment(rawFragment),
  };
}

function hint(name: string, candidates: Iterable<string>, prefix = ""): string {
  const suggestion = closestName(
    name,
    [...candidates].filter(
      (candidate) =>
        Math.abs(candidate.length - name.length) <=
        SUGGESTION_MAX_LENGTH_DIFFERENCE
    )
  );
  return suggestion ? ` Did you mean ${prefix}${suggestion}?` : "";
}

// #top and an empty # scroll to the top, and a fragment that is only a
// :~:text= directive highlights text.
function checksFragment(target: LinkTarget): target is LinkTarget & {
  fragment: string;
  rawFragment: string;
} {
  return (
    target.fragment !== null &&
    Boolean(target.rawFragment) &&
    target.fragment.toLowerCase() !== "top"
  );
}

function diagnose(
  links: readonly SiteContentLink[],
  context: LinkCheckContext | SourceLinkCheckContext,
  site: LinkResolver
): SiteDiagnostic[] {
  const origin = new URL(context.publicOrigin);
  const redirects = siteRedirectRules(context.redirects);
  const diagnostics: SiteDiagnostic[] = [];
  for (const link of links) {
    // Drafts and entries of areas that aren't mounted aren't published.
    const [page] = link.pages;
    if (!(page && link.pages.some(site.isPublished))) {
      continue;
    }
    const target = linkTarget(
      link.url,
      link.shared ? null : pagePath(context.mounts, page),
      origin
    );
    if (!target) {
      continue;
    }
    const written = link.url.trim();
    const location = {
      severity: "warning" as const,
      file: link.file,
      line: link.line,
      ...(link.column === undefined ? {} : { column: link.column }),
    };
    const code = link.kind === "link" ? "link_broken" : "image_missing";
    if (target.path === null) {
      // The worker can't read the path and answers 400; outside the mounts
      // another website may serve it.
      if (resolveAreaForPath(context.mounts, target.pathname)) {
        diagnostics.push({
          ...location,
          code,
          message: `${link.kind === "link" ? "Broken link to" : "Missing image"} ${written}: Notra can't read this path and answers it with 400 Bad Request. Write % as %25 and leave out .. segments.`,
        });
      }
      continue;
    }
    if (
      (target.rootPath && context.publicFiles.has(target.path)) ||
      matchRedirect(redirects, target.path)
    ) {
      continue;
    }
    const served = site.serves(target.path);
    if (served === null) {
      continue;
    }
    if (served) {
      if (link.kind !== "link" || !checksFragment(target)) {
        continue;
      }
      const ids = site.ids(target.path);
      // A browser tries the fragment as written, then percent-decoded.
      if (ids && !ids.has(target.rawFragment) && !ids.has(target.fragment)) {
        const resolved = `${target.path}#${target.rawFragment}`;
        const shown =
          written === resolved || written.startsWith("#")
            ? written
            : `${written} (${resolved})`;
        diagnostics.push({
          ...location,
          code,
          message: `Broken link to ${shown}: ${target.path} has no heading or other element with id "${target.fragment}".${hint(target.fragment, ids, "#")}`,
        });
      }
      continue;
    }
    const owner = resolveAreaForPath(context.mounts, target.path);
    if (!owner && !(link.kind === "image" && target.rootPath)) {
      continue;
    }
    const writtenPath = written.split("#")[0];
    const shown =
      writtenPath === target.path
        ? target.path
        : `${writtenPath} (${target.path})`;
    if (link.kind === "link") {
      diagnostics.push({
        ...location,
        code,
        message: `Broken link to ${shown}: no page, file or redirect has this path.${hint(target.path, site.pages)}`,
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
      code,
      message: `Missing image ${shown}: there is no public${publicPath} in the repository.${hint(publicPath, context.publicFiles, prefix)}`,
    });
  }
  return diagnostics;
}

/**
 * Warns about links to pages under the site's mounts that the build didn't
 * produce, #fragments that aren't on the built page, and images that aren't
 * in public/. Paths outside the mounts may belong to another website on the
 * same domain, so links there are skipped.
 */
export function brokenLinkDiagnostics(
  links: readonly SiteContentLink[],
  context: LinkCheckContext
): SiteDiagnostic[] {
  const files = new Map([...context.files].map((file) => [file, file]));
  const ids = new Map<string, ReadonlySet<string> | null>();
  const pages = [...context.files]
    .filter((file) => file.endsWith("/index.html"))
    .map((file) => file.slice(0, -"/index.html".length) || "/");
  return diagnose(links, context, {
    isPublished: (page) => {
      const path = pagePath(context.mounts, page);
      if (path === null || page.under === undefined) {
        return path !== null && isServed(files, context.mounts, path);
      }
      const under = joinMountPath(path, page.under);
      return pages.some((built) => built.startsWith(`${under}/`));
    },
    serves: (path) =>
      resolveAreaForPath(context.mounts, path) !== null &&
      isServed(files, context.mounts, path),
    ids: (path) => {
      const file = resolveMarkdownFile(files, path)
        ? null
        : resolveFile(files, path);
      if (!file?.endsWith(".html")) {
        return null;
      }
      if (!ids.has(file)) {
        ids.set(file, context.ids?.(file) ?? null);
      }
      return ids.get(file) ?? null;
    },
    pages,
  });
}

/**
 * The part of brokenLinkDiagnostics the source can answer without a build,
 * for validate and the dev server: links to entries that don't exist and
 * images missing from public/. Anything only a build can tell (tag and author
 * pages, the author-hero slot, generated files, #fragments, links in drafts)
 * is skipped, so this
 * never warns about a link a full build accepts.
 */
export function sourceLinkDiagnostics(
  links: readonly SiteContentLink[],
  context: SourceLinkCheckContext
): SiteDiagnostic[] {
  const slugs = new Map<SiteArea, Set<string>>();
  for (const entry of context.entries) {
    const area = slugs.get(entry.area) ?? new Set();
    slugs.set(entry.area, area.add(entry.slug));
  }
  const publicFiles = new Map(
    [...context.publicFiles].map((file) => [file, file])
  );
  const mounted = listMountedAreas(context.mounts);
  return diagnose(links, context, {
    isPublished: (page) =>
      context.mounts[page.area] !== undefined &&
      page.draft !== true &&
      page.under === undefined,
    serves: (path) => {
      const area = resolveAreaForPath(context.mounts, path);
      const rest =
        !area || area.mount === "/" ? path : path.slice(area.mount.length);
      const segments = rest.split("/").filter(Boolean);
      const [first = "", last = ""] = [segments[0], segments.at(-1)];
      if (BUILT_ROUTE_SEGMENTS.has(first)) {
        return null;
      }
      if (!area || segments.length === 0) {
        return area !== null;
      }
      if (
        resolveFile(publicFiles, rest) ||
        slugs.get(area.area)?.has(segments.join("/"))
      ) {
        return true;
      }
      return last.includes(".") && !MEDIA_FILE.test(last) ? null : false;
    },
    ids: () => null,
    pages: mounted.flatMap(({ area, mount }) => [
      mount,
      ...[...(slugs.get(area) ?? [])].map((slug) => joinMountPath(mount, slug)),
    ]),
  });
}
