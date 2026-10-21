export const BRANCH_PROTECTION_CACHE_MS = 15_000;
export const BRANCH_PROTECTION_QUERY = `query SiteBranchProtection($owner: String!, $repo: String!, $ref: String!) {
  repository(owner: $owner, name: $repo) {
    ref(qualifiedName: $ref) { branchProtectionRule { id } }
  }
}`;
export const BRANCH_PULL_REQUEST_QUERY = `query SiteBranchPullRequest($id: ID!) {
  node(id: $id) { ... on PullRequest {
    id number url isDraft state merged mergeable mergeStateStatus reviewDecision headRefOid
    commits { totalCount }
  } }
}`;
export const READY_FOR_REVIEW_MUTATION = `mutation SiteRequestReview($id: ID!) {
  markPullRequestReadyForReview(input: {pullRequestId: $id}) { pullRequest { id } }
}`;
export const MERGEABLE_STATES = new Set(["CLEAN", "HAS_HOOKS"]);

export const BRANCH_PR_PAGE_LIMIT = 3;
