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

export const LINEAR_TOOL_ERROR_MESSAGES = {
  auth: "Linear rejected Notra's access. Tell the user to reconnect Linear in Notra's integration settings.",
  rateLimited:
    "Linear is rate limiting requests right now. Try again in a minute.",
  failed: "Couldn't load data from Linear.",
};
