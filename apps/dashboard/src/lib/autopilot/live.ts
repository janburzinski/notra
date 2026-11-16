import {
  GscReauthRequiredError,
  inspectGscUrl,
} from "@notra/ai/integrations/google-search-console";
import {
  crawlSitemap,
  isContextDevConfigured,
} from "@notra/ai/utils/context-dev";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  brandSitemapPages,
  brandSitemaps,
  sites,
} from "@notra/db/schema";
import { siteEntryPagePath } from "@notra/sites-core/utils/entries";
import { and, eq, gte, inArray, or, sql } from "drizzle-orm";

import {
  AUTOPILOT_INDEX_CHECK_INTERVAL_MS,
  AUTOPILOT_INDEX_GRACE_MS,
  AUTOPILOT_INDEXED_VERDICT,
  AUTOPILOT_LIVE_FOLLOW_MS,
  AUTOPILOT_LIVE_GRACE_MS,
  AUTOPILOT_LIVE_MAX_FINDINGS,
  AUTOPILOT_LIVE_SITEMAP_MAX_LINKS,
  AUTOPILOT_LIVE_SITEMAP_TIMEOUT_MS,
} from "@/constants/autopilot-live";
import { AUTOPILOT_RESULT_KINDS } from "@/constants/autopilot-results";
import { loadOwnedHosts } from "@/lib/autopilot/answers";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { fetchPageText } from "@/lib/autopilot/pages";
import { backfillFilePaths } from "@/lib/autopilot/results";
import { loadSearchConsoleConnection } from "@/lib/autopilot/search-console";
import type { AutopilotRunContext } from "@/types/autopilot";
import type { AutopilotFindingRow } from "@/types/autopilot-runtime";
import { isOwnedKey } from "@/utils/autopilot-citations";
import { toErrorMessage } from "@/utils/error-message";

const DAY_MS = 24 * 60 * 60 * 1000;
const MARKDOWN_FILE = /\.mdx?$/;
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

function postSlug(filePath: string) {
  const name = filePath.split("/").pop() ?? "";
  const base = name.replace(MARKDOWN_FILE, "");
  // content/blog/my-post/index.mdx lives at /my-post.
  return base === "index" ? (filePath.split("/").at(-2) ?? "") : base;
}

function lastSegment(url: string) {
  try {
    return (
      new URL(url).pathname.replace(/\/+$/, "").split("/").pop() ?? ""
    ).toLowerCase();
  } catch {
    return "";
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

type PostSite = Pick<
  typeof sites.$inferSelect,
  "publicOrigin" | "rootDirectory" | "mounts"
> | null;

const shortest = (urls: string[]) =>
  [...urls].sort((a, b) => a.length - b.length)[0] ?? null;

/**
 * Where a new post lives: its Notra Site path, else a sitemap URL on the
 * brand's own hosts that ends in the post's slug. The stored sitemap is read
 * first; the live one only when it doesn't list the post yet.
 */
async function findPostUrl(
  ctx: AutopilotRunContext,
  filePath: string,
  site: PostSite,
  ownedHosts: readonly string[]
) {
  if (site?.publicOrigin) {
    const path = siteEntryPagePath({
      filePath,
      rootDirectory: site.rootDirectory,
      mounts: site.mounts,
    });
    if (path) {
      return `${site.publicOrigin.replace(/\/+$/, "")}${path}`;
    }
  }
  const slug = postSlug(filePath).toLowerCase();
  if (!slug) {
    return null;
  }
  // Subdomains count: a blog on blog.example.com belongs to example.com.
  const owned = (url: string) => isOwnedKey(`${hostOf(url)}/`, ownedHosts);
  if (ctx.brand) {
    const stored = await db
      .select({ url: brandSitemapPages.url })
      .from(brandSitemapPages)
      .innerJoin(
        brandSitemaps,
        eq(brandSitemapPages.sitemapId, brandSitemaps.id)
      )
      .where(
        and(
          eq(brandSitemaps.brandSettingsId, ctx.brand.settingsId),
          sql`lower(${brandSitemapPages.url}) like ${`%/${slug}%`}`
        )
      )
      .limit(20);
    const match = shortest(
      stored
        .map((row) => row.url)
        .filter((url) => owned(url) && lastSegment(url) === slug)
    );
    if (match) {
      return match;
    }
  }
  const host = ownedHosts[0];
  if (!(host && isContextDevConfigured())) {
    return null;
  }
  const crawled = await crawlSitemap(
    {
      domain: host,
      urlRegex: `/${slug.replace(REGEX_SPECIAL, "\\$&")}/?$`,
      maxLinks: AUTOPILOT_LIVE_SITEMAP_MAX_LINKS,
      timeoutMS: AUTOPILOT_LIVE_SITEMAP_TIMEOUT_MS,
    },
    { signal: AbortSignal.timeout(AUTOPILOT_LIVE_SITEMAP_TIMEOUT_MS) }
  ).catch(() => null);
  return shortest(
    (crawled?.urls ?? []).filter(
      (url) => owned(url) && lastSegment(url) === slug
    )
  );
}

function pageUrlOf(finding: AutopilotFindingRow) {
  const evidence = finding.evidence;
  return (
    evidence.live?.url ??
    evidence.pageUrl ??
    evidence.updatePage?.url ??
    evidence.liveCheck?.url ??
    null
  );
}

async function saveEvidence(
  finding: AutopilotFindingRow,
  patch: Partial<AutopilotFindingRow["evidence"]>
) {
  finding.evidence = { ...finding.evidence, ...patch };
  await db
    .update(autopilotFindings)
    .set({
      evidence: sql`${autopilotFindings.evidence} || ${JSON.stringify(patch)}::jsonb`,
    })
    .where(eq(autopilotFindings.id, finding.id));
}

function quoted(finding: AutopilotFindingRow) {
  return `"${finding.title.replace(/^Blog post: /, "")}"`;
}

export function loadPostSite(ctx: AutopilotRunContext): Promise<PostSite> {
  if (!ctx.siteId) {
    return Promise.resolve(null);
  }
  return db.query.sites
    .findFirst({
      columns: { publicOrigin: true, rootDirectory: true, mounts: true },
      where: and(
        eq(sites.id, ctx.siteId),
        eq(sites.organizationId, ctx.organizationId)
      ),
    })
    .then((site) => site ?? null);
}

/**
 * Where a merged post lives and whether it loads: the URL found earlier, else
 * its page found by file path. A page that loads is saved as live.
 */
export async function resolveLiveUrl(params: {
  ctx: AutopilotRunContext;
  finding: AutopilotFindingRow;
  site: PostSite;
  ownedHosts: readonly string[];
  now: Date;
}): Promise<{ url: string | null; live: boolean }> {
  const { finding } = params;
  if (finding.evidence.live) {
    return { url: finding.evidence.live.url, live: true };
  }
  const url =
    pageUrlOf(finding) ??
    (finding.evidence.filePath
      ? await findPostUrl(
          params.ctx,
          finding.evidence.filePath,
          params.site,
          params.ownedHosts
        )
      : null);
  if (!(url && (await fetchPageText(url)) !== null)) {
    return { url, live: false };
  }
  await saveEvidence(finding, {
    live: { url, at: params.now.toISOString() },
  });
  return { url, live: true };
}

function notLiveLine(
  finding: AutopilotFindingRow,
  url: string | null,
  now: Date,
  ownedHosts: readonly string[]
) {
  const days = Math.floor(
    (now.getTime() - (finding.mergedAt ?? now).getTime()) / DAY_MS
  );
  return url
    ? `${quoted(finding)} was merged ${days} days ago but ${url} doesn't load yet. Check that the site deployed.`
    : `${quoted(finding)} was merged ${days} days ago but its page isn't in the sitemap of ${ownedHosts[0] ?? "your website"} yet.`;
}

function indexingLine(
  finding: AutopilotFindingRow,
  live: { url: string; at: string },
  indexing: { verdict: string; coverageState: string | null },
  now: Date
) {
  if (indexing.verdict === AUTOPILOT_INDEXED_VERDICT) {
    return `Google indexed ${quoted(finding)} (${live.url}).`;
  }
  const days = Math.floor(
    (now.getTime() - new Date(live.at).getTime()) / DAY_MS
  );
  return `Google hasn't indexed ${quoted(finding)} ${days} days after it went live${indexing.coverageState ? ` (${indexing.coverageState})` : ""}. Link to it from a page Google already ranks or request indexing in Search Console.`;
}

/**
 * Follows what Autopilot merged until Google indexed it: does the page load,
 * and what does Search Console say about it. Returns brief lines for what a
 * person should know: a page that never went live, one Google indexed, one
 * Google still ignores two weeks later.
 *
 * Only pages with a check due are read, least recently checked first, so a
 * busy month can't keep older pages from being checked. A line is said once:
 * the run that said it is saved, and a retry of that run says it again.
 */
export async function followPublishedPages(
  ctx: AutopilotRunContext,
  now: Date = new Date()
): Promise<string[]> {
  const repository = ctx.repository;
  if (!repository) {
    return [];
  }
  const log = createAutopilotLogger(ctx, null);
  const connection = ctx.projectId
    ? await loadSearchConsoleConnection(ctx, ctx.projectId)
    : ({ ok: false, reason: "No GEO project" } as const);
  const evidence = autopilotFindings.evidence;
  const indexDueBefore = new Date(
    now.getTime() - AUTOPILOT_INDEX_CHECK_INTERVAL_MS
  ).toISOString();
  const findings = await db
    .select()
    .from(autopilotFindings)
    .where(
      and(
        eq(autopilotFindings.organizationId, ctx.organizationId),
        sql`lower(${autopilotFindings.repository}) = ${`${repository.owner}/${repository.name}`.toLowerCase()}`,
        eq(autopilotFindings.status, "merged"),
        inArray(autopilotFindings.kind, AUTOPILOT_RESULT_KINDS),
        gte(
          autopilotFindings.mergedAt,
          new Date(now.getTime() - AUTOPILOT_LIVE_FOLLOW_MS)
        ),
        or(
          // Said in this run already: a retry says it again.
          sql`${evidence}->'liveCheck'->>'reportedRun' = ${ctx.runId}`,
          sql`${evidence}->'indexing'->>'reportedRun' = ${ctx.runId}`,
          and(
            sql`coalesce(${evidence}->'indexing'->>'verdict', '') <> ${AUTOPILOT_INDEXED_VERDICT}`,
            or(
              sql`${evidence}->'live' is null or ${evidence}->'live' = 'null'::jsonb`,
              connection.ok
                ? sql`coalesce(${evidence}->'indexing'->>'checkedAt', '') < ${indexDueBefore}`
                : sql`false`
            )
          )
        )
      )
    )
    .orderBy(
      sql`coalesce(${evidence}->'indexing'->>'checkedAt', ${evidence}->'liveCheck'->>'checkedAt') asc nulls first`,
      autopilotFindings.mergedAt
    )
    .limit(AUTOPILOT_LIVE_MAX_FINDINGS);
  if (findings.length === 0) {
    return [];
  }
  await backfillFilePaths(ctx, findings).catch(() => undefined);
  const [site, ownedHosts] = await Promise.all([
    loadPostSite(ctx),
    loadOwnedHosts(ctx),
  ]);
  const insights: string[] = [];
  let searchConsoleUsable = connection.ok;

  for (const finding of findings) {
    const { liveCheck, indexing } = finding.evidence;
    if (liveCheck?.reportedRun === ctx.runId && !finding.evidence.live) {
      insights.push(notLiveLine(finding, liveCheck.url, now, ownedHosts));
      continue;
    }
    if (indexing?.reportedRun === ctx.runId && finding.evidence.live) {
      insights.push(
        indexingLine(finding, finding.evidence.live, indexing, now)
      );
      continue;
    }
    if (!(pageUrlOf(finding) || finding.evidence.filePath)) {
      continue;
    }

    if (!finding.evidence.live) {
      const resolved = await resolveLiveUrl({
        ctx,
        finding,
        site,
        ownedHosts,
        now,
      });
      if (resolved.live) {
        await log.action(`${quoted(finding)} is live`, { url: resolved.url });
      } else {
        const checkedUrl = resolved.url;
        const late =
          now.getTime() - (finding.mergedAt ?? now).getTime() >=
          AUTOPILOT_LIVE_GRACE_MS;
        const say = late && !liveCheck?.reportedRun;
        const reportedRun = say ? ctx.runId : liveCheck?.reportedRun;
        await saveEvidence(finding, {
          liveCheck: {
            url: checkedUrl,
            checkedAt: now.toISOString(),
            ...(reportedRun ? { reportedRun } : {}),
          },
        });
        if (say) {
          insights.push(notLiveLine(finding, checkedUrl, now, ownedHosts));
          await log.skip(`${quoted(finding)} is not live yet`, {
            url: checkedUrl,
            reason: checkedUrl
              ? "The page doesn't load"
              : "Not found in the sitemap",
          });
        }
        continue;
      }
    }

    const live = finding.evidence.live;
    if (!(live && searchConsoleUsable && connection.ok)) {
      continue;
    }
    const checkedAt = indexing?.checkedAt;
    if (checkedAt && checkedAt >= indexDueBefore) {
      continue;
    }
    let inspection: Awaited<ReturnType<typeof inspectGscUrl>>;
    try {
      inspection = await inspectGscUrl(connection.integration, {
        siteUrl: connection.siteUrl,
        inspectionUrl: live.url,
      });
    } catch (error) {
      if (error instanceof GscReauthRequiredError) {
        searchConsoleUsable = false;
      }
      await log.info("Could not ask Search Console about a published page", {
        url: live.url,
        error: toErrorMessage(error, "unknown error"),
      });
      continue;
    }
    const indexed = inspection.verdict === AUTOPILOT_INDEXED_VERDICT;
    const late =
      !indexed &&
      now.getTime() - new Date(live.at).getTime() >= AUTOPILOT_INDEX_GRACE_MS;
    // Indexed is news once (the page then leaves the list); not indexed only
    // the first time it is late.
    const say = indexed || (late && !indexing?.reportedRun);
    const reportedRun = say ? ctx.runId : indexing?.reportedRun;
    await saveEvidence(finding, {
      indexing: {
        verdict: inspection.verdict,
        coverageState: inspection.coverageState,
        checkedAt: now.toISOString(),
        ...(reportedRun ? { reportedRun } : {}),
      },
    });
    if (say) {
      insights.push(indexingLine(finding, live, inspection, now));
    }
    if (indexed) {
      await log.action(`Google indexed ${quoted(finding)}`, {
        url: live.url,
      });
    }
  }
  return insights;
}
