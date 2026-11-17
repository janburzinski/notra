import { queryWebPages } from "@notra/analytics/tinybird/client";
import { db } from "@notra/db/drizzle";
import {
  autopilotSettings,
  brandSettings,
  brandSitemapPages,
  brandSitemaps,
  projects,
} from "@notra/db/schema";
import { geoScopeParams, resolveGeoScope } from "@notra/geo-core/geo/projects";
import { mapWithConcurrency } from "@notra/sites-server/utils/concurrency";
import { and, asc, eq, sql } from "drizzle-orm";
import { Effect } from "effect";

import {
  AUTOPILOT_LINK_CHECK_LINK_CONCURRENCY,
  AUTOPILOT_LINK_CHECK_LIST_LIMIT,
  AUTOPILOT_LINK_CHECK_MAX_LINKS,
  AUTOPILOT_LINK_CHECK_MISSING_LIMIT,
  AUTOPILOT_LINK_CHECK_MISSING_QUERY_LIMIT,
  AUTOPILOT_LINK_CHECK_PAGE_CONCURRENCY,
} from "@/constants/autopilot-link-check";
import { checkLinkStatus, fetchPageHtml } from "@/lib/autopilot/pages";
import type {
  AutopilotBrokenLink,
  AutopilotLinkCheckState,
  AutopilotMissingPage,
  AutopilotUnreachableLink,
} from "@/types/autopilot-link-check";
import {
  describeLinkCheck,
  extractPageLinks,
  pagePath,
  siteHost,
} from "@/utils/autopilot-link-check";

const HAS_SCHEME = /^https?:\/\//i;

export class AutopilotLinkCheckUnavailableError extends Error {
  override name = "AutopilotLinkCheckUnavailableError";
}

/** The project's website: the step's project, else Autopilot's, else the first. */
async function loadWebsite(organizationId: string, projectId?: string) {
  const settings = projectId
    ? null
    : await db.query.autopilotSettings.findFirst({
        columns: { projectId: true },
        where: eq(autopilotSettings.organizationId, organizationId),
      });
  const chosen = projectId ?? settings?.projectId;
  const project = await db.query.projects.findFirst({
    columns: { id: true, brandSettingsId: true },
    where: and(
      eq(projects.organizationId, organizationId),
      chosen ? eq(projects.id, chosen) : undefined
    ),
    orderBy: [asc(projects.createdAt)],
  });
  if (!project) {
    throw new AutopilotLinkCheckUnavailableError(
      "This workspace has no project with a website to check"
    );
  }
  const brand = await db.query.brandSettings.findFirst({
    columns: { id: true, websiteUrl: true },
    where: and(
      eq(brandSettings.id, project.brandSettingsId),
      eq(brandSettings.organizationId, organizationId)
    ),
  });
  const website = brand?.websiteUrl.trim();
  if (!(brand && website)) {
    throw new AutopilotLinkCheckUnavailableError(
      "The project's brand has no website to check"
    );
  }
  const home = new URL(
    HAS_SCHEME.test(website) ? website : `https://${website}`
  );
  return { projectId: project.id, brandSettingsId: brand.id, home: home.href };
}

/** The brand's crawled pages on its own site, the longest first. */
async function loadSitemapPages(
  brandSettingsId: string,
  site: string,
  limit: number
) {
  const rows = await db
    .select({ url: brandSitemapPages.url })
    .from(brandSitemapPages)
    .innerJoin(brandSitemaps, eq(brandSitemaps.id, brandSitemapPages.sitemapId))
    .where(
      and(
        eq(brandSitemaps.brandSettingsId, brandSettingsId),
        eq(brandSitemapPages.category, "crawled")
      )
    )
    .orderBy(sql`${brandSitemapPages.wordCount} desc nulls last`)
    .limit(limit * 2);
  return rows
    .map((row) => row.url)
    .filter((url) => {
      try {
        return siteHost(url) === site;
      } catch {
        return false;
      }
    });
}

/**
 * Paths real visitors opened on the checked site that answered 404; none
 * without web analytics. A project can serve several sites, so other hosts'
 * 404s are left out.
 */
async function loadMissingPages(
  organizationId: string,
  projectId: string,
  site: string,
  days: number
): Promise<AutopilotMissingPage[]> {
  try {
    const scope = await Effect.runPromise(
      resolveGeoScope({ organizationId, projectId })
    );
    const response = await queryWebPages({
      ...geoScopeParams(scope),
      site_id: "",
      sites: "",
      // Also matches subdomains; the rows are narrowed to the site below.
      hosts: site,
      path: "",
      page_paths: "",
      imports: "",
      days,
      date_from: "",
      date_to: "",
      not_found: 1,
      limit: AUTOPILOT_LINK_CHECK_MISSING_QUERY_LIMIT,
    });
    return (response?.data ?? [])
      .filter((row) => siteHost(`https://${row.host}`) === site)
      .slice(0, AUTOPILOT_LINK_CHECK_MISSING_LIMIT)
      .map((row) => ({ path: row.path, views: Number(row.views) }));
  } catch {
    return [];
  }
}

/**
 * Reads the homepage and the sitemap's pages (or, without a sitemap, the
 * pages the homepage links to) and lists every link on them. Links to the
 * site itself come first, since those are the ones the team can fix.
 */
export async function collectSiteLinks(params: {
  organizationId: string;
  projectId?: string;
  maxPages: number;
  days: number;
}): Promise<AutopilotLinkCheckState> {
  const website = await loadWebsite(params.organizationId, params.projectId);
  const site = siteHost(website.home);
  const [homePage, sitemap, missingPages] = await Promise.all([
    fetchPageHtml(website.home),
    loadSitemapPages(website.brandSettingsId, site, params.maxPages),
    loadMissingPages(
      params.organizationId,
      website.projectId,
      site,
      params.days
    ),
  ]);
  const foundOn = new Map<string, Set<string>>();
  const record = (page: { html: string; url: string }) => {
    for (const link of extractPageLinks(page.html, page.url)) {
      const pages = foundOn.get(link) ?? new Set<string>();
      pages.add(pagePath(page.url));
      foundOn.set(link, pages);
    }
  };
  if (homePage) {
    record(homePage);
  }
  const homeLinks = homePage
    ? [...foundOn.keys()].filter((url) => siteHost(url) === site)
    : [];
  const seen = new Set([website.home, homePage?.url].filter(Boolean));
  const others = [...new Set(sitemap.length > 0 ? sitemap : homeLinks)]
    .filter((url) => !seen.has(url))
    .slice(0, params.maxPages - 1);
  const pages = await mapWithConcurrency(
    others,
    AUTOPILOT_LINK_CHECK_PAGE_CONCURRENCY,
    fetchPageHtml
  );
  for (const page of pages) {
    if (page) {
      record(page);
    }
  }
  const loaded = pages.filter(Boolean).length + (homePage ? 1 : 0);
  const links = [...foundOn]
    .map(([url, on]) => ({
      url,
      foundOn: [...on],
      internal: siteHost(url) === site,
    }))
    .sort((a, b) => Number(b.internal) - Number(a.internal))
    .map(({ url, foundOn: on }) => ({ url, foundOn: on }));
  return {
    site,
    pagesChecked: loaded,
    pagesFailed: others.length + 1 - loaded,
    links: links.slice(0, AUTOPILOT_LINK_CHECK_MAX_LINKS),
    skipped: Math.max(0, links.length - AUTOPILOT_LINK_CHECK_MAX_LINKS),
    days: params.days,
    missingPages,
  };
}

/** Requests every collected link and reports the ones that are gone. */
export async function checkCollectedLinks(state: AutopilotLinkCheckState) {
  const statuses = await mapWithConcurrency(
    state.links,
    AUTOPILOT_LINK_CHECK_LINK_CONCURRENCY,
    async (link) => ({ link, status: await checkLinkStatus(link.url) })
  );
  const broken: AutopilotBrokenLink[] = [];
  const unreachable: AutopilotUnreachableLink[] = [];
  for (const { link, status } of statuses) {
    const internal = siteHost(link.url) === state.site;
    if (status.kind === "gone") {
      broken.push({ ...link, status: status.status, internal });
    } else if (status.kind === "unreachable") {
      unreachable.push({ ...link, internal });
    }
  }
  const { summary, report } = describeLinkCheck({
    site: state.site,
    pagesChecked: state.pagesChecked,
    pagesFailed: state.pagesFailed,
    linksChecked: state.links.length,
    skipped: state.skipped,
    broken,
    unreachable,
    missingPages: state.missingPages,
    days: state.days,
  });
  return {
    site: state.site,
    pagesChecked: state.pagesChecked,
    linksChecked: state.links.length,
    brokenCount: broken.length,
    broken: broken.slice(0, AUTOPILOT_LINK_CHECK_LIST_LIMIT),
    unreachableCount: unreachable.length,
    unreachable: unreachable.slice(0, AUTOPILOT_LINK_CHECK_LIST_LIMIT),
    missingPages: state.missingPages,
    summary,
    report,
  };
}
