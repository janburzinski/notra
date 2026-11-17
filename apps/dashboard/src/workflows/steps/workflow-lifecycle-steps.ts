import "@/workflows/runtime";
import { trackWorkflowOutcomeAndFlush } from "@/lib/analytics/workflow-lifecycle";
import type { WorkflowOutcomeInput } from "@/types/analytics/workflow-events";

export async function trackWorkflowOutcome(
  input: WorkflowOutcomeInput
): Promise<void> {
  "use step";
  await trackWorkflowOutcomeAndFlush(input);
}
