import type { getWorkspacesResponseSchema } from "@notra/schemas/api/workspaces";
import type { z } from "zod";

type WorkspaceContextResponse = z.infer<typeof getWorkspacesResponseSchema>;
export type WorkspaceContext = Omit<WorkspaceContextResponse, "pagination">;
export type WorkspaceMembership =
  WorkspaceContextResponse["workspaces"][number];

export interface PendingWorkspaceInvitation {
  organizationId: string;
  role: string | null;
}
