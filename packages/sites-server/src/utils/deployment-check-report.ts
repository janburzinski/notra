import { UNCHANGED_BUILD_TITLE } from "../constants/github";
import { SMART_DEPLOYMENT_BRANCH_SKIP_REASON } from "../constants/smart-deployments";
import type { DeploymentOutcome, SiteDeployment } from "../types/deployments";
import type { CheckReport } from "../types/reporting";
import type { Site } from "../types/sites";
import { primaryMountUrl, unchangedDeploymentUrl } from "./urls";

export function deploymentCheckReport(
  site: Site,
  deployment: SiteDeployment,
  outcome: DeploymentOutcome
): CheckReport {
  switch (outcome.kind) {
    case "live": {
      const url = primaryMountUrl(
        deployment.target.publicOrigin,
        deployment.target.mounts
      );
      const isProduction = deployment.kind === "production";
      const commit = deployment.commitSha.slice(0, 7);
      const builtAt = deployment.finishedAt
        ? ` on ${deployment.finishedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`
        : "";
      return {
        conclusion: "success",
        title: `${isProduction ? "Live" : "Preview ready"} · ${commit}`,
        summary: `${isProduction ? "Published" : "Preview"}: ${url}\n\nBuilt from \`${commit}\`${builtAt}: ${deployment.fileCount ?? 0} files in ${Math.round((deployment.buildDurationMs ?? 0) / 1000)} s.`,
        liveUrl: url,
      };
    }
    case "held":
      return {
        conclusion: "neutral",
        title: "Automatic publishing paused",
        summary:
          "This build completed successfully, but a rollback has paused automatic publishing. Promote the latest successful build to resume publishing.",
        liveUrl: null,
      };
    case "not_live":
      return {
        conclusion: "neutral",
        title: "Superseded by a newer commit",
        summary:
          "A newer deployment was already live, so this build was not published.",
        liveUrl: null,
      };
    case "skipped": {
      const unchanged = deployment.status === "skipped";
      const url = unchanged ? unchangedDeploymentUrl(site, deployment) : null;
      const label =
        deployment.kind === "production" ||
        deployment.skipReason === SMART_DEPLOYMENT_BRANCH_SKIP_REASON
          ? "Published"
          : "Preview";
      return {
        conclusion: "skipped",
        title: unchanged ? UNCHANGED_BUILD_TITLE : "Skipped",
        summary: url
          ? `${outcome.reason}\n\n${label}: ${url}\n\nThe existing version is still being served.`
          : outcome.reason,
        liveUrl: url,
      };
    }
    case "failed":
      return {
        conclusion: "failure",
        title: "Build failed",
        summary: outcome.summary,
        liveUrl: null,
      };
    default: {
      const unhandled: never = outcome;
      throw new Error(
        `Unhandled deployment outcome ${JSON.stringify(unhandled)}`
      );
    }
  }
}
