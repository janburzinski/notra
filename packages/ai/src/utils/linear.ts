import {
  LinearClient,
  LinearError,
  LinearErrorType,
  parseLinearError,
} from "@linear/sdk";
import {
  LINEAR_ISSUE_PREVIEWS_QUERY,
  LINEAR_ISSUES_WITH_RELATIONS_QUERY,
  LINEAR_TOOL_ERROR_MESSAGES,
} from "@notra/ai/constants/linear";
import type {
  LinearIssuePreviewsQueryResult,
  LinearIssuesQueryResult,
  LinearIssuesQueryVariables,
} from "@notra/ai/types/linear";

export function createLinearClient(accessToken: string): LinearClient {
  return new LinearClient({ accessToken });
}

export async function getLinearIssues(
  client: LinearClient,
  variables: LinearIssuesQueryVariables
) {
  // SDK issue relation getters each fetch separately, even for shared states/users.
  const { issues } = await client.client
    .request<LinearIssuesQueryResult, LinearIssuesQueryVariables>(
      LINEAR_ISSUES_WITH_RELATIONS_QUERY,
      variables
    )
    .catch((error) => {
      throw parseLinearError(error);
    });

  return {
    issues: issues.nodes.map((issue) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ? issue.description.slice(0, 500) : null,
      state: issue.state?.name ?? null,
      stateType: issue.state?.type ?? null,
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      assignee: issue.assignee?.name ?? issue.assignee?.displayName ?? null,
      labels: issue.labels.nodes.map((label) => label.name),
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      completedAt: issue.completedAt,
      url: issue.url,
    })),
    pagination: {
      hasNextPage: issues.pageInfo.hasNextPage,
      endCursor: issues.pageInfo.endCursor ?? null,
    },
  };
}

/** A tool result the model can act on, e.g. telling the user to reconnect Linear. */
export function describeLinearToolError(error: unknown): string {
  if (error instanceof LinearError) {
    if (
      error.type === LinearErrorType.AuthenticationError ||
      error.type === LinearErrorType.Forbidden
    ) {
      return LINEAR_TOOL_ERROR_MESSAGES.auth;
    }
    if (error.type === LinearErrorType.Ratelimited) {
      return LINEAR_TOOL_ERROR_MESSAGES.rateLimited;
    }
  }
  return `${LINEAR_TOOL_ERROR_MESSAGES.failed} ${
    error instanceof Error ? error.message : String(error)
  }`;
}

export async function getLinearIssuePreviews(
  client: LinearClient,
  variables: LinearIssuesQueryVariables
) {
  const { issues } = await client.client
    .request<LinearIssuePreviewsQueryResult, LinearIssuesQueryVariables>(
      LINEAR_ISSUE_PREVIEWS_QUERY,
      variables
    )
    .catch((error) => {
      throw parseLinearError(error);
    });

  return issues.nodes.map((issue) => ({
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    state: issue.state?.name ?? null,
    assignee: issue.assignee?.name ?? issue.assignee?.displayName ?? null,
    completedAt: issue.completedAt
      ? new Date(issue.completedAt).toISOString()
      : null,
    url: issue.url,
  }));
}
