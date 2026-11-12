import { SITE_IGNORE_FILENAME } from "@notra/sites-core/constants/source";
import { isCollectedSiteSourcePath } from "@notra/sites-core/utils/source-files";

import { PUSH_PAYLOAD_COMMIT_LIMIT } from "../constants/webhooks";
import type { PushPayload } from "../types/webhooks";

/**
 * Whether a push could change a site rooted at `rootDirectory`. Answers true
 * whenever the payload can't prove otherwise (force pushes, new branches,
 * truncated commit lists), so only pushes that clearly stay outside the
 * folder are skipped.
 */
export function pushTouchesRootDirectory(
  payload: PushPayload,
  rootDirectory: string
): boolean {
  const commits = payload.commits ?? [];
  if (
    !rootDirectory ||
    payload.forced ||
    payload.created ||
    commits.length === 0 ||
    commits.length >= PUSH_PAYLOAD_COMMIT_LIMIT ||
    commits.some(
      (commit) => !(commit.added && commit.modified && commit.removed)
    )
  ) {
    return true;
  }
  return commits.some((commit) =>
    pathsTouchRootDirectory(
      [
        ...(commit.added ?? []),
        ...(commit.modified ?? []),
        ...(commit.removed ?? []),
      ],
      rootDirectory
    )
  );
}

export function pathsTouchRootDirectory(
  paths: readonly string[],
  rootDirectory: string
): boolean {
  const prefix = `${rootDirectory}/`;
  return paths.some((path) => path.startsWith(prefix));
}

/**
 * Whether any path is a file the compiler reads for a site rooted at
 * `rootDirectory`, using the same selection as the input fingerprint. Archive
 * attribute files count anywhere because they can transform site files.
 */
export function pathsTouchSiteInputs(
  paths: readonly string[],
  rootDirectory: string
): boolean {
  const prefix = rootDirectory ? `${rootDirectory}/` : "";
  return paths.some((path) => {
    const name = path.split("/").at(-1) ?? "";
    if (name === ".gitattributes" || name === ".lfsconfig") {
      return true;
    }
    if (!path.startsWith(prefix)) {
      return false;
    }
    const relative = path.slice(prefix.length);
    return (
      relative === SITE_IGNORE_FILENAME || isCollectedSiteSourcePath(relative)
    );
  });
}
