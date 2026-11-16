import { findNewActiveContent } from "@notra/ai/utils/github-mention-content-policy";
import type {
  GeoAiSearchGapRow,
  GeoPromptGapRow,
  GeoSearchGapRow,
} from "@notra/geo-core/types/geo";
import { repositoryContentDirectoryConfigSchema } from "@notra/schemas/dashboard/integrations";
import { slugify } from "@notra/utils/slugify";

import {
  AUTOPILOT_BLOG_DIRECTORY_FALLBACK,
  AUTOPILOT_BLOG_DIRECTORY_HINTS,
  AUTOPILOT_BLOG_SLUG_MAX_CHARS,
  AUTOPILOT_GAP_SEARCHES_SHOWN,
  AUTOPILOT_KEYWORD_MAX_MENTION_RATE,
  AUTOPILOT_MARKDOWN_FILE,
  AUTOPILOT_SEARCH_GAP_MIN_IMPRESSIONS,
  AUTOPILOT_WORKSPACE_ROOTS,
  AUTOPILOT_WRITER_MAX_QUESTIONS,
} from "@/constants/autopilot";
import { AUTOPILOT_COMPARISON_DIRECTORY_HINTS } from "@/constants/autopilot-comparisons";
import { normalizeRepositoryDirectory } from "@/utils/autopilot-paths";

export function autopilotBlogSlug(value: string) {
  return slugify(value).slice(0, AUTOPILOT_BLOG_SLUG_MAX_CHARS);
}

export function keywordFingerprint(keyword: string) {
  return `keyword:${autopilotBlogSlug(keyword)}`;
}

/**
 * Where Autopilot writes posts: the Autopilot setting, then the GitHub
 * publishing path, then a detected blog folder, then the default.
 */
export function detectBlogDirectory(
  paths: string[],
  configured: { setting: string | null; integration: string | null }
) {
  for (const path of [configured.setting, configured.integration]) {
    const directory = path && normalizeRepositoryDirectory(path);
    if (directory) {
      return directory;
    }
  }
  return findBlogDirectory(paths) ?? AUTOPILOT_BLOG_DIRECTORY_FALLBACK;
}

/**
 * The hinted folder with the most posts, at the root or inside a workspace
 * (apps/web/src/content/blog). Ties go to the earlier hint, then the root,
 * then the path, so the same tree always gives the same folder.
 */
function findBlogDirectory(paths: string[]) {
  const candidates = new Map<
    string,
    { posts: number; hint: number; depth: number }
  >();
  for (const path of paths) {
    if (!AUTOPILOT_MARKDOWN_FILE.test(path)) {
      continue;
    }
    const [root, workspace] = path.split("/");
    const prefixes = [""];
    if (root && workspace && AUTOPILOT_WORKSPACE_ROOTS.includes(root)) {
      prefixes.push(`${root}/${workspace}/`);
    }
    for (const prefix of prefixes) {
      AUTOPILOT_BLOG_DIRECTORY_HINTS.forEach((hint, index) => {
        const directory = `${prefix}${hint}`;
        if (path.startsWith(`${directory}/`)) {
          const candidate = candidates.get(directory);
          candidates.set(directory, {
            posts: (candidate?.posts ?? 0) + 1,
            hint: index,
            depth: prefix ? 1 : 0,
          });
        }
      });
    }
  }
  return (
    [...candidates.entries()].sort(
      ([pathA, a], [pathB, b]) =>
        b.posts - a.posts ||
        a.hint - b.hint ||
        a.depth - b.depth ||
        (pathA < pathB ? -1 : 1)
    )[0]?.[0] ?? null
  );
}

/** The folder a GitHub integration's blog publishing settings point at, if any. */
export function integrationBlogDirectory(config: unknown) {
  const parsed = repositoryContentDirectoryConfigSchema.safeParse(config);
  if (!parsed.success) {
    return null;
  }
  const { contentPath, directory } = parsed.data;
  if (!contentPath) {
    return directory ? normalizeRepositoryDirectory(directory) : null;
  }
  // "apps/web/src/content/blog/:slug.mdx" → "apps/web/src/content/blog"
  const segments = contentPath.split("/");
  const folder = segments
    .slice(
      0,
      segments.findIndex((segment) => segment.includes(":slug"))
    )
    .join("/");
  return folder ? normalizeRepositoryDirectory(folder) : null;
}

/** A directory the site keeps comparison pages in, when it has one with Markdown. */
export function detectComparisonDirectory(paths: string[]) {
  const markdown = paths.filter((path) => AUTOPILOT_MARKDOWN_FILE.test(path));
  return (
    AUTOPILOT_COMPARISON_DIRECTORY_HINTS.find((hint) =>
      markdown.some((path) => path.startsWith(`${hint}/`))
    ) ?? null
  );
}

/** Reject executable MDX that wasn't present in the repository's sample. */
export function assertNoActiveContent(
  path: string,
  sample: string | null,
  next: string
) {
  const findings = findNewActiveContent({ path, previous: sample, next });
  if (findings.length > 0) {
    throw new Error(
      `The draft contains executable content Autopilot does not commit: ${findings.map((finding) => `${finding.reason} (${finding.line})`).join("; ")}`
    );
  }
}

export function pageToUpdate(
  recommendation: GeoSearchGapRow["recommendation"] | undefined
) {
  const page = recommendation?.targets[0];
  return recommendation?.action === "update" && page?.url
    ? { url: page.url, title: page.title }
    : null;
}

function queriesByImpressions(gap: GeoSearchGapRow) {
  return [...gap.queries].sort((a, b) => b.impressions - a.impressions);
}

export function topQuery(gap: GeoSearchGapRow) {
  return queriesByImpressions(gap)[0];
}

/**
 * Who AI answers name instead of the brand. Workspaces that track no
 * competitors yet still have the names the answers brought up.
 */
export function promptGapCompetitors(gap: GeoPromptGapRow) {
  return gap.competitors.length > 0
    ? gap.competitors
    : (gap.discoveredCompetitors ?? []);
}

export function promptGapDropReason(gap: GeoPromptGapRow) {
  if (gap.won) {
    return "You already win this prompt";
  }
  if (gap.brief) {
    return "A GEO brief exists for it";
  }
  if (promptGapCompetitors(gap).length === 0) {
    return "No competitor shows up either";
  }
  if (gap.ownMentionRate > AUTOPILOT_KEYWORD_MAX_MENTION_RATE) {
    return `You show up in ${Math.round(gap.ownMentionRate * 100)}% of answers (limit ${Math.round(AUTOPILOT_KEYWORD_MAX_MENTION_RATE * 100)}%)`;
  }
  return null;
}

/**
 * What the planner and Jev weigh a prompt gap by: on how many engines the
 * brand is missing, who is named instead and how people phrased the search.
 */
export function describePromptGap(gap: GeoPromptGapRow) {
  // engines lists only the engines that missed the brand.
  const missed = gap.engines.length;
  const searches = gap.searchQueries
    .slice(0, AUTOPILOT_GAP_SEARCHES_SHOWN)
    .map((query) => `"${query}"`)
    .join(", ");
  return `AI engines answer "${gap.prompt}" without you on ${missed} of ${gap.engineCoverage} engines (${Math.round(gap.ownMentionRate * 100)}% mention you), while ${promptGapCompetitors(gap).slice(0, 3).join(", ")} show up.${searches ? ` They searched for ${searches}.` : ""}`;
}

/**
 * Every kind of demand gets a turn: prompt gaps alone would take every slot,
 * and search gaps carry the only real volume numbers.
 */
export function interleave<T>(...lists: readonly (readonly T[])[]) {
  return Array.from(
    { length: Math.max(0, ...lists.map((list) => list.length)) },
    (_, index) => lists.map((list) => list[index])
  )
    .flat()
    .filter((item): item is T => item !== undefined);
}

/** Who the answers that ran the search named instead of the brand. */
export function aiSearchGapCompetitors(gap: GeoAiSearchGapRow) {
  return gap.competitors.length > 0
    ? gap.competitors
    : gap.discoveredCompetitors;
}

export function aiSearchGapDropReason(gap: GeoAiSearchGapRow) {
  if (gap.brief) {
    return "A GEO brief exists for it";
  }
  if (!gap.promptIds?.length) {
    return "No tracked prompt to measure it on";
  }
  if (aiSearchGapCompetitors(gap).length === 0) {
    return "No competitor shows up either";
  }
  if (gap.ownMentionRate > AUTOPILOT_KEYWORD_MAX_MENTION_RATE) {
    return `You show up in ${Math.round(gap.ownMentionRate * 100)}% of answers (limit ${Math.round(AUTOPILOT_KEYWORD_MAX_MENTION_RATE * 100)}%)`;
  }
  return null;
}

/**
 * What the planner and Jev weigh an AI search gap by: how often engines ran
 * the search, for which prompts, and who they named instead of the brand.
 */
export function describeAiSearchGap(gap: GeoAiSearchGapRow) {
  const prompts = gap.prompts
    .slice(0, AUTOPILOT_GAP_SEARCHES_SHOWN)
    .map((prompt) => `"${prompt}"`)
    .join(", ");
  return `AI engines searched for "${gap.query}" ${gap.searches} times without finding you (${Math.round(gap.ownMentionRate * 100)}% of those answers mention you), while ${aiSearchGapCompetitors(gap).slice(0, 3).join(", ")} show up.${prompts ? ` They searched it to answer ${prompts}.` : ""}`;
}

export function searchGapDropReason(gap: GeoSearchGapRow) {
  if (gap.brief) {
    return "A GEO brief exists for it";
  }
  const action = gap.recommendation.action;
  if (action === "update" && !gap.recommendation.targets[0]?.url) {
    return "An existing page covers it, but it has no URL to update";
  }
  if (action !== "create" && action !== "update") {
    return `Existing content covers it (${action})`;
  }
  if ((gap.impressions ?? 0) < AUTOPILOT_SEARCH_GAP_MIN_IMPRESSIONS) {
    return `${gap.impressions ?? 0} impressions (minimum ${AUTOPILOT_SEARCH_GAP_MIN_IMPRESSIONS})`;
  }
  return null;
}

/**
 * The questions people ask that the brand tracks: AI prompts, the searches
 * behind them and Search Console queries, most valuable first. A post about
 * shipped work picks the one it answers instead of announcing the release.
 */
export function questionsPeopleAsk(gaps: {
  promptGaps: readonly GeoPromptGapRow[];
  searchGaps: readonly GeoSearchGapRow[];
}) {
  const prompts = [...gaps.promptGaps]
    .sort((a, b) => b.opportunity - a.opportunity)
    .map((gap) => {
      const searches = gap.searchQueries
        .slice(0, AUTOPILOT_GAP_SEARCHES_SHOWN)
        .map((query) => `"${query}"`)
        .join(", ");
      return `"${gap.prompt}" (AI answers name the brand in ${Math.round(gap.ownMentionRate * 100)}%${searches ? `; also searched as ${searches}` : ""})`;
    });
  const searches = [...gaps.searchGaps]
    .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
    .map((gap) => {
      const queries = queriesByImpressions(gap)
        .slice(0, AUTOPILOT_GAP_SEARCHES_SHOWN)
        .map((query) => `"${query.query}"`)
        .join(", ");
      return `"${gap.prompt}" (Search Console: ${gap.impressions ?? 0} impressions${gap.position ? `, position ${Math.round(gap.position)}` : ""}${queries ? `; searched as ${queries}` : ""})`;
    });
  return [...new Set(interleave(prompts, searches))].slice(
    0,
    AUTOPILOT_WRITER_MAX_QUESTIONS
  );
}
