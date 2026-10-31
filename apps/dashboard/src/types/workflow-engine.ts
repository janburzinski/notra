import type { db } from "@notra/db/drizzle";
import type {
  CompiledWorkflowBundle,
  CompiledWorkflowGraph,
  CompiledWorkflowNode,
} from "@notra/workflows/types/graph";
import type {
  WorkflowBlockCall,
  WorkflowBlockExecution,
} from "@notra/workflows/types/run";

export type WorkflowTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export interface WorkflowGraphRunPayload {
  runId: string;
  organizationId: string;
  bundle: CompiledWorkflowBundle;
  input: unknown;
  blocks: Record<string, WorkflowBlockExecution>;
}

export interface WorkflowChildRunStart {
  parentRunId: string;
  rootRunId: string;
  parentNodeId: string;
  organizationId: string;
  workflowKey: string;
  graph: CompiledWorkflowGraph;
  input: unknown;
  runtimeRunId: string;
}

export interface WorkflowNodeStepInput {
  runId: string;
  organizationId: string;
  node: CompiledWorkflowNode;
  config: Record<string, unknown>;
  failure?: { error: string };
  call: WorkflowBlockCall;
}

export interface WorkflowRunFinish {
  runId: string;
  organizationId: string;
  status: "completed" | "failed";
  output?: unknown;
  error?: string;
  failedNodeId?: string | null;
}
