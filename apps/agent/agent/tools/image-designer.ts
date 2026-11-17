import { imageDesignerResultSchema } from "@notra/ai/schemas/image-designer-result";
import { defineWorkflowTool, type WorkflowToolContext } from "eve/tools";

import {
  IMAGE_DESIGNER_AGENT,
  IMAGE_DESIGNER_DESCRIPTION,
} from "../lib/constants/subagents";
import { subagentTaskInputSchema } from "../lib/schemas/subagent-task";
import { requestSubagentResult } from "../lib/utils/subagent-result";

async function imageDesignerTask(
  { message }: { message: string },
  ctx: WorkflowToolContext
) {
  // codeql[js/unknown-directive] Eve requires this directive for durable execution.
  "use workflow";

  return await requestSubagentResult(
    ctx,
    IMAGE_DESIGNER_AGENT,
    message,
    imageDesignerResultSchema
  );
}

// eve 1.0 asks for structured output per turn, so this task wraps the
// hidden subagents/image-designer-agent to keep returning its structured result.
export default defineWorkflowTool({
  label: { start: () => "Designing the image" },
  description: IMAGE_DESIGNER_DESCRIPTION,
  inputSchema: subagentTaskInputSchema,
  outputSchema: imageDesignerResultSchema,
  task: imageDesignerTask,
});
