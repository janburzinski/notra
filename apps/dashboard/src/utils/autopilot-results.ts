import type { AutopilotFindingEvidence } from "@notra/db/types/autopilot";
import { siteEntryTrafficPaths } from "@notra/sites-core/utils/entries";

import { markdownFileSlug, normalizePagePath } from "@/utils/autopilot-paths";

/** A page known by its exact path, or only by the slug its file renders under. */
export interface AutopilotResultPage {
  match: "path" | "slug";
  value: string;
}

interface AiVisitRow {
  path: string;
  visitorType: string;
  answering: boolean;
  visits: number;
}

interface HumanViewRow {
  path: string;
  views: number;
}

/**
 * Where a merged finding's page lives: the page an update or refresh named,
 * the Site path of the file a new post added, or that file's slug.
 */
export function resultPage(
  evidence: AutopilotFindingEvidence,
  sitePath: (filePath: string) => string | null
): AutopilotResultPage | null {
  const url = evidence.updatePage?.url ?? evidence.pageUrl;
  if (url) {
    try {
      return { match: "path", value: normalizePagePath(new URL(url).pathname) };
    } catch {
      return null;
    }
  }
  if (!evidence.filePath) {
    return null;
  }
  const path = sitePath(evidence.filePath);
  if (path) {
    return { match: "path", value: normalizePagePath(path) };
  }
  const slug = markdownFileSlug(evidence.filePath);
  return slug ? { match: "slug", value: slug } : null;
}

/** Every path a page's visits can be recorded under, for an exact traffic query. */
export function pageTrafficPaths(path: string) {
  const base = path === "/" ? "" : path;
  return [
    ...new Set([
      path,
      `${base}/`,
      `${base}.html`,
      ...siteEntryTrafficPaths(base).filter(Boolean),
    ]),
  ];
}

function isPage(page: AutopilotResultPage, path: string) {
  const normalized = normalizePagePath(path);
  return page.match === "path"
    ? normalized === page.value
    : normalized.split("/").at(-1) === page.value;
}

/**
 * Sums the page's rows; its Markdown, index and trailing-slash copies count
 * too. Null AI rows mean they are unknown; human views a cut-off list does not
 * contain are unknown, not zero.
 */
export function addPageVisits(
  page: AutopilotResultPage,
  visits: {
    ai: AiVisitRow[] | null;
    human: HumanViewRow[];
    humanCutOff: boolean;
  }
) {
  let ai: {
    aiCrawls: number;
    aiAnswerFetches: number;
    aiClicks: number;
  } | null = null;
  if (visits.ai) {
    ai = { aiCrawls: 0, aiAnswerFetches: 0, aiClicks: 0 };
    for (const row of visits.ai) {
      if (!isPage(page, row.path)) {
        continue;
      }
      if (row.visitorType === "crawler") {
        ai.aiCrawls += row.visits;
        if (row.answering) {
          ai.aiAnswerFetches += row.visits;
        }
      } else if (row.visitorType === "ai_referral") {
        ai.aiClicks += row.visits;
      }
    }
  }
  const human = visits.human.filter((row) => isPage(page, row.path));
  return {
    aiCrawls: ai?.aiCrawls ?? null,
    aiAnswerFetches: ai?.aiAnswerFetches ?? null,
    aiClicks: ai?.aiClicks ?? null,
    humanViews:
      human.length === 0 && visits.humanCutOff
        ? null
        : human.reduce((sum, row) => sum + row.views, 0),
  };
}
