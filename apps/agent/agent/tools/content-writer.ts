import { contentWriterResultSchema } from "@notra/ai/schemas/content-writer-result";
import { defineWorkflowTool, type WorkflowToolContext } from "eve/tools";

import {
  CONTENT_WRITER_AGENT,
  CONTENT_WRITER_DESCRIPTION,
} from "../lib/constants/subagents";
import { subagentTaskInputSchema } from "../lib/schemas/subagent-task";
import { requestSubagentResult } from "../lib/utils/subagent-result";

async function contentWriterTask(
  { message }: { message: string },
  ctx: WorkflowToolContext
) {
  // codeql[js/unknown-directive] Eve requires this directive for durable execution.
  "use workflow";

  return await requestSubagentResult(
    ctx,
    CONTENT_WRITER_AGENT,
    message,
    contentWriterResultSchema
  );
}

// eve 1.0 asks for structured output per turn, so this task wraps the
// hidden subagents/content-writer-agent to keep returning its structured result.
export default defineWorkflowTool({
  label: { start: () => "Writing content" },
  description: CONTENT_WRITER_DESCRIPTION,
  inputSchema: subagentTaskInputSchema,
  outputSchema: contentWriterResultSchema,
  task: contentWriterTask,
});
