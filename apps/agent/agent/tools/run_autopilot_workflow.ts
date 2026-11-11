import { callAutopilotAgent } from "@notra/tools/autopilot/client";
import { runAutopilotWorkflowSpec } from "@notra/tools/autopilot/tools";
import { defineTool } from "eve/tools";

import { autopilotApproval } from "../lib/utils/autopilot-approval";
import { withToolActivityLabel } from "../lib/utils/tool-activity";

export default withToolActivityLabel(
  defineTool({
    description: runAutopilotWorkflowSpec.description,
    inputSchema: runAutopilotWorkflowSpec.inputSchema,
    approval: autopilotApproval(runAutopilotWorkflowSpec.needsConfirmation),
    execute: (input, ctx) =>
      callAutopilotAgent(ctx, runAutopilotWorkflowSpec.toAction(input)),
  }),
  runAutopilotWorkflowSpec.activityLabel
);
