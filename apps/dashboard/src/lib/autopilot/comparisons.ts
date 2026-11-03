import { db } from "@notra/db/drizzle";
import { geoCompetitors } from "@notra/db/schema";
import { promptIdFromScanId } from "@notra/geo-core/geo/prompts";
import { and, eq, sql } from "drizzle-orm";

import {
  AUTOPILOT_COMPARISONS_COMPETITOR_PAGE_MAX_CHARS,
  AUTOPILOT_COMPARISONS_LOOKBACK_MS,
  AUTOPILOT_COMPARISONS_MAX_CHECKS,
} from "@/constants/autopilot-comparisons";
import {
  loadAnswerChecks,
  loadIgnoredCompetitors,
} from "@/lib/autopilot/answers";
import {
  countOpenPullRequests,
  hasOpenProposal,
  listSettledFingerprints,
  syncFindingPullRequests,
} from "@/lib/autopilot/findings";
import {
  getRepositoryOctokit,
  listRepositoryPaths,
} from "@/lib/autopilot/github";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { fetchRendered } from "@/lib/autopilot/pages";
import type { AutopilotProposal, AutopilotRunContext } from "@/types/autopilot";
import type { AutopilotPostBrief } from "@/types/autopilot-runtime";
import type { AutopilotComparisonCandidate } from "@/types/autopilot-templates-runtime";
import { autopilotBlogSlug } from "@/utils/autopilot-blog";
import {
  comparisonFingerprint,
  findComparisonCandidates,
  hasComparisonPage,
} from "@/utils/autopilot-citations";

/**
 * Comparison pages are written on an evidence trigger the workspace turned
 * on, not on the planner's hunch: they count against the draft limit like
 * any automatic pull request but skip the confidence gate.
 */
const COMPARISON_CONFIDENCE = 1;

export type AutopilotComparisonPick =
  | { ready: false; reason: string }
  | {
      ready: true;
      proposal: AutopilotProposal;
      brief: AutopilotPostBrief;
      confidence: number;
    };

async function competitorDomain(projectId: string, name: string) {
  const row = await db.query.geoCompetitors.findFirst({
    columns: { domain: true },
    where: and(
      eq(geoCompetitors.projectId, projectId),
      sql`lower(${geoCompetitors.name}) = ${name.toLowerCase()}`
    ),
  });
  return row?.domain ?? null;
}

/** The competitor's homepage and pricing page: the facts a comparison quotes most. */
async function readCompetitorSite(domain: string | null) {
  if (!domain) {
    return [];
  }
  const origin = (
    domain.includes("://") ? domain : `https://${domain}`
  ).replace(/\/+$/, "");
  const pages = await Promise.all(
    [origin, `${origin}/pricing`].map(async (url) => {
      try {
        const page = await fetchRendered(
          url,
          AUTOPILOT_COMPARISONS_COMPETITOR_PAGE_MAX_CHARS
        );
        return page.markdown.trim() ? { url, markdown: page.markdown } : null;
      } catch {
        return null;
      }
    })
  );
  return pages.filter((page) => page !== null);
}

function comparisonBrief(params: {
  ctx: AutopilotRunContext;
  candidate: AutopilotComparisonCandidate;
  site: { url: string; markdown: string }[];
}): AutopilotPostBrief {
  const { ctx, candidate, site } = params;
  const brand = ctx.brand?.name ?? "the brand";
  const month = new Date().toLocaleString("en", {
    month: "long",
    year: "numeric",
  });
  const topic =
    candidate.format === "alternatives"
      ? `${candidate.competitor} alternatives`
      : `${brand} vs ${candidate.competitor}`;
  return {
    topic,
    angle: [
      candidate.format === "alternatives"
        ? `A fair guide for people looking for an alternative to ${candidate.competitor}, with ${brand} as one honest option among the ones AI answers name.`
        : `A fair comparison for people choosing between ${brand} and ${candidate.competitor}.`,
      "Open with a two-sentence answer: who each one is for. Then a comparison table on the points the AI answers and searches below bring up, where each is stronger, when to pick the other one, and how switching works.",
      `State facts about ${candidate.competitor} only from its own site below or the answers, and mark prices and limits as of ${month}. Never claim anything about ${candidate.competitor} you can't source; leave a row out instead.`,
    ].join(" "),
    evidence: [
      `Comparison questions where AI answers name ${candidate.competitor} and not ${brand}:`,
      ...candidate.prompts.map((prompt) => `- ${prompt}`),
      ...(candidate.searches.length
        ? [
            "What the engines searched while answering:",
            ...candidate.searches.map((query) => `- ${query}`),
          ]
        : []),
      ...(candidate.excerpts.length
        ? [
            "What the answers say:",
            ...candidate.excerpts.map((excerpt) => `> ${excerpt}`),
          ]
        : []),
      ...(candidate.citedUrls.length
        ? [
            "Pages the answers cite:",
            ...candidate.citedUrls.map((url) => `- ${url}`),
          ]
        : []),
      ...site.flatMap((page) => [
        `${candidate.competitor}'s own site (${page.url}):`,
        page.markdown,
      ]),
    ].join("\n"),
  };
}

/**
 * The competitor most worth a comparison page: named in comparison answers
 * that leave the brand out, with no comparison page in the repository yet.
 */
export async function pickComparison(
  ctx: AutopilotRunContext
): Promise<AutopilotComparisonPick> {
  // Off by default: a workspace that never turned it on gets no log lines.
  if (!ctx.jobs.comparisons) {
    return { ready: false, reason: "Turned off in settings" };
  }
  const log = createAutopilotLogger(ctx, "comparisons");
  const skip = async (reason: string) => {
    await log.skip(reason);
    return { ready: false as const, reason };
  };
  if (!ctx.repository) {
    return skip("No website repository connected");
  }
  if (!ctx.projectId) {
    return skip("No GEO project to read AI answers from");
  }
  await syncFindingPullRequests(ctx.organizationId);
  const open = await countOpenPullRequests(ctx.organizationId);
  if (open >= ctx.maxOpenPullRequests) {
    return skip(
      `${open} of ${ctx.maxOpenPullRequests} pull requests are still open`
    );
  }
  if (await hasOpenProposal(ctx.organizationId, ["comparisons"])) {
    return skip("A comparison page is still waiting for review");
  }
  const octokit = await getRepositoryOctokit(
    ctx.organizationId,
    ctx.repository
  );
  const [checks, ignored, settled, paths] = await Promise.all([
    loadAnswerChecks({
      projectId: ctx.projectId,
      since: new Date(Date.now() - AUTOPILOT_COMPARISONS_LOOKBACK_MS),
      limit: AUTOPILOT_COMPARISONS_MAX_CHECKS,
    }),
    loadIgnoredCompetitors(ctx.projectId),
    listSettledFingerprints(ctx.organizationId, "comparisons"),
    listRepositoryPaths(octokit, ctx.repository),
  ]);
  const brandSlug = autopilotBlogSlug(ctx.brand?.name ?? "");
  const candidates = findComparisonCandidates({
    checks,
    ignored: new Set([...ignored, brandSlug]),
  });
  const dropped: string[] = [];
  const fresh = candidates.filter((candidate) => {
    if (settled.has(comparisonFingerprint(candidate.competitor))) {
      dropped.push(
        `${candidate.competitor}: already proposed, merged or dismissed`
      );
      return false;
    }
    if (hasComparisonPage(paths, candidate.competitor)) {
      dropped.push(`${candidate.competitor}: the site has a comparison page`);
      return false;
    }
    return true;
  });
  await log.decision(
    `${fresh.length} competitors win comparison questions you don't show up for`,
    {
      answers: checks.length,
      candidates: fresh
        .slice(0, 5)
        .map(
          (candidate) =>
            `${candidate.competitor}: ${candidate.losses} questions (${candidate.format})`
        ),
      dropped,
    }
  );
  const [candidate] = fresh;
  if (!candidate) {
    return { ready: false, reason: "No comparison page to write" };
  }
  const site = await readCompetitorSite(
    await competitorDomain(ctx.projectId, candidate.competitor)
  );
  if (site.length > 0) {
    await log.info(`Read ${candidate.competitor}'s site for facts`, {
      files: site.map((page) => page.url),
    });
  }
  const brief = comparisonBrief({ ctx, candidate, site });
  const summary = `AI answers to ${candidate.losses} comparison questions name ${candidate.competitor} and not ${ctx.brand?.name ?? "you"}.`;
  return {
    ready: true,
    confidence: COMPARISON_CONFIDENCE,
    brief,
    proposal: {
      kind: "comparisons",
      fingerprint: comparisonFingerprint(candidate.competitor),
      title: `Comparison page: ${brief.topic}`,
      summary,
      evidence: {
        competitors: [candidate.competitor],
        detail: summary,
        comparison: {
          competitor: candidate.competitor,
          format: candidate.format,
          prompts: candidate.prompts,
        },
        ...(candidate.promptId
          ? {
              target: {
                kind: "prompt" as const,
                promptId: promptIdFromScanId(candidate.promptId),
                before: candidate.mentionRate,
              },
            }
          : {}),
      },
    },
  };
}
