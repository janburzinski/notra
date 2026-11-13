export const LINEAR_ISSUES_WITH_RELATIONS_QUERY = `
  query IssuesWithRelations(
    $filter: IssueFilter
    $first: Int
    $after: String
    $orderBy: PaginationOrderBy
  ) {
    issues(filter: $filter, first: $first, after: $after, orderBy: $orderBy) {
      nodes {
        id
        identifier
        title
        description
        priority
        priorityLabel
        createdAt
        updatedAt
        completedAt
        url
        state { name type }
        assignee { name displayName }
        labels { nodes { name } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const LINEAR_ISSUE_PREVIEWS_QUERY = `
  query IssuePreviews(
    $filter: IssueFilter
    $first: Int
    $after: String
    $orderBy: PaginationOrderBy
  ) {
    issues(filter: $filter, first: $first, after: $after, orderBy: $orderBy) {
      nodes {
        id
        identifier
        title
        completedAt
        url
        state { name }
        assignee { name displayName }
      }
    }
  }
`;

export const LINEAR_OAUTH_TOKEN_URL = "https://api.linear.app/oauth/token";
export const LINEAR_TOKEN_REQUEST_TIMEOUT_MS = 10_000;
export const LINEAR_TOKEN_REFRESH_MAX_ATTEMPTS = 3;
export const LINEAR_TOKEN_REFRESH_RETRY_DELAY_MS = 500;
// Linear access tokens last 24 hours; a response without expires_in still expires.
export const LINEAR_DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 86_400;
export const LINEAR_ACCESS_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
// The cron renews tokens this close to expiry, so services without the OAuth
// client secret (the agent, the API) always read a valid access token. It runs
// every 15 minutes so a refresh that failed after Linear rotated the token is
// retried inside Linear's 30-minute window for replaying the old one.
export const LINEAR_SCHEDULED_REFRESH_WINDOW_MS = 6 * 60 * 60 * 1000;
export const LINEAR_SCHEDULED_REFRESH_CONCURRENCY = 5;
// New refreshes stop starting after this; the rest stay due for the next run.
export const LINEAR_SCHEDULED_REFRESH_BUDGET_MS = 45_000;

export const LINEAR_TOOL_ERROR_MESSAGES = {
  auth: "Linear rejected Notra's access. Tell the user to reconnect Linear in Notra's integration settings.",
  rateLimited:
    "Linear is rate limiting requests right now. Try again in a minute.",
  failed: "Couldn't load data from Linear.",
};
