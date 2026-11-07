import { SITE_REDIRECT_PLACEHOLDER } from "@notra/sites-core/constants/site-config";
import type {
  SiteRedirectMatch,
  SiteRedirectRule,
} from "@notra/sites-core/types/deployment";
import type { CompiledSiteRedirect } from "@notra/sites-core/types/redirects";
import type { SiteConfig } from "@notra/sites-core/types/site-config";
import { redirectDestinationParts } from "@notra/sites-core/utils/redirect-patterns";

// Keyed by the rules array, so a cached manifest compiles its rules once.
const compiled = new WeakMap<
  readonly SiteRedirectRule[],
  readonly CompiledSiteRedirect[]
>();

export function siteRedirectRules(
  redirects: SiteConfig["redirects"]
): SiteRedirectRule[] {
  return redirects.map((rule) => ({
    source: rule.source,
    destination: rule.destination,
    status: rule.permanent ? 308 : 307,
  }));
}

function withoutTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

// Location must be a printable-ASCII header value; destinations may hold any text.
function headerSafeLocation(location: string): string {
  return location.replace(/[^\u0021-\u007E]/gu, encodeURIComponent);
}

// Browsers read a leading `//` or `/\` as another host.
function sameHostLocation(location: string): string {
  return location.replace(/^[/\\]{2,}/u, "/");
}

export function matchRedirect(
  redirects: readonly SiteRedirectRule[],
  path: string
): SiteRedirectMatch | null {
  const match = findRedirect(
    compiledRedirects(redirects),
    withoutTrailingSlash(path)
  );
  return (
    match && {
      ...match,
      location: headerSafeLocation(sameHostLocation(match.location)),
    }
  );
}

function compiledRedirects(
  redirects: readonly SiteRedirectRule[]
): readonly CompiledSiteRedirect[] {
  let rules = compiled.get(redirects);
  if (!rules) {
    rules = redirects.map(compileRedirect);
    compiled.set(redirects, rules);
  }
  return rules;
}

function compileRedirect(rule: SiteRedirectRule): CompiledSiteRedirect {
  const prefix = rule.source.endsWith("/*");
  const source = prefix
    ? rule.source.slice(0, -2)
    : withoutTrailingSlash(rule.source);
  const carriesRest = prefix && rule.destination.endsWith("/*");
  const placeholders = new Map<string, number>();
  const segments = source.split("/").map((segment, index) => {
    if (!SITE_REDIRECT_PLACEHOLDER.test(segment)) {
      return segment;
    }
    const name = segment.slice(1);
    if (!placeholders.has(name)) {
      placeholders.set(name, index);
    }
    return null;
  });
  const destination = redirectDestinationParts(
    carriesRest ? rule.destination.slice(0, -2) : rule.destination
  ).map((part, index) =>
    index % 2 === 1 ? (placeholders.get(part) ?? `:${part}`) : part
  );
  return { segments, prefix, destination, carriesRest, status: rule.status };
}

function findRedirect(
  rules: readonly CompiledSiteRedirect[],
  bare: string
): SiteRedirectMatch | null {
  const path = bare.split("/");
  for (const rule of rules) {
    if (matchesSource(rule, path)) {
      return { location: destinationFor(rule, path), status: rule.status };
    }
  }
  return null;
}

function matchesSource(
  rule: CompiledSiteRedirect,
  path: readonly string[]
): boolean {
  const { segments } = rule;
  if (
    rule.prefix
      ? path.length < segments.length
      : path.length !== segments.length
  ) {
    return false;
  }
  return segments.every((segment, index) =>
    segment === null ? path[index] !== "" : segment === path[index]
  );
}

// `path` is decoded; re-encoding keeps `/`, `\`, `?` and `#` inside a value.
function destinationFor(
  rule: CompiledSiteRedirect,
  path: readonly string[]
): string {
  const location = rule.destination
    .map((part) =>
      typeof part === "number" ? encodeURIComponent(path[part] ?? "") : part
    )
    .join("");
  const rest = rule.carriesRest ? path.slice(rule.segments.length) : [];
  return rest.length > 0
    ? `${location}/${rest.map(encodeURIComponent).join("/")}`
    : location;
}
