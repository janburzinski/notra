export const MAX_DRAFT_BYTES = 512 * 1024;
export const SITE_EDITOR_READ_CONCURRENCY = 4;
export const EDITABLE_TEXT_FILE = /\.(?:mdx?|jsx?|json|css)$/i;
export const EDITABLE_PATH_SEGMENT = /^[A-Za-z0-9._@()+ -]+$/;
export const VALIDATED_SOURCE_FILE = /\.(?:mdx?|jsx?)$/i;
export const MAX_PUBLISH_HEADLINE_LENGTH = 200;
export const DEFAULT_PUBLISH_HEADLINE = "Update site content";
export const PULL_REQUEST_RULE_TYPES: ReadonlySet<string> = new Set([
  "pull_request",
  "required_status_checks",
  "non_fast_forward",
  "update",
]);
/** Markdown plus images for one post; matches the GitHub publish asset budget. */
export const MAX_POST_PREVIEW_BYTES = 12 * 1024 * 1024;
/** GitHub's createCommitOnBranch rejects payloads around 20 MB. */
export const MAX_PUBLISH_BYTES = 12 * 1024 * 1024;
