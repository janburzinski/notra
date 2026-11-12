import { getEvaluationClient } from "@notra/ai/evaluation/client";
import {
  createOctokit,
  GITHUB_INTERACTIVE_READ_TIMEOUT_MS,
} from "@notra/ai/utils/octokit";
import { siteDeployments, sites } from "@notra/db/schema";
import {
  SITE_GIT_ATTRIBUTES_FILENAME,
  SITE_GIT_ATTRIBUTES_MAX_BYTES,
  SITE_GIT_ATTRIBUTES_MAX_FILES,
  SITE_IGNORE_FILENAME,
  SITE_IGNORE_MAX_BYTES,
} from "@notra/sites-core/constants/source";
import type { SiteServingState } from "@notra/sites-core/types/deployment";
import { fingerprintSiteInputs } from "@notra/sites-core/utils/input-fingerprint";
import { removePreviewFromState } from "@notra/sites-core/utils/serving-state";
import { stableStringify } from "@notra/sites-core/utils/stable-stringify";
import { and, eq } from "drizzle-orm";

import {
  SMART_DEPLOYMENT_BRANCH_SKIP_REASON,
  SMART_DEPLOYMENT_QUESTIONS,
  SMART_DEPLOYMENT_SKIP_REASON,
} from "./constants/smart-deployments";
import { getDeployment, transitionDeployment } from "./deployments";
import { getSitesBuilderSnapshotId } from "./env";
import { publishSiteDeploymentChange } from "./live";
import { mutateServingState, readServingState } from "./state";
import type { SiteDeployment } from "./types/deployments";
import type { SiteRepositoryAccess } from "./types/github";
import type { Site } from "./types/sites";
import type { SmartDeploymentComparison } from "./types/smart-deployments";
import { errorMessage } from "./utils/errors";
import { withSiteStorageLock } from "./utils/site-storage-lock";
import { buildTargetForDeployment } from "./utils/urls";

function servingBaseline(state: SiteServingState, deployment: SiteDeployment) {
  if (deployment.kind === "production") {
    return state.production
      ? {
          deploymentId: state.production.deploymentId,
          generation: state.production.generation,
        }
      : null;
  }
  const pointer = deployment.previewKey
    ? state.previews[deployment.previewKey]
    : null;
  return pointer &&
    (!pointer.expiresAt || Date.parse(pointer.expiresAt) > Date.now())
    ? { deploymentId: pointer.deploymentId, generation: pointer.sequence }
    : null;
}

/** All GitHub and model work happens before acquiring the serving-state lock. */
export async function compareSmartDeployment(
  site: Site,
  deployment: SiteDeployment,
  access: SiteRepositoryAccess
): Promise<SmartDeploymentComparison | null> {
  if (!site.smartDeployments) {
    return null;
  }
  try {
    const snapshotId = getSitesBuilderSnapshotId();
    const year = new Date().getUTCFullYear();
    const octokit = createOctokit(access.token, {
      requestTimeoutMs: GITHUB_INTERACTIVE_READ_TIMEOUT_MS,
    });
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      {
        owner: access.repository.owner,
        repo: access.repository.repo,
        tree_sha: deployment.commitSha,
        recursive: "1",
      }
    );
    const readText = async (sha: string, name: string) => {
      const { data: blob } = await octokit.request(
        "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
        {
          owner: access.repository.owner,
          repo: access.repository.repo,
          file_sha: sha,
        }
      );
      if (blob.encoding !== "base64") {
        throw new Error(`Cannot read ${name}: unsupported encoding`);
      }
      return Buffer.from(blob.content, "base64").toString("utf8");
    };
    const ignorePath = site.rootDirectory
      ? `${site.rootDirectory}/${SITE_IGNORE_FILENAME}`
      : SITE_IGNORE_FILENAME;
    const ignoreFile = data.tree.find((entry) => entry.path === ignorePath);
    let ignoreContent: string | undefined;
    if (
      ignoreFile?.type === "blob" &&
      ["100644", "100755"].includes(ignoreFile.mode ?? "") &&
      ignoreFile.sha &&
      ignoreFile.size !== undefined &&
      ignoreFile.size <= SITE_IGNORE_MAX_BYTES
    ) {
      ignoreContent = await readText(ignoreFile.sha, SITE_IGNORE_FILENAME);
    }
    // Unread attribute files make the fingerprint fail closed.
    const attributeFiles = data.tree.filter(
      (entry) =>
        entry.path?.split("/").at(-1) === SITE_GIT_ATTRIBUTES_FILENAME &&
        entry.type === "blob" &&
        entry.sha &&
        entry.size !== undefined &&
        entry.size <= SITE_GIT_ATTRIBUTES_MAX_BYTES
    );
    const gitAttributes: Record<string, string> = {};
    if (attributeFiles.length <= SITE_GIT_ATTRIBUTES_MAX_FILES) {
      await Promise.all(
        attributeFiles.map(async ({ path, sha }) => {
          if (path && sha) {
            gitAttributes[path] = await readText(sha, path);
          }
        })
      );
    }
    const inputs = {
      ignoreContent,
      gitAttributes,
      tree: data.tree,
      truncated: data.truncated,
      rootDirectory: site.rootDirectory,
      repositoryId: `${site.githubRepositoryId}:${access.repository.owner}/${access.repository.repo}`,
      snapshotId,
      year,
    };
    const fingerprint = await fingerprintSiteInputs({
      ...inputs,
      target: deployment.target,
      includeDrafts: deployment.kind === "preview",
    });
    const comparison: SmartDeploymentComparison = {
      fingerprint,
      snapshotId,
      year,
      baseline: null,
      evaluation: null,
    };
    if (
      !fingerprint ||
      deployment.status !== "queued" ||
      !["push", "pull_request"].includes(deployment.trigger)
    ) {
      return comparison;
    }
    const serving = await readServingState(site.id);
    const state = serving?.state.status === "active" ? serving.state : null;
    if (
      !state ||
      (deployment.kind === "production" && state.productionRollback)
    ) {
      return comparison;
    }
    let baseline = servingBaseline(state, deployment);
    let baselineKind = deployment.kind;
    // A branch without its own preview is compared with what is live, so a
    // branch that leaves the site untouched never gets a preview built.
    if (
      !baseline &&
      deployment.kind === "preview" &&
      state.production &&
      !state.productionRollback
    ) {
      baseline = {
        deploymentId: state.production.deploymentId,
        generation: state.production.generation,
      };
      baselineKind = "production";
    }
    const published = baseline
      ? await getDeployment(baseline.deploymentId)
      : null;
    // Against production, the branch is fingerprinted with the live build's
    // own target, so equality means the branch would build what is served.
    const baselineFingerprint =
      baselineKind === deployment.kind
        ? fingerprint
        : published &&
          (await fingerprintSiteInputs({
            ...inputs,
            target: published.target,
            includeDrafts: false,
          }));
    if (
      !baseline ||
      !baselineFingerprint ||
      published?.status !== "ready" ||
      published.siteId !== site.id ||
      published.kind !== baselineKind ||
      published.previewKey !==
        (baselineKind === "preview" ? deployment.previewKey : null) ||
      !published.inputFingerprint
    ) {
      return comparison;
    }
    comparison.baseline = {
      ...baseline,
      kind: baselineKind,
      fingerprint: baselineFingerprint,
    };
    const inputsChanged = baselineFingerprint !== published.inputFingerprint;
    const result = await getEvaluationClient().tryEvaluate({
      feature: "sites-smart-deployments",
      organizationId: site.organizationId,
      state: {
        verifiedInputsChanged: inputsChanged,
        comparisonComplete: true,
        scope: deployment.kind,
      },
      questions: SMART_DEPLOYMENT_QUESTIONS,
    });
    comparison.evaluation = {
      comparedDeploymentId: published.id,
      inputsChanged,
      changeProbability: result?.answers.inputs_changed.probability ?? null,
      modelId: result?.modelId ?? null,
    };
    return comparison;
  } catch (error) {
    console.warn(
      "sites.smart_deployment_comparison_failed",
      errorMessage(error)
    );
    return null;
  }
}

/** CAS advances the generation while preserving the files currently being served. */
export async function skipUnchangedDeployment(
  site: Site,
  deployment: SiteDeployment,
  comparison: SmartDeploymentComparison | null
): Promise<boolean> {
  if (
    !comparison?.fingerprint ||
    !comparison.baseline ||
    !comparison.evaluation ||
    comparison.evaluation.inputsChanged
  ) {
    return false;
  }
  const baseline = comparison.baseline;
  const againstProduction =
    deployment.kind === "preview" && baseline.kind === "production";
  const skipped = await withSiteStorageLock(site.id, async (tx) => {
    const [currentSite] = await tx
      .select()
      .from(sites)
      .where(eq(sites.id, site.id))
      .for("update");
    const [current] = await tx
      .select()
      .from(siteDeployments)
      .where(
        and(
          eq(siteDeployments.id, deployment.id),
          eq(siteDeployments.siteId, site.id)
        )
      )
      .for("update");
    if (
      !currentSite?.smartDeployments ||
      currentSite.status !== "active" ||
      current?.status !== "queued" ||
      !["push", "pull_request"].includes(current.trigger) ||
      (current.kind === "preview" && !currentSite.previewsEnabled) ||
      currentSite.rootDirectory !== site.rootDirectory ||
      currentSite.publicOrigin !== site.publicOrigin ||
      currentSite.githubRepositoryId !== site.githubRepositoryId ||
      currentSite.repositoryId !== site.repositoryId ||
      currentSite.repositoryOwner !== site.repositoryOwner ||
      currentSite.repositoryName !== site.repositoryName ||
      currentSite.githubInstallationId !== site.githubInstallationId ||
      comparison.snapshotId !== getSitesBuilderSnapshotId() ||
      comparison.year !== new Date().getUTCFullYear() ||
      stableStringify(current.target) !==
        stableStringify(
          buildTargetForDeployment({
            site: currentSite,
            kind: current.kind,
            previewKey: current.previewKey,
          })
        )
    ) {
      return false;
    }
    const [published] = await tx
      .select()
      .from(siteDeployments)
      .where(
        and(
          eq(siteDeployments.id, baseline.deploymentId),
          eq(siteDeployments.siteId, site.id)
        )
      )
      .limit(1);
    if (
      published?.status !== "ready" ||
      published.kind !== baseline.kind ||
      published.inputFingerprint !== baseline.fingerprint
    ) {
      return false;
    }
    const fenced = await mutateServingState(
      currentSite,
      (state) => {
        const live = servingBaseline(state, current);
        if (againstProduction) {
          const key = current.previewKey;
          const pointer = key ? state.previews[key] : undefined;
          const removedAt = key ? (state.removedPreviews[key] ?? -1) : -1;
          if (!pointer && removedAt === current.generation) {
            return { skip: true, result: true };
          }
          if (
            !key ||
            state.status !== "active" ||
            state.productionRollback ||
            state.production?.deploymentId !== baseline.deploymentId ||
            live ||
            (pointer && pointer.sequence > current.generation) ||
            removedAt > current.generation
          ) {
            return { skip: true, result: false };
          }
          // The tombstone stops an older build of this branch from publishing
          // a preview after the branch stopped changing the site.
          return {
            write: removePreviewFromState(
              state,
              key,
              current.generation,
              new Date()
            ),
            result: true,
          };
        }
        if (
          state.status !== "active" ||
          (current.kind === "production" && state.productionRollback) ||
          !live ||
          live.deploymentId !== baseline.deploymentId ||
          live.generation !== baseline.generation ||
          live.generation > current.generation
        ) {
          return { skip: true, result: false };
        }
        if (live.generation === current.generation) {
          return { skip: true, result: true };
        }
        const now = new Date().toISOString();
        if (current.kind === "production" && state.production) {
          return {
            write: {
              ...state,
              production: {
                ...state.production,
                generation: current.generation,
                buildGeneration: current.generation,
              },
              updatedAt: now,
            },
            result: true,
          };
        }
        const key = current.previewKey;
        const pointer = key ? state.previews[key] : null;
        return key && pointer
          ? {
              write: {
                ...state,
                previews: {
                  ...state.previews,
                  [key]: { ...pointer, sequence: current.generation },
                },
                updatedAt: now,
              },
              result: true,
            }
          : { skip: true, result: false };
      },
      tx
    );
    return (
      fenced &&
      transitionDeployment(
        current.id,
        "skipped",
        {
          inputFingerprint: comparison.fingerprint,
          smartDeploymentEvaluation: comparison.evaluation,
          skipReason: againstProduction
            ? SMART_DEPLOYMENT_BRANCH_SKIP_REASON
            : SMART_DEPLOYMENT_SKIP_REASON,
          finishedAt: new Date(),
        },
        tx
      )
    );
  });
  if (skipped) {
    await publishSiteDeploymentChange(site.organizationId, site.id);
  }
  return skipped;
}
