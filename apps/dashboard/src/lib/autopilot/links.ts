import { createGitHubMentionUsageCollector } from "@notra/ai/billing/github-mention-billing";
import { AGENT_DEFAULT_MODEL } from "@notra/ai/constants/models";
import {
  getGscIntegration,
  GscReauthRequiredError,
  queryGscQueryPages,
} from "@notra/ai/integrations/google-search-console";
import { db } from "@notra/db/drizzle";
import { geoSettings, projects } from "@notra/db/schema";
import type { AutopilotInternalLink } from "@notra/db/types/autopilot";
import { mapWithConcurrency } from "@notra/sites-server/utils/concurrency";
import { and, eq } from "drizzle-orm";

import {
  AUTOPILOT_MARKDOWN_FILE,
  AUTOPILOT_PULL_REQUEST_CREATED_EVENT,
} from "@/constants/autopilot";
import {
  AUTOPILOT_LINKS_COOLDOWN_MS,
  AUTOPILOT_LINKS_GSC_DAYS,
  AUTOPILOT_LINKS_GSC_ROW_LIMIT,
  AUTOPILOT_LINKS_MAX_CANDIDATES,
  AUTOPILOT_LINKS_MAX_OUTPUT_TOKENS,
  AUTOPILOT_LINKS_MAX_SOURCE_PAGES,
  AUTOPILOT_LINKS_PAGE_MAX_CHARS,
  AUTOPILOT_LINKS_PER_POST,
  AUTOPILOT_LINKS_READ_CONCURRENCY,
  AUTOPILOT_LINKS_REVIEW_INSTRUCTIONS,
} from "@/constants/autopilot-links";
import { AUTOPILOT_REFRESH_MAX_LINK_CHECKS } from "@/constants/autopilot-refresh";
import {
  claimFinding,
  countOpenPullRequests,
  findLatestProposal,
  hasOpenProposal,
  listSettledLinkPairs,
  markFindingFailed,
  markFindingProposed,
  markFindingWithoutChange,
  reserveDraftSlot,
  syncFindingPullRequests,
} from "@/lib/autopilot/findings";
import {
  closeAutopilotPullRequest,
  getBaseBranchSha,
  getRepositoryOctokit,
  listRepositoryPaths,
  openAutopilotPullRequest,
  readRepositoryFile,
} from "@/lib/autopilot/github";
import {
  assertAutopilotFindingLease,
  withAutopilotFindingLease,
} from "@/lib/autopilot/leases";
import { generateAutopilotObject } from "@/lib/autopilot/llm";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { fetchPageText, findDeadLinks } from "@/lib/autopilot/pages";
import { linksReviewSchema } from "@/schemas/autopilot";
import type { AutopilotRunContext } from "@/types/autopilot";
import type { FindingClaim } from "@/types/autopilot-runtime";
import type {
  AutopilotLinkSpot,
  AutopilotLinksCheck,
  AutopilotLinksFix,
} from "@/types/autopilot-templates-runtime";
import { assertNoActiveContent } from "@/utils/autopilot-blog";
import { autopilotDraftBranchSlug } from "@/utils/autopilot-branches";
import { citationKey } from "@/utils/autopilot-citations";
import {
  applyLinkSpots,
  findLinkSpots,
  linkPairKey,
  linksFingerprint,
  pickLinkTargets,
  plainWords,
  selectLinks,
  spotPhrase,
  toInternalLink,
} from "@/utils/autopilot-links";
import { findPagePath, isSafeRepositoryPath } from "@/utils/autopilot-paths";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The brand's own name and aliases; a query naming the brand is not a phrase to link. */
async function loadBrandTerms(ctx: AutopilotRunContext, projectId: string) {
  const settings = await db.query.geoSettings.findFirst({
    columns: { companyName: true, aliases: true },
    where: and(
      eq(geoSettings.organizationId, ctx.organizationId),
      eq(geoSettings.projectId, projectId)
    ),
  });
  return [
    ctx.brand?.name,
    settings?.companyName,
    ...(settings?.aliases ?? []),
  ].flatMap((term) => (term?.trim() ? [term.trim()] : []));
}

export async function checkLinks(
  ctx: AutopilotRunContext
): Promise<
  { ready: false; reason: string } | ({ ready: true } & AutopilotLinksCheck)
> {
  // Off by default: a workspace that never turned it on gets no log lines.
  if (!ctx.jobs.links) {
    return { ready: false, reason: "Turned off in settings" };
  }
  const log = createAutopilotLogger(ctx, "links");
  const skip = async (reason: string) => {
    await log.skip(reason);
    return { ready: false as const, reason };
  };
  if (!ctx.repository) {
    return skip("No website repository connected");
  }
  if (!ctx.projectId) {
    return skip("No GEO project to read Search Console from");
  }
  const [project, integration] = await Promise.all([
    db.query.projects.findFirst({
      columns: { gscSiteUrl: true },
      where: and(
        eq(projects.id, ctx.projectId),
        eq(projects.organizationId, ctx.organizationId)
      ),
    }),
    getGscIntegration(ctx.organizationId),
  ]);
  if (!integration || integration.disconnectingAt) {
    return skip("Search Console is not connected");
  }
  if (integration.status === "reauth_required") {
    return skip("Search Console needs to be reconnected");
  }
  if (!project?.gscSiteUrl) {
    return skip("No Search Console property is selected for this project");
  }
  await syncFindingPullRequests(ctx.organizationId);
  const open = await countOpenPullRequests(ctx.organizationId);
  if (open >= ctx.maxOpenPullRequests) {
    return skip(
      `${open} of ${ctx.maxOpenPullRequests} pull requests are still open`
    );
  }
  if (await hasOpenProposal(ctx.organizationId, ["links"])) {
    return skip("A links pull request is still waiting for review");
  }
  const latest = await findLatestProposal(ctx.organizationId, "links");
  const sinceLatest = latest?.openedAt
    ? Date.now() - latest.openedAt.getTime()
    : null;
  if (sinceLatest !== null && sinceLatest < AUTOPILOT_LINKS_COOLDOWN_MS) {
    const days = Math.floor(sinceLatest / DAY_MS);
    return skip(
      `The last links pull request opened ${days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"} ago`}; links wait a week so Google can see them`
    );
  }
  let rows: Awaited<ReturnType<typeof queryGscQueryPages>>;
  try {
    rows = await queryGscQueryPages(integration, {
      siteUrl: project.gscSiteUrl,
      days: AUTOPILOT_LINKS_GSC_DAYS,
      rowLimit: AUTOPILOT_LINKS_GSC_ROW_LIMIT,
    });
  } catch (error) {
    if (error instanceof GscReauthRequiredError) {
      return skip("Search Console needs to be reconnected");
    }
    throw error;
  }
  const targets = pickLinkTargets(
    rows,
    await loadBrandTerms(ctx, ctx.projectId)
  );
  await log.decision(
    `${targets.length} pages rank 4 to 20 for searches worth linking`,
    {
      rows: rows.length,
      candidates: targets
        .slice(0, 5)
        .map(
          (target) =>
            `${target.url}: position ${target.position}, ${target.impressions} impressions`
        ),
    }
  );
  if (targets.length === 0) {
    return { ready: false, reason: "No page ranks 4 to 20 for a search" };
  }

  const octokit = await getRepositoryOctokit(
    ctx.organizationId,
    ctx.repository
  );
  const baseSha = await getBaseBranchSha(octokit, ctx.repository);
  const paths = await listRepositoryPaths(octokit, ctx.repository, baseSha);
  const markdown = paths.filter((path) => AUTOPILOT_MARKDOWN_FILE.test(path));
  // Posts most seen in search first; only pages with a Markdown source can change.
  const seen = new Map<string, { url: string; impressions: number }>();
  for (const row of rows) {
    const key = citationKey(row.page);
    if (!key) {
      continue;
    }
    const page = seen.get(key) ?? {
      url: row.page.split("#")[0] ?? row.page,
      impressions: 0,
    };
    page.impressions += row.impressions;
    seen.set(key, page);
  }
  // Files match URLs by slug only, so a file two URLs claim (say /blog/scaling
  // and docs.…/scaling) has no certain address and is left alone. The rest
  // are confirmed against the live page before any link is offered.
  const claims = new Map<string, { url: string; impressions: number }[]>();
  for (const page of seen.values()) {
    const path = findPagePath(markdown, page.url);
    if (path && isSafeRepositoryPath(path)) {
      claims.set(path, [...(claims.get(path) ?? []), page]);
    }
  }
  const sources = [...claims.entries()]
    .flatMap(([path, pages]) =>
      pages.length === 1 && pages[0] ? [{ path, ...pages[0] }] : []
    )
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, AUTOPILOT_LINKS_MAX_SOURCE_PAGES);
  if (sources.length === 0) {
    return skip(
      "No page in Search Console renders from a Markdown file in the repository"
    );
  }
  const repository = ctx.repository;
  const posts = await mapWithConcurrency(
    sources,
    AUTOPILOT_LINKS_READ_CONCURRENCY,
    async (source) => {
      const content = await readRepositoryFile(
        octokit,
        repository,
        source.path,
        baseSha
      );
      return content && content.length <= AUTOPILOT_LINKS_PAGE_MAX_CHARS
        ? { ...source, content }
        : null;
    }
  );
  const settled = new Set(
    (await listSettledLinkPairs(ctx.organizationId)).map((link) =>
      linkPairKey(link.sourceUrl, link.targetUrl)
    )
  );
  const rank = new Map(targets.map((target, index) => [target.key, index]));
  const candidates = posts
    .flatMap((post) =>
      post
        ? findLinkSpots({
            content: post.content,
            sourceUrl: post.url,
            sourcePath: post.path,
            targets,
          })
        : []
    )
    .filter((spot) => !settled.has(linkPairKey(spot.sourceUrl, spot.targetUrl)))
    .sort((a, b) => (rank.get(a.targetKey) ?? 0) - (rank.get(b.targetKey) ?? 0))
    .slice(0, AUTOPILOT_LINKS_MAX_CANDIDATES);
  const live = await confirmLive(candidates);
  const kept = new Set(live);
  if (live.length < candidates.length) {
    await log.info(
      `Left out ${candidates.length - live.length} places whose post or linked page isn't live as found`,
      {
        reason: candidates
          .filter((spot) => !kept.has(spot))
          .slice(0, 5)
          .map(
            (spot) => `${spot.sourceUrl}: "${spot.text}" → ${spot.targetUrl}`
          ),
      }
    );
  }
  const spots: AutopilotLinkSpot[] = live.map((spot, index) => ({
    ...spot,
    id: `c${index + 1}`,
  }));
  await log.decision(
    `${spots.length} places in ${new Set(spots.map((spot) => spot.sourcePath)).size} of ${posts.filter(Boolean).length} posts mention a ranking page's searches`,
    {
      candidates: spots
        .slice(0, 5)
        .map(
          (spot) => `${spot.sourcePath}: "${spot.text}" → ${spot.targetUrl}`
        ),
    }
  );
  if (spots.length === 0) {
    return {
      ready: false,
      reason: "No post mentions a ranking page's searches without a link",
    };
  }
  return { ready: true, baseSha, spots };
}

/**
 * Before anything is claimed: every linked page must load, and the post must
 * read on its published URL as it does in the repository, which proves the
 * file renders there. A page that is down just waits for the next run.
 */
async function confirmLive(spots: Omit<AutopilotLinkSpot, "id">[]) {
  const targets = [...new Set(spots.map((spot) => spot.targetUrl))].slice(
    0,
    AUTOPILOT_REFRESH_MAX_LINK_CHECKS
  );
  const dead = new Set(await findDeadLinks(targets));
  const checked = new Set(targets);
  const reachable = spots.filter(
    (spot) => checked.has(spot.targetUrl) && !dead.has(spot.targetUrl)
  );
  const sources = [...new Set(reachable.map((spot) => spot.sourceUrl))];
  const pages = new Map(
    await mapWithConcurrency(
      sources,
      AUTOPILOT_LINKS_READ_CONCURRENCY,
      async (url) => {
        const text = await fetchPageText(url).catch(() => null);
        return [url, text === null ? null : ` ${plainWords(text)} `] as const;
      }
    )
  );
  return reachable.filter((spot) => {
    const phrase = spotPhrase(spot);
    const page = pages.get(spot.sourceUrl);
    return Boolean(phrase && page?.includes(` ${phrase} `));
  });
}

/** The added link with the most impressions, measured after the merge. */
function searchTarget(links: readonly AutopilotInternalLink[]) {
  const top = [...links].sort((a, b) => b.impressions - a.impressions)[0];
  return top
    ? { kind: "search" as const, query: top.query, before: top.position }
    : null;
}

export async function claimLinks(params: {
  ctx: AutopilotRunContext;
  check: AutopilotLinksCheck;
  claimToken: string;
}): Promise<{ claim: FindingClaim } | { reason: string }> {
  const { ctx, check } = params;
  const log = createAutopilotLogger(ctx, "links");
  const candidates = check.spots.map(toInternalLink);
  const pages = new Set(check.spots.map((spot) => spot.targetKey)).size;
  const claim = await claimFinding(
    ctx.organizationId,
    ctx.runId,
    {
      kind: "links",
      fingerprint: linksFingerprint(candidates),
      title: `Add internal links to ${pages} ${pages === 1 ? "page" : "pages"} ranking 4 to 20`,
      summary: `Links posts to pages that rank on page one or two of Google for the words the posts already use.`,
      // Every candidate, so a review that keeps none settles them all.
      evidence: {
        links: candidates,
        target: searchTarget(candidates),
      },
    },
    params.claimToken
  );
  if (!claim) {
    const reason = "These links are already being added, proposed or dismissed";
    await log.skip(reason);
    return { reason };
  }
  const slot = await reserveDraftSlot(claim, ctx.maxOpenPullRequests);
  if (slot === "lost") {
    return { reason: "Someone else took over these links" };
  }
  if (slot === "full") {
    const reason = "The workspace's draft pull request limit is already in use";
    await markFindingFailed(claim, reason, { count: false });
    await log.skip(reason);
    return { reason };
  }
  return { claim };
}

function describeCandidates(spots: readonly AutopilotLinkSpot[]) {
  return spots
    .map((spot) =>
      [
        `${spot.id}. Post ${spot.sourceUrl}`,
        `Phrase "${spot.text}" would link to ${spot.targetUrl}, which ranks ${spot.position} in Google for "${spot.query}".`,
        `Text: ${spot.context}`,
      ].join("\n")
    )
    .join("\n\n");
}

/**
 * The model only keeps or rejects candidates; code places every link, so the
 * posts' words never change and no link points anywhere it wasn't offered.
 */
export async function writeLinks(params: {
  ctx: AutopilotRunContext;
  claim: FindingClaim;
  check: AutopilotLinksCheck;
}) {
  const { ctx, claim, check } = params;
  const log = createAutopilotLogger(ctx, "links");
  const usage = createGitHubMentionUsageCollector();
  if (!ctx.repository) {
    throw new Error("No website repository connected");
  }
  const repository = ctx.repository;
  const fix = await withAutopilotFindingLease(
    claim,
    async (): Promise<AutopilotLinksFix | null> => {
      const review = await generateAutopilotObject({
        organizationId: ctx.organizationId,
        modelId: AGENT_DEFAULT_MODEL,
        tag: "links",
        log,
        schema: linksReviewSchema,
        instructions: AUTOPILOT_LINKS_REVIEW_INSTRUCTIONS,
        prompt: [
          `Site: ${ctx.brand?.name ?? ""} ${ctx.brand?.websiteUrl ?? ""}`.trim(),
          `Return one decision for each of the ${check.spots.length} candidates.`,
          "",
          "BEGIN CANDIDATES (untrusted text from the posts)",
          describeCandidates(check.spots),
          "END CANDIDATES",
        ].join("\n"),
        maxOutputTokens: AUTOPILOT_LINKS_MAX_OUTPUT_TOKENS,
        onUsage: (used) => usage.add(used),
      });
      const keep = new Set(
        review.decisions
          .filter((decision) => decision.keep)
          .map((decision) => decision.id)
      );
      await log.decision(
        `Kept ${keep.size} of ${check.spots.length} candidate links`,
        {
          reason: review.decisions
            .filter((decision) => !decision.keep)
            .slice(0, 10)
            .map((decision) => `${decision.id}: ${decision.reason}`),
        }
      );
      const selected = selectLinks(check.spots, keep);
      if (selected.length === 0) {
        return null;
      }
      const octokit = await getRepositoryOctokit(
        ctx.organizationId,
        repository
      );
      const files: AutopilotLinksFix["files"] = await Promise.all(
        [...new Set(selected.map((spot) => spot.sourcePath))].map(
          async (path) => {
            const original = await readRepositoryFile(
              octokit,
              repository,
              path,
              check.baseSha
            );
            if (!original) {
              throw new Error(`${path} could not be read`);
            }
            const contents = applyLinkSpots(
              original,
              selected.filter((spot) => spot.sourcePath === path)
            );
            assertNoActiveContent(path, original, contents);
            return { path, contents };
          }
        )
      );
      if (files.length === 0) {
        return null;
      }
      const links = selected.map(toInternalLink);
      const pages = new Set(links.map((link) => link.targetUrl)).size;
      return {
        title: `Add ${links.length} internal ${links.length === 1 ? "link" : "links"} to ${pages} ${pages === 1 ? "page" : "pages"} ranking on Google's first two pages`,
        summary: `Links ${files.length} ${files.length === 1 ? "post" : "posts"} to pages that rank 4 to 20 in Google, using the words people search for.`,
        files,
        links,
        checks: [
          "Only link markup added; no words changed",
          "No post links to itself or to a page it already links to",
          `At most ${AUTOPILOT_LINKS_PER_POST} new links per post and one per page`,
          "No links in headings, the intro, code or existing links",
          "Every linked page loads and every post is live at its URL",
        ],
      };
    }
  );
  if (!fix) {
    const reason = "No candidate link reads naturally where it would go";
    await markFindingWithoutChange(claim, reason);
    await log.skip(`No pull request: ${reason.toLowerCase()}`);
    return { fix: null, usage: usage.get() };
  }
  await log.action(
    `Added ${fix.links.length} links in ${fix.files.length} posts`,
    {
      files: fix.files.map((file) => file.path),
      reason: fix.links.map(
        (link) => `${link.sourcePath}: "${link.anchor}" → ${link.targetUrl}`
      ),
    }
  );
  return { fix, usage: usage.get() };
}

const cell = (value: string) => value.replaceAll("|", "\\|");

function linksPullRequestBody(fix: AutopilotLinksFix) {
  return [
    fix.summary,
    "",
    "**Why:** pages ranking 4 to 20 move the most. Links from your own posts, on the words people search for, tell Google what each page is about.",
    "",
    "| Post | Anchor | Links to | Query | Position | Impressions |",
    "| --- | --- | --- | --- | --- | --- |",
    ...fix.links.map(
      (link) =>
        `| \`${cell(link.sourcePath)}\` | ${cell(link.anchor)} | ${cell(link.targetUrl)} | ${cell(link.query)} | ${link.position} | ${link.impressions} |`
    ),
    "",
    "### Checks",
    ...fix.checks.map((line) => `- ${line}`),
    "",
    "To undo, close this pull request, or revert it after merging. Closed links are not offered again.",
  ].join("\n");
}

export async function openLinksPullRequest(params: {
  ctx: AutopilotRunContext;
  claim: FindingClaim;
  check: AutopilotLinksCheck;
  fix: AutopilotLinksFix;
}) {
  const { ctx, claim, check, fix } = params;
  if (!ctx.repository) {
    throw new Error("No website repository connected");
  }
  const log = createAutopilotLogger(ctx, "links");
  const octokit = await getRepositoryOctokit(
    ctx.organizationId,
    ctx.repository
  );
  await assertAutopilotFindingLease(claim);
  const pullRequest = await openAutopilotPullRequest({
    octokit,
    repository: ctx.repository,
    slug: autopilotDraftBranchSlug("links", claim),
    baseSha: check.baseSha,
    title: fix.title,
    body: linksPullRequestBody(fix),
    files: fix.files,
  });
  const recorded = await markFindingProposed(
    claim,
    {
      repository: `${ctx.repository.owner}/${ctx.repository.name}`,
      ...pullRequest,
    },
    {
      title: fix.title,
      summary: fix.summary,
      // Measured on a link the pull request adds, not a rejected candidate.
      evidence: {
        ...claim.finding.evidence,
        links: fix.links,
        target: searchTarget(fix.links),
      },
    }
  );
  if (!recorded) {
    await closeAutopilotPullRequest(octokit, ctx.repository, pullRequest);
    await log.skip("Dismissed while linking, so the pull request was closed");
    return { opened: false as const };
  }
  await log.action(`Opened pull request #${pullRequest.number}`, {
    event: AUTOPILOT_PULL_REQUEST_CREATED_EVENT,
    url: pullRequest.url,
    files: fix.files.map((file) => file.path),
  });
  return { opened: true as const, url: pullRequest.url };
}
