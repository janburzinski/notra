import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { siteDeployments, sites } from "@notra/db/schema";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import type { SiteMounts } from "@notra/sites-core/types/deployment";
import { hashBuildTarget } from "@notra/sites-core/utils/build-target";
import { readConfigSections } from "@notra/sites-core/utils/config-sections";
import { listMountedAreas } from "@notra/sites-core/utils/mounts";
import { stableStringify } from "@notra/sites-core/utils/stable-stringify";
import { eq } from "drizzle-orm";

import { publishedConfig } from "./editor";
import type { SandboxUploadFile } from "./types/build";
import type {
  SiteDeployment,
  SiteStorageTransaction,
} from "./types/deployments";
import type { SiteRepositoryAccess } from "./types/github";
import type { Site } from "./types/sites";
import { repositoryPath } from "./utils/root-directory";

const decoder = new TextDecoder();

function sameMounts(a: SiteMounts, b: SiteMounts): boolean {
  return stableStringify(a) === stableStringify(b);
}

function describeMounts(mounts: SiteMounts): string {
  return listMountedAreas(mounts)
    .map(({ area, mount }) => `${area} at ${mount}`)
    .join(" and ");
}

/**
 * Redirects match a trailing `/*` and keep the rest of the path with `/*`.
 * A section moved below its old path gets no rule: `${from}/*` would match its
 * new pages too and redirect forever.
 */
function movedRedirectHint(from: string, to: string): string {
  if (from === "/" || to.startsWith(`${from}/`)) {
    return "Add redirects for its old URLs so links to them keep working.";
  }
  const destination = to === "/" ? "/*" : `${to}/*`;
  return `Add a redirect from ${from}/* to ${destination} in ${SITE_CONFIG_FILENAME} so old links keep working.`;
}

/** Build log lines for what going live with `next` changes on the site. */
function describeChange(current: SiteMounts, next: SiteMounts): string {
  let log = `[sections] ${SITE_CONFIG_FILENAME} serves the ${describeMounts(next)}.\n`;
  for (const { area, mount } of listMountedAreas(current)) {
    const moved = next[area];
    if (!moved) {
      log += `[sections] warning: the ${area} at ${mount} turns off when this build goes live, and its URLs will return 404.\n`;
    } else if (moved !== mount) {
      log += `[sections] warning: the ${area} moves from ${mount} to ${moved} when this build goes live. ${movedRedirectHint(mount, moved)}\n`;
    }
  }
  return log;
}

/**
 * Builds with the `sections` blog.json sets at the deployment's commit (or in
 * a previewed draft) instead of the dashboard's. The site adopts them when a
 * production build goes live, so a failed build never changes its paths.
 */
export async function applyConfigSections(params: {
  site: Site;
  deployment: SiteDeployment;
  access: SiteRepositoryAccess;
  overlayFiles: SandboxUploadFile[];
}): Promise<{ deployment: SiteDeployment; log: string }> {
  const { site, deployment } = params;
  const configPath = repositoryPath(site.rootDirectory, SITE_CONFIG_FILENAME);
  const draft = params.overlayFiles.find((file) => file.path === configPath);
  let configMounts: SiteMounts | null;
  try {
    configMounts = readConfigSections(
      draft
        ? decoder.decode(draft.data)
        : (await publishedConfig(site, deployment.commitSha, params.access)) ||
            null
    );
  } catch (error) {
    logError("Sites blog.json sections read failed", error, {
      siteId: site.id,
      deploymentId: deployment.id,
    });
    // Unreadable means unknown, not removed: keep the sections the site has.
    configMounts = site.mountsFromConfig ? site.mounts : null;
  }
  if (!configMounts) {
    return { deployment, log: "" };
  }
  const log =
    deployment.kind === "production"
      ? describeChange(site.mounts, configMounts)
      : `[sections] ${SITE_CONFIG_FILENAME} serves the ${describeMounts(configMounts)}.\n`;
  if (
    deployment.configMounts &&
    sameMounts(deployment.configMounts, configMounts)
  ) {
    return { deployment, log };
  }
  const target = { ...deployment.target, mounts: configMounts };
  const [updated] = await db
    .update(siteDeployments)
    .set({
      configMounts,
      target,
      configHash: await hashBuildTarget(target),
    })
    .where(eq(siteDeployments.id, deployment.id))
    .returning();
  return { deployment: updated ?? deployment, log };
}

/**
 * Called with the site row locked when a production build goes live: its
 * blog.json sections become the site's, and a build without them hands the
 * Sections setting back to the dashboard, keeping the current paths.
 */
export async function adoptConfigSections(
  tx: SiteStorageTransaction,
  site: Site,
  deployment: SiteDeployment
): Promise<boolean> {
  if (deployment.kind !== "production") {
    return false;
  }
  if (deployment.configMounts) {
    if (
      site.mountsFromConfig &&
      sameMounts(site.mounts, deployment.configMounts)
    ) {
      return false;
    }
    await tx
      .update(sites)
      .set({ mounts: deployment.configMounts, mountsFromConfig: true })
      .where(eq(sites.id, site.id));
    return !sameMounts(site.mounts, deployment.configMounts);
  }
  if (site.mountsFromConfig) {
    await tx
      .update(sites)
      .set({ mountsFromConfig: false })
      .where(eq(sites.id, site.id));
  }
  return false;
}
