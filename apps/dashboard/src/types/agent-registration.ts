export type AgentClaimFailureReason =
  | "missing"
  | "expired"
  | "claimed"
  | "mismatch"
  | "failed";

export type AgentClaimPageData =
  | { status: "linked"; userCode: string; workspaceName: string }
  | { status: "no-workspace" }
  | { status: "unavailable"; reason: AgentClaimFailureReason };
