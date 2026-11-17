import { gapScanIds } from "@notra/geo-core/geo/prompts";

import {
  AUTOPILOT_ALTERNATIVES_PROMPT_PATTERN,
  AUTOPILOT_ANSWER_EXCERPT_MAX_CHARS,
  AUTOPILOT_ANSWERS_BEGIN,
  AUTOPILOT_ANSWERS_END,
  AUTOPILOT_ANSWERS_SECTION,
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
  AUTOPILOT_REFRESH_MIN_RECENT_ANSWERS,
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

/**
 * Text from outside (answers, other sites) with the fence markers taken out,
 * so it can't close the fence early and slip past the fact check.
 */
function fenceSafe(text: string) {
  return text
    .replaceAll(AUTOPILOT_ANSWERS_BEGIN, "")
    .replaceAll(AUTOPILOT_ANSWERS_END, "");
}

/**
 * Per prompt the brand is missing from: the pages those answers cite most,
 * leaving out the brand's own.
 */
export function citedInsteadByPrompt(
  checks: readonly AutopilotAnswerCheck[],
  ownedHosts: readonly string[]
) {
  // Per prompt, each page once per answer, keyed so /guide#a and /guide#b
  // are one page; the first URL seen is the one fetched.
  const pages = new Map<
    string,
    Map<string, { url: string; answers: number }>
  >();
  for (const check of checks) {
    if (check.mentioned) {
      continue;
    }
    const byKey = pages.get(check.promptId) ?? new Map();
    pages.set(check.promptId, byKey);
    const seen = new Set<string>();
    for (const url of check.sourceUrls) {
      const key = citationKey(url);
      if (!key || seen.has(key) || isOwnedKey(key, ownedHosts)) {
        continue;
      }
      seen.add(key);
      const page = byKey.get(key);
      byKey.set(key, {
        url: page?.url ?? url,
        answers: (page?.answers ?? 0) + 1,
      });
    }
  }
  return new Map(
    [...pages].map(([promptId, byKey]) => [
      promptId,
      [...byKey.entries()]
        .sort((a, b) => b[1].answers - a[1].answers || a[0].localeCompare(b[0]))
        .slice(0, AUTOPILOT_REFRESH_MAX_CITED_INSTEAD)
        .map(([, page]) => page.url),
    ])
  );
}

/**
 * The pages AI answers cite instead of the brand, for the writer to cover
 * and beat. Fenced like the answers, so the fact check never treats them as
 * a source.
 */
export function describeCitedPages(
  pages: readonly { url: string; markdown: string }[]
) {
  if (pages.length === 0) {
    return "";
  }
  return [
    AUTOPILOT_ANSWERS_BEGIN,
    "Pages the AI answers cite instead of the brand. Cover what they cover and answer the question better; never take facts about any product from them:",
    ...pages.flatMap((page) => [
      "",
      `Cited instead: ${page.url}`,
      fenceSafe(page.markdown),
    ]),
    AUTOPILOT_ANSWERS_END,
  ].join("\n");
}

/** What AI answers said and cited, fenced for the writer; empty when there is nothing. */
export function describeAnswers(params: {
  excerpts: readonly string[];
  citedUrls: readonly string[];
}) {
  const excerpts = params.excerpts
    .map((excerpt) =>
      fenceSafe(excerpt)
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, AUTOPILOT_ANSWER_EXCERPT_MAX_CHARS)
    )
    .filter(Boolean);
  if (excerpts.length === 0 && params.citedUrls.length === 0) {
    return "";
  }
  return [
    AUTOPILOT_ANSWERS_BEGIN,
    ...(excerpts.length
      ? ["What the answers say:", ...excerpts.map((excerpt) => `> ${excerpt}`)]
      : []),
    ...(params.citedUrls.length
      ? [
          "Pages the answers cite:",
          ...params.citedUrls.map((url) => `- ${url}`),
        ]
      : []),
    AUTOPILOT_ANSWERS_END,
  ].join("\n");
}

/** A brief without the AI answers, for use as a fact source. */
export function withoutAnswers(text: string) {
  return text.replace(AUTOPILOT_ANSWERS_SECTION, "");
}

/**
 * Per prompt the brand is missing from: what those answers said and the
 * pages they cited most.
 */
export function answersByPrompt(checks: readonly AutopilotAnswerCheck[]) {
  const missed = new Map<string, AutopilotAnswerCheck[]>();
  for (const check of checks) {
    if (!check.mentioned) {
      missed.set(check.promptId, [
        ...(missed.get(check.promptId) ?? []),
        check,
      ]);
    }
  }
  return new Map(
    [...missed].map(([promptId, rows]) => [
      promptId,
      describeAnswers({
        excerpts: rows
          .map((row) => row.excerpt)
          .filter((excerpt) => excerpt.trim())
          .slice(0, AUTOPILOT_COMPARISONS_MAX_EXCERPTS),
        citedUrls: countTop(
          rows.flatMap((row) => row.sourceUrls),
          AUTOPILOT_REFRESH_MAX_CITED_INSTEAD
        ),
      }),
    ])
  );
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
    // An answer that lists no sources could not have cited the page.
    .filter(
      (check) =>
        check.capturedAt.getTime() >= previousStart &&
        check.sourceUrls.length > 0
    )
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
    const onPrompts = rows.filter((row) => prompts.has(row.check.promptId));
    // Only engines scanned in both windows: dropping or adding an engine is
    // not a lost citation.
    const enginesIn = (recent: boolean) =>
      new Set(
        onPrompts
          .filter((row) => row.recent === recent)
          .map((row) => row.check.engine)
      );
    const earlierEngines = enginesIn(false);
    const latestEngines = enginesIn(true);
    const relevant = onPrompts.filter(
      (row) =>
        earlierEngines.has(row.check.engine) &&
        latestEngines.has(row.check.engine)
    );
    const before = relevant.filter((row) => !row.recent);
    const latest = relevant.filter((row) => row.recent);
    if (latest.length < AUTOPILOT_REFRESH_MIN_RECENT_ANSWERS) {
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

/**
 * An Autopilot post that shipped to win a prompt and did not: what the
 * engines answered and cited on that prompt since, as a refresh candidate.
 */
export function underperformingCandidate(params: {
  findingId: string;
  url: string;
  path: string;
  promptId: string;
  before: number;
  after: number;
  mergedDaysAgo: number;
  checks: readonly AutopilotAnswerCheck[];
  ownedHosts: readonly string[];
}): AutopilotCitationCandidate | null {
  const key = citationKey(params.url);
  if (!key) {
    return null;
  }
  // Custom prompts are scanned under their own ID, as the impact reads them.
  const scanIds = new Set(gapScanIds(params.promptId));
  const missed = params.checks.filter(
    (check) => scanIds.has(check.promptId) && !check.mentioned
  );
  return {
    url: params.url,
    key: `${key}#underperforming`,
    promptIds: [params.promptId],
    path: params.path,
    underperforming: {
      findingId: params.findingId,
      mergedDaysAgo: params.mergedDaysAgo,
      promptId: params.promptId,
    },
    drop: {
      before: params.before,
      now: params.after,
      lostPrompts: [...new Set(missed.map((check) => check.prompt))].slice(
        0,
        1
      ),
      citedInstead: countTop(
        missed.flatMap((check) =>
          [
            ...new Set(
              check.sourceUrls.filter((url) => {
                const other = citationKey(url);
                return other !== null && !isOwnedKey(other, params.ownedHosts);
              })
            ),
          ].map((url) => url.split("#")[0] ?? url)
        ),
        AUTOPILOT_REFRESH_MAX_CITED_INSTEAD
      ),
      searches: uniqueSearches(missed),
    },
    score: 0,
  };
}
