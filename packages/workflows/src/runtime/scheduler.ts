import { WORKFLOW_ERROR_PORT } from "../constants/graph";
import type {
  CompiledWorkflowGraph as WorkflowGraph,
  CompiledWorkflowNode as WorkflowNode,
} from "../types/graph";
import type { WorkflowNodeSettlement } from "../types/interpreter";
import type {
  WorkflowNodeOutcome,
  WorkflowRunState,
  WorkflowScope,
} from "../types/run";
import { edgeSourcePort, getOutputPorts, isBranching } from "./ports";

export function createRunState(graph: WorkflowGraph): WorkflowRunState {
  return {
    nodes: Object.fromEntries(
      graph.nodes.map((node) => [node.id, { status: "pending" as const }])
    ),
    edges: Object.fromEntries(
      graph.edges.map((edge) => [edge.id, "pending" as const])
    ),
    failure: null,
  };
}

function nodeById(graph: WorkflowGraph, nodeId: string) {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw new Error(`Unknown workflow node "${nodeId}"`);
  }
  return node;
}

function incoming(graph: WorkflowGraph, nodeId: string) {
  return graph.edges.filter((edge) => edge.target === nodeId);
}

function outgoing(graph: WorkflowGraph, nodeId: string) {
  return graph.edges.filter((edge) => edge.source === nodeId);
}

export function readyNodes(graph: WorkflowGraph, state: WorkflowRunState) {
  if (state.failure) {
    return [];
  }
  return graph.nodes
    .filter((node) => {
      if (state.nodes[node.id]?.status !== "pending") {
        return false;
      }
      const edges = incoming(graph, node.id);
      if (edges.length === 0) {
        return true;
      }
      const statuses = edges.map((edge) => state.edges[edge.id]);
      return (
        statuses.every((status) => status !== "pending") &&
        statuses.includes("taken")
      );
    })
    .map((node) => node.id);
}

export function markNodeStarted(state: WorkflowRunState, nodeId: string) {
  state.nodes[nodeId] = { status: "running" };
}

function settleEdges(
  graph: WorkflowGraph,
  state: WorkflowRunState,
  node: WorkflowNode,
  port: string | null | false
) {
  for (const edge of outgoing(graph, node.id)) {
    const edgePort = edgeSourcePort(edge, node);
    const taken =
      port !== false &&
      (port === null ? edgePort !== WORKFLOW_ERROR_PORT : edgePort === port);
    state.edges[edge.id] = taken ? "taken" : "skipped";
  }
}

export function completeNode(
  graph: WorkflowGraph,
  state: WorkflowRunState,
  nodeId: string,
  outcome: WorkflowNodeOutcome
): WorkflowNodeSettlement {
  const node = nodeById(graph, nodeId);
  const firstPort = getOutputPorts(node)[0]?.id ?? null;
  if (outcome.status === "success") {
    const port = isBranching(node) ? (outcome.port ?? firstPort) : null;
    if (port !== null && !getOutputPorts(node).some(({ id }) => id === port)) {
      return completeNode(graph, state, nodeId, {
        status: "error",
        error: `"${node.title}" chose an output it doesn't have: ${port}`,
      });
    }
    const settled = {
      status: "success" as const,
      output: outcome.output,
      port,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
    };
    state.nodes[nodeId] = settled;
    settleEdges(graph, state, node, port);
    return settled;
  }
  if (outcome.status === "halted") {
    const settled = {
      status: "halted" as const,
      output: outcome.output,
      reason: outcome.reason,
    };
    state.nodes[nodeId] = settled;
    settleEdges(graph, state, node, false);
    return settled;
  }
  const settled = { status: "error" as const, error: outcome.error };
  state.nodes[nodeId] = settled;
  const policy = node.onError ?? "fail";
  if (
    policy === "route" &&
    outgoing(graph, nodeId).some(
      (edge) => edgeSourcePort(edge, node) === WORKFLOW_ERROR_PORT
    )
  ) {
    settleEdges(graph, state, node, WORKFLOW_ERROR_PORT);
  } else if (policy === "continue") {
    settleEdges(graph, state, node, isBranching(node) ? firstPort : null);
  } else {
    settleEdges(graph, state, node, false);
    state.failure ??= { nodeId, error: outcome.error };
  }
  return settled;
}

export function settleSkippedNodes(
  graph: WorkflowGraph,
  state: WorkflowRunState
): { nodeId: string; reason: string }[] {
  const skipped: { nodeId: string; reason: string }[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of graph.nodes) {
      if (state.nodes[node.id]?.status !== "pending") {
        continue;
      }
      const edges = incoming(graph, node.id);
      const statuses = edges.map((edge) => state.edges[edge.id]);
      const unreachable =
        edges.length > 0 && statuses.every((status) => status === "skipped");
      if (!(unreachable || state.failure)) {
        continue;
      }
      const reason = state.failure
        ? "The run stopped after a failed step"
        : "No earlier step led here";
      state.nodes[node.id] = { status: "skipped", reason };
      settleEdges(graph, state, node, false);
      skipped.push({ nodeId: node.id, reason });
      changed = true;
    }
  }
  return skipped;
}

export function isRunSettled(state: WorkflowRunState) {
  return Object.values(state.nodes).every(
    (node) => node.status !== "pending" && node.status !== "running"
  );
}

export function toScope(
  trigger: unknown,
  state: WorkflowRunState
): WorkflowScope {
  return {
    trigger,
    nodes: Object.fromEntries(
      Object.entries(state.nodes).map(([nodeId, node]) => [
        nodeId,
        {
          status: node.status,
          output: node.output,
          error: node.error,
          port: node.port,
        },
      ])
    ),
  };
}
