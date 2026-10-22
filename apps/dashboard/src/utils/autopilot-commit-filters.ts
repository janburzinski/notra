import type { AutopilotCommitFilters } from "@notra/db/types/autopilot";

import {
  AUTOPILOT_AUTHOR_PRESETS_SHOWN,
  AUTOPILOT_CHORE_AUTHOR_MIN_PULL_REQUESTS,
  AUTOPILOT_CHORE_AUTHOR_MIN_SHARE,
  AUTOPILOT_DEFAULT_COMMIT_FILTERS,
  AUTOPILOT_WELL_KNOWN_BOTS,
} from "@/constants/autopilot";
import type { AutopilotAuthorSuggestion } from "@/types/autopilot";

const GLOB_CHARACTERS = /[*?]/;
const REGEXP_SPECIAL = /[.+^${}()|[\]\\]/g;

/** Saved filters with the defaults filled in, for rows written before them. */
export function toAutopilotCommitFilters(
  saved: Partial<AutopilotCommitFilters> | null | undefined
): AutopilotCommitFilters {
  return { ...AUTOPILOT_DEFAULT_COMMIT_FILTERS, ...saved };
}

/** Why a pull request's author keeps it out, or null when it may count. */
export function excludedAuthorReason(
  filters: AutopilotCommitFilters,
  author: string | null
) {
  return author && filters.excludedAuthors.includes(author.toLowerCase())
    ? `author ${author} is excluded`
    : null;
}

/** The path filter of one repository, or null when every change counts. */
export function repositoryPathFilter(
  filters: AutopilotCommitFilters,
  fullName: string
) {
  const patterns = filters.paths[fullName.toLowerCase()];
  return patterns && patterns.length > 0 ? patterns : null;
}

function patternToRegExp(pattern: string) {
  let source = "";
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index] ?? "";
    if (character === "*" && pattern[index + 1] === "*") {
      const slash = pattern[index + 2] === "/";
      source += slash ? "(?:.*/)?" : ".*";
      index += slash ? 2 : 1;
    } else if (character === "*") {
      source += "[^/]*";
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += character.replace(REGEXP_SPECIAL, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

/**
 * A plain path is a prefix ("apps/web" covers everything under it); with * or
 * ? it is a glob where * stays inside one folder and ** crosses folders.
 */
export function matchesRepositoryPath(path: string, pattern: string) {
  const clean = pattern.replace(/^\.?\/+/, "").replace(/\/+$/, "");
  if (!clean) {
    return true;
  }
  if (!GLOB_CHARACTERS.test(clean)) {
    return path === clean || path.startsWith(`${clean}/`);
  }
  return patternToRegExp(clean).test(path);
}

export function matchesAnyRepositoryPath(paths: string[], patterns: string[]) {
  return paths.some((path) =>
    patterns.some((pattern) => matchesRepositoryPath(path, pattern))
  );
}

export function outsidePathsReason(patterns: string[]) {
  return `no changed files under ${patterns.join(", ")}`;
}

/**
 * One-click authors to skip: the bots seen in your repositories (or the
 * well-known ones when there are none), then people whose pull requests are
 * mostly chores. Added ones drop out.
 */
export function autopilotAuthorPresets(
  authors: AutopilotAuthorSuggestion[],
  excluded: string[]
) {
  const repositoryBots = authors
    .filter((author) => author.bot)
    .map((author) => author.login);
  const choreAuthors = authors
    .filter(
      (author) =>
        !author.bot &&
        author.pullRequests >= AUTOPILOT_CHORE_AUTHOR_MIN_PULL_REQUESTS &&
        author.chores / author.pullRequests >= AUTOPILOT_CHORE_AUTHOR_MIN_SHARE
    )
    .map((author) => author.login);
  const bots =
    repositoryBots.length > 0 ? repositoryBots : AUTOPILOT_WELL_KNOWN_BOTS;
  const listed = new Set(excluded);
  return [...new Set([...bots, ...choreAuthors])]
    .filter((login) => !listed.has(login))
    .slice(0, AUTOPILOT_AUTHOR_PRESETS_SHOWN);
}
