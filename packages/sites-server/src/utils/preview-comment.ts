import {
  PREVIEW_COMMENT_TITLES,
  UNCHANGED_BUILD_TITLE,
} from "../constants/github";
import { SMART_DEPLOYMENT_BRANCH_SKIP_REASON } from "../constants/smart-deployments";
import type { DeploymentOutcome, SiteDeployment } from "../types/deployments";
import type { Site } from "../types/sites";
import { primaryMountUrl, unchangedDeploymentUrl } from "./urls";

export function previewCommentBody(
  site: Site,
  deployment: SiteDeployment,
  buildUrl: string,
  outcome?: DeploymentOutcome
): string {
  let status = outcome
    ? PREVIEW_COMMENT_TITLES[outcome.kind]
    : "⏳ Building preview";
  const unchanged =
    outcome?.kind === "skipped" && deployment.status === "skipped";
  if (unchanged) {
    status = `⏭️ ${UNCHANGED_BUILD_TITLE}`;
  }
  const showsLiveSite =
    unchanged && deployment.skipReason === SMART_DEPLOYMENT_BRANCH_SKIP_REASON;
  const links = [`[View build](<${buildUrl}>)`];
  const previewAvailable = outcome?.kind === "live" || unchanged;
  if (previewAvailable) {
    const url = unchanged
      ? unchangedDeploymentUrl(site, deployment)
      : primaryMountUrl(
          deployment.target.publicOrigin,
          deployment.target.mounts
        );
    links.unshift(
      `[${showsLiveSite ? "Open live site" : "Open preview"}](<${url}>)`
    );
  }
  return [
    `<!-- notra-preview:${site.id} -->`,
    `### Notra · ${site.slug} preview`,
    `${status} · Commit \`${deployment.commitSha.slice(0, 7)}\``,
    links.join(" · "),
    ...(outcome?.kind === "skipped" ? [outcome.reason] : []),
    ...(previewAvailable &&
    !showsLiveSite &&
    site.previewVisibility === "protected"
      ? [
          site.previewPassword
            ? "This preview is protected. Sign in to Notra or use the preview password."
            : "This preview is protected. Sign in to Notra to open it.",
        ]
      : []),
  ].join("\n\n");
}
