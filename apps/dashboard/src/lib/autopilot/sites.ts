import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotSettings,
  siteDeployments,
  sites,
} from "@notra/db/schema";
import {
  branchPreviewKey,
  pullRequestPreviewKey,
} from "@notra/sites-core/utils/hosts";
import { sitePreviewOrigin } from "@notra/sites-server/utils/urls";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { AUTOPILOT_DEFAULT_BRANCH } from "@/constants/autopilot";
import type { AutopilotFindingRow } from "@/types/autopilot-runtime";
import { siteBlogFolder } from "@/utils/autopilot-sites";

export async function listAutopilotSites(organizationId: string) {
  const rows = await db.query.sites.findMany({
    columns: {
      id: true,
      name: true,
      repositoryOwner: true,
      repositoryName: true,
      productionBranch: true,
      rootDirectory: true,
      mounts: true,
    },
    where: and(
      eq(sites.organizationId, organizationId),
      isNotNull(sites.repositoryOwner),
      isNotNull(sites.repositoryName)
    ),
  });
  return rows
    .filter((row) => siteBlogFolder(row.rootDirectory, row.mounts))
    .map((row) => ({
      id: row.id,
      name: row.name,
      repository: `${row.repositoryOwner}/${row.repositoryName}`,
      branch: row.productionBranch,
    }));
}

export async function loadAutopilotSiteTarget(
  organizationId: string,
  siteId: string
) {
  const site = await db.query.sites.findFirst({
    where: and(eq(sites.id, siteId), eq(sites.organizationId, organizationId)),
  });
  if (!(site?.repositoryOwner && site.repositoryName)) {
    return null;
  }
  return {
    repository: {
      owner: site.repositoryOwner,
      name: site.repositoryName,
      branch: site.productionBranch,
    },
    contentPath: siteBlogFolder(site.rootDirectory, site.mounts),
  };
}

function previewSiteFor<T extends { id: string; previewsEnabled: boolean }>(
  repositorySites: T[],
  selectedSiteId: string | null
) {
  const selected = repositorySites.find((site) => site.id === selectedSiteId);
  const site =
    selected ?? (repositorySites.length === 1 ? repositorySites[0] : null);
  return site?.previewsEnabled ? site : null;
}

export async function autopilotBaseBranch(
  organizationId: string,
  settings: { siteId: string | null; repositoryBranch: string | null }
) {
  if (!settings.siteId) {
    return settings.repositoryBranch ?? AUTOPILOT_DEFAULT_BRANCH;
  }
  const site = await loadAutopilotSiteTarget(organizationId, settings.siteId);
  return site?.repository.branch ?? null;
}

async function findSitePreviewUrl(
  site: { id: string; slug: string },
  finding: AutopilotFindingRow
) {
  const keys = [
    ...(finding.pullRequestNumber
      ? [pullRequestPreviewKey(finding.pullRequestNumber)]
      : []),
    ...(finding.branch ? [branchPreviewKey(finding.branch, site.slug)] : []),
  ];
  for (const key of keys) {
    const [deployment] = await db
      .select({ status: siteDeployments.status })
      .from(siteDeployments)
      .where(
        and(
          eq(siteDeployments.siteId, site.id),
          eq(siteDeployments.previewKey, key)
        )
      )
      .orderBy(desc(siteDeployments.createdAt))
      .limit(1);
    if (deployment?.status === "ready") {
      return sitePreviewOrigin(site.slug, key);
    }
  }
  return null;
}

export async function attachSitePreviews<T extends AutopilotFindingRow>(
  organizationId: string,
  findings: T[]
): Promise<T[]> {
  const waiting = findings.filter(
    (finding) => finding.status === "proposed" && finding.repository
  );
  if (waiting.length === 0) {
    return findings;
  }
  try {
    const [siteRows, settings] = await Promise.all([
      db.query.sites.findMany({
        columns: {
          id: true,
          slug: true,
          repositoryOwner: true,
          repositoryName: true,
          previewsEnabled: true,
        },
        where: eq(sites.organizationId, organizationId),
      }),
      db.query.autopilotSettings.findFirst({
        columns: { siteId: true },
        where: eq(autopilotSettings.organizationId, organizationId),
      }),
    ]);
    const byRepository = new Map<string, typeof siteRows>();
    for (const site of siteRows) {
      if (site.repositoryOwner && site.repositoryName) {
        const key =
          `${site.repositoryOwner}/${site.repositoryName}`.toLowerCase();
        byRepository.set(key, [...(byRepository.get(key) ?? []), site]);
      }
    }
    const found = new Map<string, string | null>();
    for (const finding of waiting) {
      const site = previewSiteFor(
        byRepository.get(finding.repository?.toLowerCase() ?? "") ?? [],
        settings?.siteId ?? null
      );
      const url = site ? await findSitePreviewUrl(site, finding) : null;
      if (url === (finding.evidence.previewUrl ?? null)) {
        continue;
      }
      found.set(finding.id, url);
      await db
        .update(autopilotFindings)
        .set({
          evidence: url
            ? sql`jsonb_set(${autopilotFindings.evidence}, '{previewUrl}', to_jsonb(${url}::text))`
            : sql`${autopilotFindings.evidence} - 'previewUrl'`,
        })
        .where(
          and(
            eq(autopilotFindings.organizationId, organizationId),
            eq(autopilotFindings.id, finding.id)
          )
        );
    }
    return findings.map((finding) => {
      if (!found.has(finding.id)) {
        return finding;
      }
      const { previewUrl: _stale, ...evidence } = finding.evidence;
      const previewUrl = found.get(finding.id);
      return {
        ...finding,
        evidence: previewUrl ? { ...evidence, previewUrl } : evidence,
      };
    });
  } catch (error) {
    logError("[Autopilot] Site preview lookup failed", error, {
      organizationId,
    });
    return findings;
  }
}
