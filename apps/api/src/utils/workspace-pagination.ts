import type { WorkspaceMembership } from "../types/workspaces";

interface WorkspacePage {
  workspaces: WorkspaceMembership[];
  pagination: { nextCursor: string | null };
}

export function paginateWorkspaces(
  workspaces: WorkspaceMembership[],
  limit: number,
  after?: string
): WorkspacePage | null {
  const start = after
    ? workspaces.findIndex((workspace) => workspace.id === after) + 1
    : 0;
  if (after && start === 0) {
    return null;
  }

  const page = workspaces.slice(start, start + limit);
  const hasMore = start + page.length < workspaces.length;

  return {
    workspaces: page,
    pagination: {
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    },
  };
}
