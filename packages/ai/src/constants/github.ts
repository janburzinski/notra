export const GITHUB_CONTENT_POST_TRAILER = "Notra-Post: ";

/** GitHub App tokens author this commit as the App bot. */
export const GITHUB_CREATE_COMMIT_ON_BRANCH_MUTATION = `
  mutation CreateCommitOnBranch($input: CreateCommitOnBranchInput!) {
    createCommitOnBranch(input: $input) {
      commit {
        oid
      }
    }
  }
`;

export const GITHUB_API_VERSION = "2022-11-28";

export const GITHUB_API_DEFAULT_URL = "https://api.github.com";

export const GITHUB_API_VERSION_HEADERS = {
  "X-GitHub-Api-Version": GITHUB_API_VERSION,
} as const;

/** Merged pull requests per listMergedPullRequests page. */
export const MERGED_PULL_REQUESTS_PAGE_SIZE = 50;
/** Pages listMergedPullRequests reads in one call (500 updated pull requests). */
export const MERGED_PULL_REQUESTS_MAX_PAGES = 10;

/** A pull request description longer than this is cut for the list view. */
export const PULL_REQUEST_BODY_PREVIEW_MAX_CHARS = 400;
