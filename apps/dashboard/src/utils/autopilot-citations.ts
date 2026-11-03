import {
  AUTOPILOT_ALTERNATIVES_PROMPT_PATTERN,
  AUTOPILOT_COMPARISON_PATH_PATTERN,
  AUTOPILOT_COMPARISON_PROMPT_PATTERN,
  AUTOPILOT_COMPARISONS_MAX_EXCERPTS,
  AUTOPILOT_COMPARISONS_MIN_LOSSES,
  AUTOPILOT_PAGE_FILE,
} from "@/constants/autopilot-comparisons";
import {
  AUTOPILOT_REFRESH_MAX_CITED_INSTEAD,
  AUTOPILOT_REFRESH_MAX_SEARCHES,
  AUTOPILOT_REFRESH_MIN_CITATIONS,
  AUTOPILOT_REFRESH_MIN_DROP,
} from "@/constants/autopilot-refresh";
import type {
  AutopilotAnswerCheck,
  AutopilotCitationCandidate,
  AutopilotComparisonCandidate,
} from "@/types/autopilot-templates-runtime";
import { autopilotBlogSlug } from "@/utils/autopilot-blog";

const WWW = /^www\./;
const TRAILING_SLASHES = /\/+$/;

/** "https://www.acme.com/blog/post/?utm=x#top" → "acme.com/blog/post"; null when not a URL. */
export function citationKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
      return null;
    }
    const host = parsed.hostname.toLowerCase().replace(WWW, "");
    const path = decodeURIComponent(parsed.pathname).replace(
      TRAILING_SLASHES,
      ""
    );
    return `${host}${path.toLowerCase()}`;
  } catch {
    return null;
  }
}

function hostOf(key: string) {
  return key.split("/")[0] ?? "";
}

/** Whether a citation key's host is one of the brand's, subdomains included. */
export function isOwnedKey(key: string, ownedHosts: readonly string[]) {
  const host = hostOf(key);
  return ownedHosts.some(
    (owned) => host === owned || host.endsWith(`.${owned}`)
  );
}

function countTop(values: string[], max: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([value]) => value);
}

function uniqueSearches(checks: AutopilotAnswerCheck[]) {
  const seen = new Map<string, string>();
  for (const query of checks.flatMap((check) => check.queries)) {
    const trimmed = query.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.set(trimmed.toLowerCase(), trimmed);
    }
  }
  return [...seen.values()].slice(0, AUTOPILOT_REFRESH_MAX_SEARCHES);
}

/**
 * Owned pages whose citation rate fell between the earlier window and the
 * latest one, on the prompts that cited them before. Rates, not counts, so a
 * workspace that scans more often in one window doesn't look like a drop.
 * Prompts without answers in the latest window say nothing and are left out.
 */
export function findCitationDrops(params: {
  checks: AutopilotAnswerCheck[];
  ownedHosts: readonly string[];
  now: Date;
  windowMs: number;
}): AutopilotCitationCandidate[] {
  const { ownedHosts, windowMs } = params;
  const recentStart = params.now.getTime() - windowMs;
  const previousStart = recentStart - windowMs;
  const rows = params.checks
    .filter((check) => check.capturedAt.getTime() >= previousStart)
    .map((check) => {
      const cited = new Map<string, string>();
      for (const url of check.sourceUrls) {
        const key = citationKey(url);
        if (key && isOwnedKey(key, ownedHosts) && !cited.has(key)) {
          cited.set(key, url);
        }
      }
      return {
        check,
        recent: check.capturedAt.getTime() >= recentStart,
        cited,
      };
    });

  const urls = new Map<string, string>();
  const previousPrompts = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.recent) {
      continue;
    }
    for (const [key, url] of row.cited) {
      // Engines cite one page as /post and /post/; link the shortest form.
      const known = urls.get(key);
      urls.set(key, known && known.length <= url.length ? known : url);
      const prompts = previousPrompts.get(key) ?? new Set<string>();
      prompts.add(row.check.promptId);
      previousPrompts.set(key, prompts);
    }
  }

  const candidates: AutopilotCitationCandidate[] = [];
  for (const [key, prompts] of previousPrompts) {
    const relevant = rows.filter((row) => prompts.has(row.check.promptId));
    const before = relevant.filter((row) => !row.recent);
    const latest = relevant.filter((row) => row.recent);
    if (latest.length === 0) {
      continue;
    }
    const citedBefore = before.filter((row) => row.cited.has(key)).length;
    const citedNow = latest.filter((row) => row.cited.has(key)).length;
    if (citedBefore < AUTOPILOT_REFRESH_MIN_CITATIONS) {
      continue;
    }
    const beforeRate = citedBefore / before.length;
    const nowRate = citedNow / latest.length;
    if (nowRate > beforeRate * (1 - AUTOPILOT_REFRESH_MIN_DROP)) {
      continue;
    }
    // A prompt is lost when its own citation rate halved, not only at zero:
    // 10 of 10 down to 1 of 10 is a loss too.
    const rateOf = (rows: typeof relevant, promptId: string) => {
      const answers = rows.filter((row) => row.check.promptId === promptId);
      return answers.length === 0
        ? null
        : answers.filter((row) => row.cited.has(key)).length / answers.length;
    };
    const lostPromptIds = [...prompts].filter((promptId) => {
      const was = rateOf(before, promptId);
      const is = rateOf(latest, promptId);
      return (
        was !== null &&
        is !== null &&
        was > 0 &&
        is <= was * (1 - AUTOPILOT_REFRESH_MIN_DROP)
      );
    });
    if (lostPromptIds.length === 0) {
      continue;
    }
    const lostIds = new Set(lostPromptIds);
    const lost = latest.filter(
      (row) => lostIds.has(row.check.promptId) && !row.cited.has(key)
    );
    candidates.push({
      url: urls.get(key) ?? `https://${key}`,
      key,
      promptIds: [...prompts],
      drop: {
        before: beforeRate,
        now: nowRate,
        lostPrompts: lostPromptIds.map(
          (promptId) =>
            relevant.find((row) => row.check.promptId === promptId)?.check
              .prompt ?? promptId
        ),
        citedInstead: countTop(
          lost.flatMap((row) =>
            [
              ...new Set(
                row.check.sourceUrls.filter((url) => {
                  const other = citationKey(url);
                  return other !== null && !isOwnedKey(other, ownedHosts);
                })
              ),
            ].map((url) => url.split("#")[0] ?? url)
          ),
          AUTOPILOT_REFRESH_MAX_CITED_INSTEAD
        ),
        searches: uniqueSearches(lost.map((row) => row.check)),
      },
      score: (beforeRate - nowRate) * prompts.size,
    });
  }
  return candidates.sort(
    (a, b) => b.score - a.score || a.key.localeCompare(b.key)
  );
}

function isComparisonPrompt(prompt: string) {
  return AUTOPILOT_COMPARISON_PROMPT_PATTERN.test(prompt);
}

function mentionsName(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`,
    "iu"
  ).test(text);
}

/**
 * Competitors that AI answers to comparison questions name while leaving
 * the brand out, most losses first. A prompt that names the competitor is
 * enough on its own; otherwise it takes a few losing prompts.
 */
export function findComparisonCandidates(params: {
  checks: AutopilotAnswerCheck[];
  ignored: ReadonlySet<string>;
}): AutopilotComparisonCandidate[] {
  const losing = params.checks.filter(
    (check) => !check.mentioned && isComparisonPrompt(check.prompt)
  );
  const byCompetitor = new Map<
    string,
    { name: string; checks: AutopilotAnswerCheck[] }
  >();
  for (const check of losing) {
    for (const name of new Set(
      check.competitors.map((value) => value.trim())
    )) {
      const slug = autopilotBlogSlug(name);
      if (!slug || params.ignored.has(slug)) {
        continue;
      }
      const entry = byCompetitor.get(slug) ?? { name, checks: [] };
      entry.checks.push(check);
      byCompetitor.set(slug, entry);
    }
  }
  const candidates: (AutopilotComparisonCandidate & { named: number })[] = [];
  for (const { name, checks } of byCompetitor.values()) {
    const prompts = [...new Set(checks.map((check) => check.prompt))];
    const named = prompts.filter((prompt) => mentionsName(prompt, name));
    if (
      prompts.length < AUTOPILOT_COMPARISONS_MIN_LOSSES &&
      named.length === 0
    ) {
      continue;
    }
    const alternatives = named.some((prompt) =>
      AUTOPILOT_ALTERNATIVES_PROMPT_PATTERN.test(prompt)
    );
    const namedSet = new Set(named);
    const ordered = [
      ...named,
      ...prompts.filter((prompt) => !namedSet.has(prompt)),
    ];
    const lead = checks.find((check) => check.prompt === ordered[0]);
    const leadAnswers = params.checks.filter(
      (check) => check.promptId === lead?.promptId
    );
    candidates.push({
      competitor: name,
      format: alternatives ? "alternatives" : "versus",
      prompts: ordered,
      named: named.length,
      losses: prompts.length,
      promptId: lead?.promptId ?? "",
      mentionRate:
        leadAnswers.filter((check) => check.mentioned).length /
        Math.max(leadAnswers.length, 1),
      excerpts: checks
        .map((check) => check.excerpt.trim())
        .filter(Boolean)
        .slice(0, AUTOPILOT_COMPARISONS_MAX_EXCERPTS),
      searches: uniqueSearches(checks),
      citedUrls: countTop(
        checks.flatMap((check) => check.sourceUrls),
        AUTOPILOT_REFRESH_MAX_CITED_INSTEAD
      ),
    });
  }
  // Questions that name the competitor are the clearest ask for this page.
  return candidates
    .sort(
      (a, b) =>
        b.named - a.named ||
        b.losses - a.losses ||
        a.competitor.localeCompare(b.competitor)
    )
    .map(({ named: _named, ...candidate }) => candidate);
}

/** Whether the repository already has a comparison or alternatives page for this competitor. */
export function hasComparisonPage(
  paths: readonly string[],
  competitor: string
) {
  const slug = autopilotBlogSlug(competitor);
  if (!slug) {
    return false;
  }
  return paths.some((path) => {
    const lower = path.toLowerCase();
    return (
      AUTOPILOT_PAGE_FILE.test(lower) &&
      lower.includes(slug) &&
      AUTOPILOT_COMPARISON_PATH_PATTERN.test(lower)
    );
  });
}

export function comparisonFingerprint(competitor: string) {
  return `comparisons:${autopilotBlogSlug(competitor)}`;
}

export function refreshFingerprint(key: string) {
  return `refresh:${key}`;
}
