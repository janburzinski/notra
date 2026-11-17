import type { WorkflowToolContext } from "eve/tools";
import type { z } from "zod";

/**
 * Sends one message to a subagent and returns its structured result. eve 1.0
 * requests structured output per turn, so callers that rely on a subagent's
 * schema pass it here. Call it from a `"use workflow"` body.
 */
export async function requestSubagentResult<TSchema extends z.ZodType>(
  ctx: WorkflowToolContext,
  agentName: string,
  message: string,
  outputSchema: TSchema
): Promise<z.output<TSchema>> {
  const response = await ctx
    .agent(agentName)
    .send(message, { outputSchema, signal: ctx.abortSignal });
  const result = await response.result();
  if (result.status === "failed") {
    throw new Error(`${agentName} failed: ${result.error.message}`);
  }
  if (result.status === "cancelled") {
    throw new Error(`${agentName} was cancelled`);
  }
  return outputSchema.parse(result.data);
}
