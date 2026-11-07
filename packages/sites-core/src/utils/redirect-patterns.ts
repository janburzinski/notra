import {
  SITE_REDIRECT_DESTINATION_ORIGIN,
  SITE_REDIRECT_PLACEHOLDER,
  SITE_REDIRECT_PLACEHOLDER_IN_TEXT,
} from "@notra/sites-core/constants/site-config";
import type { RedirectPatternIssue } from "@notra/sites-core/types/redirects";

export function redirectDestinationParts(destination: string): string[] {
  const origin = SITE_REDIRECT_DESTINATION_ORIGIN.exec(destination)?.[0] ?? "";
  const parts = destination
    .slice(origin.length)
    .split(SITE_REDIRECT_PLACEHOLDER_IN_TEXT);
  parts[0] = `${origin}${parts[0]}`;
  return parts;
}

export function redirectPatternIssues(
  source: string,
  destination: string
): RedirectPatternIssue[] {
  const issues: RedirectPatternIssue[] = [];
  const defined = new Set<string>();
  for (const segment of source.split("/")) {
    if (!segment.startsWith(":")) {
      continue;
    }
    if (!SITE_REDIRECT_PLACEHOLDER.test(segment)) {
      issues.push({
        path: "source",
        severity: "warning",
        message: `"${segment}" is matched literally because it isn't a valid placeholder. Placeholders start with a letter or underscore and use letters, digits and underscores, like :slug`,
      });
      continue;
    }
    const name = segment.slice(1);
    if (defined.has(name)) {
      issues.push({
        path: "source",
        severity: "error",
        message: `:${name} is used more than once. Give each placeholder its own name`,
      });
    }
    defined.add(name);
  }
  const undefinedNames = new Set(
    redirectDestinationParts(destination).filter(
      (part, index) => index % 2 === 1 && !defined.has(part)
    )
  );
  for (const name of undefinedNames) {
    issues.push({
      path: "destination",
      severity: "warning",
      message: `:${name} is kept as written because source doesn't define it. To insert a segment, add :${name} to source as a whole segment, like /blog/:${name}`,
    });
  }
  return issues;
}
