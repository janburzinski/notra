import {
  ARTIFACT_PATH,
  ARTIFACT_SHARE_PATH,
} from "@notra/ai/constants/artifacts";

/** An artifact's page in the dashboard; safe to import on the client. */
export function artifactPath(artifactId: string) {
  return `${ARTIFACT_PATH}/${artifactId}`;
}

/** An artifact's public page, by its share id. */
export function artifactSharePath(shareId: string) {
  return `${ARTIFACT_SHARE_PATH}/${shareId}`;
}
