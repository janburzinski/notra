import { codeResearchBriefSchema } from "@notra/ai/schemas/code-research";
import { defineWorkflowTool, type WorkflowToolContext } from "eve/tools";

import {
  CODE_RESEARCHER_AGENT,
  CODE_RESEARCHER_DESCRIPTION,
} from "../lib/constants/subagents";
import { subagentTaskInputSchema } from "../lib/schemas/subagent-task";
import { requestSubagentResult } from "../lib/utils/subagent-result";

async function codeResearcherTask(
  { message }: { message: string },
  ctx: WorkflowToolContext
) {
  // codeql[js/unknown-directive] Eve requires this directive for durable execution.
  "use workflow";

  return await requestSubagentResult(
    ctx,
    CODE_RESEARCHER_AGENT,
    message,
    codeResearchBriefSchema
  );
}

// eve 1.0 asks for structured output per turn, so this task wraps the
// hidden subagents/code-researcher-agent to keep returning its structured result.
export default defineWorkflowTool({
  label: { start: () => "Researching the code" },
  description: CODE_RESEARCHER_DESCRIPTION,
  inputSchema: subagentTaskInputSchema,
  outputSchema: codeResearchBriefSchema,
  task: codeResearcherTask,
});
