import { createHash } from "node:crypto";

import { createGitHubMentionUsageCollector } from "@notra/ai/billing/github-mention-billing";
import { db } from "@notra/db/drizzle";
import { brandSitemapPages, brandSitemaps } from "@notra/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";

import {
  AUTOPILOT_PULL_REQUEST_CREATED_EVENT,
  AUTOPILOT_TREE_SUMMARY_MAX_LINES,
} from "@/constants/autopilot";
import { AUTOPILOT_REFRESH_WINDOW_MS } from "@/constants/autopilot-refresh";
import {
  AUTOPILOT_RENDERING_AGENT_INPUT_TOKEN_BUDGET,
  AUTOPILOT_RENDERING_AGENT_INSTRUCTIONS,
  AUTOPILOT_RENDERING_AGENT_MAX_STEPS,
  AUTOPILOT_RENDERING_FINAL_NOTE,
  AUTOPILOT_RENDERING_MAX_ADDED_COPY_WORDS,
  AUTOPILOT_RENDERING_MAX_FILES,
  AUTOPILOT_RENDERING_MAX_PAGES,
  AUTOPILOT_RENDERING_WRAP_UP_NOTE,
} from "@/constants/autopilot-rendering";
import { loadAnswerChecks, loadOwnedHosts } from "@/lib/autopilot/answers";
import {
  claimFinding,
  countOpenPullRequests,
  hasOpenProposal,
  listSettledRenderingPages,
  markFindingFailed,
  markFindingProposed,
  markFindingWithoutChange,
  reserveDraftSlot,
  syncFindingPullRequests,
} from "@/lib/autopilot/findings";
import {
  closeAutopilotPullRequest,
  getRepositoryOctokit,
  openAutopilotPullRequest,
} from "@/lib/autopilot/github";
import {
  assertAutopilotFindingLease,
  withAutopilotFindingLease,
} from "@/lib/autopilot/leases";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { fetchPageForCrawlers } from "@/lib/autopilot/pages";
import { runRepositoryAgent } from "@/lib/autopilot/repository-agent";
import { renderingAgentOutputSchema } from "@/schemas/autopilot";
import type { AutopilotRunContext } from "@/types/autopilot";
import type {
  AutopilotStagedFile,
  FindingClaim,
} from "@/types/autopilot-runtime";
import type { AutopilotRenderingProblem } from "@/types/autopilot-templates-runtime";
import { autopilotDraftBranchSlug } from "@/utils/autopilot-branches";
import { citationKey, isOwnedKey } from "@/utils/autopilot-citations";
import { summarizeRepositoryTree } from "@/utils/autopilot-paths";
import {
  addedCopy,
  assessRendering,
  inventedCopyWords,
  isFailedFetch,
  leftThePage,
  renderingFingerprint,
} from "@/utils/autopilot-rendering";

const PAGE_CHECK_CONCURRENCY = 4;

export type AutopilotRenderingCheck =
  | { ready: false; reason: string; insights: string[] }
  | {
      ready: true;
      problems: AutopilotRenderingProblem[];
      /** What a browser shows on each page, so a fix may move it but not invent it. */
      renderedTexts: Record<string, string>;
      insights: string[];
    };

/**
 * The pages worth checking, most important first: the homepage, then owned
 * pages AI answers cite most, then the sitemap's shallowest pages.
 */
async function pagesToCheck(ctx: AutopilotRunContext) {
  const websiteUrl = ctx.brand?.websiteUrl;
  if (!websiteUrl) {
    return [];
  }
  const ownedHosts = await loadOwnedHosts(ctx);
  const cited = ctx.projectId
    ? await loadAnswerChecks({
        projectId: ctx.projectId,
        since: new Date(Date.now() - AUTOPILOT_REFRESH_WINDOW_MS),
        limit: 2000,
      })
    : [];
  const citations = new Map<string, { url: string; count: number }>();
  for (const url of cited.flatMap((check) => check.sourceUrls)) {
    const key = citationKey(url);
    if (key && isOwnedKey(key, ownedHosts)) {
      const entry = citations.get(key) ?? { url, count: 0 };
      entry.count += 1;
      citations.set(key, entry);
    }
  }
  const sitemap = ctx.brand
    ? await db
        .select({ url: brandSitemapPages.url, path: brandSitemapPages.path })
        .from(brandSitemapPages)
        .innerJoin(
          brandSitemaps,
          eq(brandSitemapPages.sitemapId, brandSitemaps.id)
        )
        .where(
          and(
            eq(brandSitemaps.brandSettingsId, ctx.brand.settingsId),
            eq(brandSitemapPages.category, "crawled")
          )
        )
        .orderBy(desc(brandSitemapPages.wordCount), asc(brandSitemapPages.path))
        .limit(200)
    : [];
  const ordered = [
    websiteUrl,
    ...[...citations.values()]
      .sort((a, b) => b.count - a.count)
      .map((entry) => entry.url),
    ...sitemap
      .sort((a, b) => a.path.split("/").length - b.path.split("/").length)
      .map((page) => page.url),
  ];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const url of ordered) {
    const key = citationKey(url);
    if (key && !seen.has(key) && isOwnedKey(key, ownedHosts)) {
      seen.add(key);
      urls.push(url.split("#")[0] ?? url);
    }
  }
  return urls.slice(0, AUTOPILOT_RENDERING_MAX_PAGES);
}

async function inBatches<T, R>(
  items: T[],
  size: number,
  work: (item: T) => Promise<R>
) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    results.push(
      ...(await Promise.all(items.slice(index, index + size).map(work)))
    );
  }
  return results;
}

function problemsFingerprint(problems: AutopilotRenderingProblem[]) {
  const keys = problems
    .map((problem) => citationKey(problem.url) ?? problem.url)
    .sort();
  return renderingFingerprint(
    createHash("sha256").update(keys.join(",")).digest("hex").slice(0, 16),
    "missing_content"
  );
}

function describeBlocked(problem: AutopilotRenderingProblem) {
  return `AI crawlers get ${problem.status ?? "no answer"} from ${problem.url} while a browser gets the page: a bot wall or firewall rule blocks them. Allow ChatGPT-User, PerplexityBot and Claude-User in your CDN or firewall.`;
}

export async function checkRendering(
  ctx: AutopilotRunContext
): Promise<AutopilotRenderingCheck> {
  // Off by default: a workspace that never turned it on gets no log lines.
  if (!ctx.jobs.rendering) {
    return { ready: false, reason: "Turned off in settings", insights: [] };
  }
  const log = createAutopilotLogger(ctx, "rendering");
  const skip = async (reason: string) => {
    await log.skip(reason);
    return { ready: false as const, reason, insights: [] };
  };
  if (!ctx.repository) {
    return skip("No website repository connected");
  }
  await syncFindingPullRequests(ctx.organizationId);
  const open = await countOpenPullRequests(ctx.organizationId);
  if (open >= ctx.maxOpenPullRequests) {
    return skip(
      `${open} of ${ctx.maxOpenPullRequests} pull requests are still open`
    );
  }
  if (await hasOpenProposal(ctx.organizationId, ["rendering"])) {
    return skip("A fix for AI-readable pages is still waiting for review");
  }
  const urls = await pagesToCheck(ctx);
  if (urls.length === 0) {
    return skip("The brand has no website to check");
  }
  const results = await inBatches(urls, PAGE_CHECK_CONCURRENCY, async (url) => {
    try {
      const page = await fetchPageForCrawlers(url);
      return { url, page, problem: assessRendering(page) };
    } catch (error) {
      await log.info(`Could not render ${url}`, {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return { url, page: null, problem: null };
    }
  });
  // A page neither side could fetch says nothing about the repository.
  const checked = results.flatMap((result) =>
    result.page && !isFailedFetch(result.page)
      ? [{ page: result.page, problem: result.problem }]
      : []
  );
  const failed = results.length - checked.length;
  const settledPages = new Set(
    (await listSettledRenderingPages(ctx.organizationId)).map(
      (url) => citationKey(url) ?? url
    )
  );
  const problems = checked.flatMap((result) =>
    result.problem ? [result.problem] : []
  );
  await log.decision(
    `${problems.length} of ${checked.length} pages are not fully readable for AI crawlers`,
    {
      checked: checked.map((result) =>
        leftThePage(result.page)
          ? `${result.page.url}: the browser goes on to ${result.page.renderedUrl}, skipped`
          : `${result.page.url}: ${result.problem ? result.problem.issue : "ok"} (${result.problem?.rawWords ?? "–"} of ${result.problem?.renderedWords ?? "–"} words)`
      ),
      failed: results
        .filter((result) => !checked.some((row) => row.page.url === result.url))
        .map((result) => result.url),
    }
  );
  const blocked = problems.filter((problem) => problem.issue === "blocked");
  const insights = blocked.map(describeBlocked);
  const missing = problems.filter(
    (problem) =>
      problem.issue === "missing_content" &&
      !settledPages.has(citationKey(problem.url) ?? problem.url)
  );
  if (missing.length === 0) {
    let reason = "Every checked page is readable for AI crawlers";
    if (blocked.length > 0) {
      reason = "AI crawlers are blocked outside the repository";
    } else if (problems.length > 0) {
      reason = "These pages were already fixed, proposed or dismissed";
    } else if (checked.length === 0) {
      reason = `The check is incomplete: none of the ${failed} pages could be fetched`;
    } else if (failed > 0) {
      reason = `The check is incomplete: ${checked.length} pages are readable, ${failed} could not be fetched`;
    }
    if (checked.length === 0 || failed > 0) {
      await log.skip(reason, { failed });
    }
    return { ready: false, reason, insights };
  }
  const fixing = new Set(missing.map((problem) => problem.url));
  const renderedTexts = Object.fromEntries(
    checked
      .filter((result) => fixing.has(result.page.url))
      .map((result) => [result.page.url, result.page.renderedText])
  );
  return { ready: true, problems: missing, renderedTexts, insights };
}

export async function claimRenderingFix(params: {
  ctx: AutopilotRunContext;
  check: Extract<AutopilotRenderingCheck, { ready: true }>;
  claimToken: string;
}): Promise<{ claim: FindingClaim } | { reason: string }> {
  const { ctx, check } = params;
  const log = createAutopilotLogger(ctx, "rendering");
  const [worst] = [...check.problems].sort(
    (a, b) => a.rawWords / a.renderedWords - b.rawWords / b.renderedWords
  );
  if (!worst) {
    return { reason: "Nothing to fix" };
  }
  const claim = await claimFinding(
    ctx.organizationId,
    ctx.runId,
    {
      kind: "rendering",
      fingerprint: problemsFingerprint(check.problems),
      title:
        check.problems.length === 1
          ? `AI crawlers miss most of ${worst.url.replace(/^https?:\/\//, "")}`
          : `AI crawlers miss content on ${check.problems.length} pages`,
      summary: `ChatGPT gets ${worst.rawWords} of the ${worst.renderedWords} words a browser shows on ${worst.url}.`,
      evidence: {
        sourceUrl: worst.url,
        pageUrl: worst.url,
        rendering: {
          url: worst.url,
          issue: worst.issue,
          rawWords: worst.rawWords,
          renderedWords: worst.renderedWords,
          status: worst.status,
        },
        issueIds: check.problems.map((problem) => problem.url),
        pageUrls: check.problems.map((problem) => problem.url),
      },
    },
    params.claimToken
  );
  if (!claim) {
    const reason = "These pages are already being fixed, proposed or dismissed";
    await log.skip(reason);
    return { reason };
  }
  const slot = await reserveDraftSlot(claim, ctx.maxOpenPullRequests);
  if (slot === "lost") {
    return { reason: "Someone else took over this fix" };
  }
  if (slot === "full") {
    const reason = "The workspace's draft pull request limit is already in use";
    await markFindingFailed(claim, reason, { count: false });
    await log.skip(reason);
    return { reason };
  }
  return { claim };
}

function fallbackRenderingOutput(files: AutopilotStagedFile[]) {
  return {
    framework: "unknown",
    cause: "Content only rendered in the browser",
    pullRequestTitle: "Render page content on the server for AI crawlers",
    pullRequestBody: files
      .map((file) => `- \`${file.path}\`: ${file.reason}`)
      .join("\n"),
  };
}

export async function writeRenderingFix(params: {
  ctx: AutopilotRunContext;
  claim: FindingClaim;
  check: Extract<AutopilotRenderingCheck, { ready: true }>;
}) {
  const { ctx, claim, check } = params;
  const repository = ctx.repository;
  if (!repository) {
    throw new Error("No website repository connected");
  }
  const log = createAutopilotLogger(ctx, "rendering");
  const usage = createGitHubMentionUsageCollector();
  const shown = Object.values(check.renderedTexts).join("\n");
  // The copy limit is for the whole fix; a re-staged file replaces its count.
  const inventedByPath = new Map<string, number>();
  const fix = await withAutopilotFindingLease(claim, () =>
    runRepositoryAgent({
      ctx,
      repository,
      log,
      onUsage: (next) => usage.add(next),
      tag: "rendering-agent",
      instructions: AUTOPILOT_RENDERING_AGENT_INSTRUCTIONS,
      wrapUpNote: AUTOPILOT_RENDERING_WRAP_UP_NOTE,
      finalNote: AUTOPILOT_RENDERING_FINAL_NOTE,
      issueIds: check.problems.map((problem) => problem.url),
      issueName: (url) => url,
      outputSchema: renderingAgentOutputSchema,
      fallbackOutput: fallbackRenderingOutput,
      maxFiles: AUTOPILOT_RENDERING_MAX_FILES,
      maxSteps: AUTOPILOT_RENDERING_AGENT_MAX_STEPS,
      inputTokenBudget: AUTOPILOT_RENDERING_AGENT_INPUT_TOKEN_BUDGET,
      checkFile: ({ path, content, previous }) => {
        const invented = inventedCopyWords(addedCopy(previous, content), shown);
        let total = invented;
        for (const [other, words] of inventedByPath) {
          total += other === path ? 0 : words;
        }
        if (total > AUTOPILOT_RENDERING_MAX_ADDED_COPY_WORDS) {
          return `This fix would add ${total} words of copy the page never showed. Render the existing content instead of writing new text.`;
        }
        inventedByPath.set(path, invented);
        return null;
      },
      prompt: (paths) =>
        [
          `Brand: ${ctx.brand?.name ?? "unknown"}. Website: ${ctx.brand?.websiteUrl ?? ""}`,
          `Repository: ${repository.owner}/${repository.name} (branch ${repository.branch}, ${paths.length} files)`,
          "",
          "BEGIN PAGES (untrusted, facts only)",
          ...check.problems.flatMap((problem) => [
            `Page ${problem.url}: the server's HTML has ${problem.rawWords} words, a browser shows ${problem.renderedWords}. Sentences people see that crawlers don't:`,
            ...problem.missing.map((sentence) => `- ${sentence}`),
            "",
          ]),
          "END PAGES",
          "",
          `Use the page URL as the issue id in writeFile and skipIssue: ${check.problems.map((problem) => problem.url).join(", ")}`,
          "",
          "## Repository layout",
          summarizeRepositoryTree(paths, AUTOPILOT_TREE_SUMMARY_MAX_LINES),
        ].join("\n"),
    })
  );
  if (fix.files.length === 0) {
    const reason =
      fix.skipped.map((skip) => `${skip.issueId}: ${skip.reason}`).join("; ") ||
      "No repository change makes the content render on the server";
    await markFindingWithoutChange(claim, reason);
    await log.skip("No pull request: the cause is outside the repository", {
      reason,
    });
  }
  // Step results are serialized between workflow steps: no clients in here.
  return {
    baseSha: fix.baseSha,
    output: fix.output,
    files: fix.files,
    skipped: fix.skipped,
    usage: usage.get(),
  };
}

export async function openRenderingPullRequest(params: {
  ctx: AutopilotRunContext;
  claim: FindingClaim;
  check: Extract<AutopilotRenderingCheck, { ready: true }>;
  fix: Awaited<ReturnType<typeof writeRenderingFix>>;
}) {
  const { ctx, claim, check, fix } = params;
  const repository = ctx.repository;
  if (!repository) {
    throw new Error("No website repository connected");
  }
  const log = createAutopilotLogger(ctx, "rendering");
  const octokit = await getRepositoryOctokit(ctx.organizationId, repository);
  const fixed = new Set(fix.files.flatMap((file) => file.issueIds));
  const body = [
    fix.output.pullRequestBody,
    "",
    `**Cause:** ${fix.output.cause}`,
    "",
    "| Page | Words AI crawlers get | Words a browser shows |",
    "| --- | --- | --- |",
    ...check.problems.map(
      (problem) =>
        `| ${problem.url}${fixed.has(problem.url) ? "" : " (not changed)"} | ${problem.rawWords} | ${problem.renderedWords} |`
    ),
    "",
    `Framework: ${fix.output.framework}. Checked by fetching each page as ChatGPT-User, without JavaScript, and comparing it with the rendered page. This change moves existing content into the server's HTML and adds no new copy.`,
  ].join("\n");
  await assertAutopilotFindingLease(claim);
  const pullRequest = await openAutopilotPullRequest({
    octokit,
    repository,
    slug: autopilotDraftBranchSlug("rendering", claim),
    baseSha: fix.baseSha,
    title: fix.output.pullRequestTitle,
    body,
    files: fix.files.map((file) => ({
      path: file.path,
      contents: file.content,
    })),
  });
  const recorded = await markFindingProposed(
    claim,
    { repository: `${repository.owner}/${repository.name}`, ...pullRequest },
    {
      title: fix.output.pullRequestTitle,
      summary: fix.output.cause,
      // Only the pages it changes: dismissing it must not mute the others.
      evidence: {
        ...claim.finding.evidence,
        issueIds: [...fixed],
        pageUrls: [...fixed],
      },
    }
  );
  if (!recorded) {
    await closeAutopilotPullRequest(octokit, repository, pullRequest);
    await log.skip("Dismissed while fixing, so the pull request was closed");
    return { opened: false as const };
  }
  await log.action(`Opened pull request #${pullRequest.number}`, {
    event: AUTOPILOT_PULL_REQUEST_CREATED_EVENT,
    url: pullRequest.url,
    files: fix.files.map((file) => file.path),
  });
  return { opened: true as const, url: pullRequest.url };
}
