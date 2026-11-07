import { isDeepStrictEqual } from "node:util";

import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import { siteIntegrationsSchema } from "@notra/sites-core/schemas/site-integrations";
import type { SiteIntegrationUpdate } from "@notra/sites-core/types/site-integrations";

import {
  SITE_INTEGRATION_BRANCH_PREFIX,
  SITE_INTEGRATION_NAMES,
  SITE_INTEGRATION_PULL_REQUEST_BODY,
} from "./constants/integrations";
import { readSiteSourceFile } from "./editor";
import { SiteInputError } from "./errors/sites";
import { getBranchHead, siteRepositoryAccess } from "./github";
import {
  commitRepositoryFiles,
  createRepositoryBranch,
  deleteRepositoryBranch,
  findOpenRepositoryPullRequest,
  openRepositoryPullRequest,
  renameRepositoryPullRequest,
} from "./repository";
import type {
  SiteIntegrationConfigUpdate,
  SiteIntegrationPullRequest,
  SiteIntegrationsState,
} from "./types/integrations";
import type { Site } from "./types/sites";
import { timestampedBranchName } from "./utils/branch-name";
import { defaultSiteConfigContent } from "./utils/default-config";
import { errorMessage } from "./utils/errors";
import { isRecord } from "./utils/json";
import { repositoryPath } from "./utils/root-directory";
import { siteDraftCodec } from "./utils/site-draft-codec";
import {
  parseSiteIntegrationConfig,
  updateSiteIntegrationConfig,
} from "./utils/site-integration-config";

/** Integrations as committed on the production branch; drafts don't count. */
export async function readSiteIntegrations(
  site: Site
): Promise<SiteIntegrationsState> {
  const file = await readSiteSourceFile(site, SITE_CONFIG_FILENAME);
  const config = parseSiteIntegrationConfig(
    file?.content ?? defaultSiteConfigContent(site)
  );
  return {
    integrations: isRecord(config?.integrations) ? config.integrations : {},
    invalid:
      config === null ||
      !siteIntegrationsSchema.safeParse(config.integrations).success,
  };
}

export async function saveSiteIntegration(
  site: Site,
  update: SiteIntegrationUpdate
): Promise<SiteIntegrationPullRequest> {
  return await openSiteIntegrationPullRequest(site, () => update);
}

export async function saveSiteC15tBackend(
  site: Site,
  backendURL: string
): Promise<SiteIntegrationPullRequest> {
  return await openSiteIntegrationPullRequest(site, (integrations) => ({
    provider: "c15t",
    settings: {
      ...(isRecord(integrations.c15t) ? integrations.c15t : {}),
      backendURL,
    },
  }));
}

/**
 * Opens a pull request that changes only blog.json, based on the production
 * branch head. Existing drafts stay untouched.
 */
async function openSiteIntegrationPullRequest(
  site: Site,
  toUpdate: (
    integrations: Record<string, unknown>
  ) => SiteIntegrationConfigUpdate
): Promise<SiteIntegrationPullRequest> {
  const access = await siteRepositoryAccess(site, {
    contents: "write",
    pull_requests: "write",
  });
  const { repository, token } = access;
  const head = await getBranchHead(repository, token, site.productionBranch);
  const file = await readSiteSourceFile(
    site,
    SITE_CONFIG_FILENAME,
    head.sha,
    access
  );
  const content = file?.content ?? defaultSiteConfigContent(site);
  const config = parseSiteIntegrationConfig(content);
  const current = isRecord(config?.integrations) ? config.integrations : {};
  const update = toUpdate(current);
  const { content: next } = updateSiteIntegrationConfig(content, update);
  const nextConfig: unknown = JSON.parse(next);
  if (isDeepStrictEqual(config, nextConfig)) {
    return { pullRequestUrl: null };
  }
  const parsed = siteConfigSchema.safeParse(nextConfig);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SiteInputError(
      `${SITE_CONFIG_FILENAME} has errors (${issue?.path.join(".") || "config"}: ${issue?.message ?? "invalid"}). Fix them in the editor first.`
    );
  }
  let action = current[update.provider] === undefined ? "add" : "update";
  if (update.settings === null) {
    action = "remove";
  }
  const title = `chore(blog): ${action} ${SITE_INTEGRATION_NAMES[update.provider]}`;
  const path = repositoryPath(site.rootDirectory, SITE_CONFIG_FILENAME);
  const contents = siteDraftCodec(SITE_CONFIG_FILENAME).toCommit(next);
  // One pull request per provider: saving again updates the open one.
  const open = await findOpenRepositoryPullRequest(repository, token, {
    base: site.productionBranch,
    headPrefix: `${SITE_INTEGRATION_BRANCH_PREFIX}${update.provider}-`,
  });
  if (open) {
    try {
      const openHead = await getBranchHead(repository, token, open.branch);
      const onBranch = await readSiteSourceFile(
        site,
        SITE_CONFIG_FILENAME,
        openHead.sha,
        access
      );
      if (!(onBranch && sameJson(onBranch.content, nextConfig))) {
        await commitRepositoryFiles(repository, token, {
          branch: open.branch,
          headline: title,
          expectedHeadOid: openHead.sha,
          additions: [{ path, contents }],
          deletions: [],
        });
      }
    } catch (error) {
      throw new SiteInputError(
        `GitHub didn't update the open pull request: ${errorMessage(error)}`
      );
    }
    // The pull request already has the new content, so a failed rename is not
    // worth failing the save over.
    await renameRepositoryPullRequest(
      repository,
      token,
      open.number,
      title
    ).catch((error: unknown) => {
      console.warn("sites.integration_pr_rename_failed", {
        pullRequest: open.url,
        error: errorMessage(error),
      });
    });
    return { pullRequestUrl: open.url };
  }
  const branch = `${timestampedBranchName(
    `${SITE_INTEGRATION_BRANCH_PREFIX}${update.provider}-`,
    new Date()
  )}-${crypto.randomUUID().slice(0, 6)}`;
  try {
    await createRepositoryBranch(repository, token, {
      name: branch,
      sha: head.sha,
    });
  } catch (error) {
    throw new SiteInputError(
      `GitHub didn't create a branch for the pull request: ${errorMessage(error)}`
    );
  }
  try {
    await commitRepositoryFiles(repository, token, {
      branch,
      headline: title,
      expectedHeadOid: head.sha,
      additions: [{ path, contents }],
      deletions: [],
    });
    return {
      pullRequestUrl: await openRepositoryPullRequest(repository, token, {
        title,
        head: branch,
        base: site.productionBranch,
        body: SITE_INTEGRATION_PULL_REQUEST_BODY,
      }),
    };
  } catch (error) {
    // GitHub may have opened the pull request even though its response failed;
    // deleting the branch would close it, so return it instead.
    const opened = await findOpenRepositoryPullRequest(repository, token, {
      base: site.productionBranch,
      headPrefix: branch,
    }).catch(() => null);
    if (opened?.branch === branch) {
      return { pullRequestUrl: opened.url };
    }
    await deleteRepositoryBranch(repository, token, branch).catch(
      () => undefined
    );
    if (error instanceof SiteInputError) {
      throw error;
    }
    throw new SiteInputError(
      `GitHub didn't open the pull request: ${errorMessage(error)}`
    );
  }
}

function sameJson(content: string, value: unknown): boolean {
  try {
    return isDeepStrictEqual(JSON.parse(content), value);
  } catch {
    return false;
  }
}
